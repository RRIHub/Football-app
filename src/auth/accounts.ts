// Device-local accounts. Profiles and their favourites live in this browser
// only; swap this module for a hosted auth service (e.g. Supabase, Firebase
// Auth, Auth0) to sync accounts across devices.

export interface Account {
  id: string;
  name: string;
  email: string;
  salt: string;
  hash: string;
  createdAt: string;
  onboarded: boolean;
}

export type PublicAccount = Omit<Account, 'salt' | 'hash'>;

const ACCOUNTS_KEY = 'footiq.accounts';
const SESSION_KEY = 'footiq.session';
const ITERATIONS = 150_000;

function load(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as Account[]) : [];
  } catch {
    return [];
  }
}

function save(accounts: Account[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** PBKDF2-SHA256 so passwords are never stored as typed. */
export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return toHex(bits);
}

const strip = ({ salt: _s, hash: _h, ...rest }: Account): PublicAccount => rest;
const normaliseEmail = (email: string) => email.trim().toLowerCase();

export function validateSignUp(name: string, email: string, password: string): string | null {
  if (!name.trim()) return 'Enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

export async function signUp(name: string, email: string, password: string): Promise<PublicAccount> {
  const problem = validateSignUp(name, email, password);
  if (problem) throw new Error(problem);
  const accounts = load();
  const normalised = normaliseEmail(email);
  if (accounts.some((a) => a.email === normalised)) throw new Error('An account with that email already exists. Sign in instead.');
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const account: Account = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalised,
    salt,
    hash: await hashPassword(password, salt),
    createdAt: new Date().toISOString(),
    onboarded: false,
  };
  save([...accounts, account]);
  localStorage.setItem(SESSION_KEY, account.id);
  return strip(account);
}

export async function signIn(email: string, password: string): Promise<PublicAccount> {
  const account = load().find((a) => a.email === normaliseEmail(email));
  // Same message either way so the form doesn't reveal which emails exist.
  if (!account || (await hashPassword(password, account.salt)) !== account.hash)
    throw new Error('Email or password is incorrect.');
  localStorage.setItem(SESSION_KEY, account.id);
  return strip(account);
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
}

export function currentAccount(): PublicAccount | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    const account = id ? load().find((a) => a.id === id) : undefined;
    return account ? strip(account) : null;
  } catch {
    return null;
  }
}

export function markOnboarded(id: string): PublicAccount | null {
  const accounts = load().map((a) => (a.id === id ? { ...a, onboarded: true } : a));
  save(accounts);
  const account = accounts.find((a) => a.id === id);
  return account ? strip(account) : null;
}
