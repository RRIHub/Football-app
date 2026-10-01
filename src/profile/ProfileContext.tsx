import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getConfig } from '../config';
import { legacyData, useProfileDataStore } from './profileData';

// Your FootIQ profile: a unique username, your nationality and whether set-up
// is finished. It lives in this browser; the server only keeps the username
// register so names stay unique.

export interface Profile {
  id: string;
  username: string;
  /** Country code from countries.ts (ISO, or GB-ENG etc. for home nations). */
  nationality?: string;
  /** Proves this device owns the username on the server. Never shown. */
  secret: string;
  createdAt: string;
  setupDone: boolean;
}

const PROFILE_KEY = 'footiq.profile';

function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    const p = raw ? (JSON.parse(raw) as Profile) : null;
    return p && typeof p.username === 'string' && typeof p.id === 'string' ? p : null;
  } catch {
    return null;
  }
}

function saveProfile(p: Profile | null) {
  try {
    if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    else localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* storage blocked: the profile lasts for this visit */
  }
}

const randomHex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Same rules as the server, so mistakes show while typing. */
export function usernameProblem(name: string): string | null {
  if (name.length < 3 || name.length > 20) return 'Usernames are 3 to 20 characters.';
  if (!/^[A-Za-z0-9_.]+$/.test(name)) return 'Use letters, numbers, dots and underscores only.';
  if (/^\.|\.$|\.\./.test(name)) return "Dots can't start or end a username, or come in pairs.";
  return null;
}

/* ---------- username register (server) ---------- */

export const usernamesChecked = () => getConfig().profiles === 'server';

async function call<T>(action: string, init?: RequestInit, query = ''): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/profile?action=${action}${query}`, init);
  } catch {
    throw new Error("Couldn't reach the FootIQ server. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body;
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Whether a username is free (or already this device's). */
export async function checkUsername(name: string, mine?: Pick<Profile, 'id' | 'secret'>): Promise<{ available: boolean; reason?: string }> {
  const q = new URLSearchParams({ username: name, ...(mine ? { profileId: mine.id, secret: mine.secret } : {}) });
  return call('check', undefined, `&${q}`);
}

const claim = (name: string, p: Pick<Profile, 'id' | 'secret'>) =>
  call('claim', post({ username: name, profileId: p.id, secret: p.secret }));
const release = (name: string, p: Pick<Profile, 'id' | 'secret'>) =>
  call('release', post({ username: name, profileId: p.id, secret: p.secret }));

/* ---------- context ---------- */

interface ProfileState {
  profile: Profile | null;
  /** Reserve a username and start a profile (set-up step 1). */
  create: (username: string) => Promise<void>;
  rename: (username: string) => Promise<void>;
  setNationality: (code: string | undefined) => void;
  finishSetup: () => void;
  /** Release the username and clear this device's profile and favourites. */
  startOver: () => Promise<void>;
}

const Ctx = createContext<ProfileState | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const data = useProfileDataStore();
  const [profile, setProfile] = useState<Profile | null>(loadProfile);

  const update = useCallback((next: Profile | null) => {
    saveProfile(next);
    setProfile(next);
  }, []);

  const create = useCallback(
    async (username: string) => {
      const problem = usernameProblem(username);
      if (problem) throw new Error(problem);
      // Keep the same identity if set-up is being redone with a new name.
      const base = profile ?? { id: crypto.randomUUID(), secret: randomHex(32), createdAt: new Date().toISOString() };
      if (usernamesChecked()) {
        await claim(username, base);
        if (profile && profile.username.toLowerCase() !== username.toLowerCase()) await release(profile.username, base).catch(() => undefined);
      }
      // Favourites from an older version of the app on this device come along.
      if (!profile) {
        const old = legacyData();
        if (old) data.seed(old);
      }
      update({ ...base, username, nationality: profile?.nationality, setupDone: profile?.setupDone ?? false });
    },
    [profile, data, update],
  );

  const rename = useCallback(
    async (username: string) => {
      if (!profile) return create(username);
      const problem = usernameProblem(username);
      if (problem) throw new Error(problem);
      if (usernamesChecked()) {
        await claim(username, profile);
        if (profile.username.toLowerCase() !== username.toLowerCase()) await release(profile.username, profile).catch(() => undefined);
      }
      update({ ...profile, username });
    },
    [profile, create, update],
  );

  const setNationality = useCallback(
    (code: string | undefined) => {
      if (profile) update({ ...profile, nationality: code });
    },
    [profile, update],
  );

  const finishSetup = useCallback(() => {
    if (profile) update({ ...profile, setupDone: true });
  }, [profile, update]);

  const startOver = useCallback(async () => {
    if (profile && usernamesChecked()) await release(profile.username, profile).catch(() => undefined);
    data.clear();
    update(null);
    location.hash = '#/';
  }, [profile, data, update]);

  const value = useMemo(
    () => ({ profile, create, rename, setNationality, finishSetup, startOver }),
    [profile, create, rename, setNationality, finishSetup, startOver],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile(): ProfileState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}
