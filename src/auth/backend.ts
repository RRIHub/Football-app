// How the app signs people in. With account storage on the server, accounts
// work from any device and sessions last 30 days (renewed on each visit).
// Without it, accounts fall back to this browser only, and the login screen
// says so.

import { getConfig } from '../config';
import * as device from './accounts';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  onboarded: boolean;
}

/** Per-account data kept with the account: favourites and the Build XI team. */
export type AccountData = Record<string, unknown>;

export interface AuthBackend {
  readonly kind: 'server' | 'device';
  /** The signed-in user, if any (restores the session on page load). */
  current(): Promise<User | null>;
  signUp(name: string, email: string, password: string): Promise<User>;
  signIn(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  markOnboarded(): Promise<User | null>;
  loadData(user: User): Promise<AccountData>;
  /** `keepalive` lets a save finish while the page is closing. */
  saveData(user: User, data: AccountData, opts?: { keepalive?: boolean }): Promise<void>;
}

/* ---------- server accounts ---------- */

async function call<T>(action: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/account?action=${action}`, {
      credentials: 'same-origin',
      ...init,
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch {
    throw new Error("Couldn't reach the FootIQ server. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Account request failed (${res.status}).`);
  return body as T;
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const serverBackend: AuthBackend = {
  kind: 'server',
  async current() {
    return (await call<{ user: User | null }>('me')).user;
  },
  async signUp(name, email, password) {
    return (await call<{ user: User }>('signup', post({ name, email, password }))).user;
  },
  async signIn(email, password) {
    return (await call<{ user: User }>('login', post({ email, password }))).user;
  },
  async signOut() {
    await call('logout', post({}));
  },
  async markOnboarded() {
    return (await call<{ user: User }>('onboarded', post({}))).user;
  },
  async loadData() {
    return (await call<{ data: AccountData }>('data')).data;
  },
  async saveData(_user, data, opts) {
    await call('data', { method: 'PUT', body: JSON.stringify({ data }), keepalive: opts?.keepalive });
  },
};

/* ---------- device-only accounts ---------- */

const dataKey = (id: string) => `footiq.${id}.data`;

/** Favourites and the XI as saved by earlier versions of the app, before account data existed. */
export function legacyDeviceData(id: string): AccountData {
  const read = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as unknown) : undefined;
    } catch {
      return undefined;
    }
  };
  const data: AccountData = {};
  const teams = read(`footiq.${id}.teams`);
  const players = read(`footiq.${id}.players`);
  const xi = read('footiq.xi');
  if (teams) data.teams = teams;
  if (players) data.players = players;
  if (xi) data.xi = xi;
  return data;
}

export function deviceDataFor(id: string): AccountData {
  try {
    const raw = localStorage.getItem(dataKey(id));
    if (raw) return JSON.parse(raw) as AccountData;
  } catch {
    /* fall through */
  }
  return legacyDeviceData(id);
}

export const deviceBackend: AuthBackend = {
  kind: 'device',
  async current() {
    return device.currentAccount();
  },
  signUp: device.signUp,
  signIn: device.signIn,
  async signOut() {
    device.signOut();
  },
  async markOnboarded() {
    const id = device.currentAccount()?.id;
    return id ? device.markOnboarded(id) : null;
  },
  async loadData(user) {
    return deviceDataFor(user.id);
  },
  async saveData(user, data) {
    localStorage.setItem(dataKey(user.id), JSON.stringify(data));
  },
};

export function selectBackend(): AuthBackend {
  return getConfig().accounts === 'server' ? serverBackend : deviceBackend;
}

/** Favourites from a device-only account with this email, to bring into a server account. */
export function deviceAccountDataFor(email: string): AccountData | null {
  const account = device.findAccount(email);
  if (!account) return null;
  const data = deviceDataFor(account.id);
  return Object.keys(data).length ? data : null;
}
