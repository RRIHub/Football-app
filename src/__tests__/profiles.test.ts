import { describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { profileHandler, Usernames, validateUsername } from '../../server/usernames';
import { MemoryStore } from '../../server/store';
import { publicConfig } from '../../server/handlers';
import { countries, countryByCode, flagFor } from '../profile/countries';
import { ProfileDataStore } from '../profile/profileData';
import { usernameProblem } from '../profile/ProfileContext';

const me = { profileId: 'profile-aaaa-1111', secret: 'a'.repeat(64) };
const them = { profileId: 'profile-bbbb-2222', secret: 'b'.repeat(64) };
const params = (o: Record<string, string>) => new URLSearchParams(o);

describe('username register', () => {
  const claim = (u: Usernames, username: string, who = me, ip = '1.1.1.1') => u.handle('claim', 'POST', { username, ...who }, params({}), ip);
  const check = (u: Usernames, username: string, who?: typeof me) =>
    u.handle('check', 'GET', {}, params({ username, ...(who ?? {}) }), '1.1.1.1');

  it('keeps usernames unique, ignoring capitalisation', async () => {
    const u = new Usernames(new MemoryStore());
    expect((await check(u, 'GoalMachine')).body).toEqual({ available: true });
    expect((await claim(u, 'GoalMachine')).status).toBe(201);
    expect((await check(u, 'goalmachine')).body).toEqual({ available: false, reason: 'That username is taken.' });
    expect(await claim(u, 'GOALMACHINE', them)).toMatchObject({ status: 409, body: { error: 'That username is taken.' } });
  });

  it("treats your own username as yours (re-claiming or changing its capitals is fine)", async () => {
    const u = new Usernames(new MemoryStore());
    await claim(u, 'goalmachine');
    expect((await check(u, 'GoalMachine', me)).body).toEqual({ available: true });
    expect((await claim(u, 'GoalMachine')).status).toBe(200);
    // Someone who only knows the profile id can't take it.
    expect((await claim(u, 'goalmachine', { ...me, secret: 'c'.repeat(64) })).status).toBe(409);
  });

  it('only lets the owner release a username', async () => {
    const u = new Usernames(new MemoryStore());
    await claim(u, 'goalmachine');
    await u.handle('release', 'POST', { username: 'goalmachine', ...them }, params({}), '1.1.1.1');
    expect((await check(u, 'goalmachine')).body).toMatchObject({ available: false });
    await u.handle('release', 'POST', { username: 'goalmachine', ...me }, params({}), '1.1.1.1');
    expect((await check(u, 'goalmachine')).body).toEqual({ available: true });
  });

  it('rejects invalid and reserved names, and stores no secrets', async () => {
    expect(validateUsername('ab')).toMatch(/3 to 20/);
    expect(validateUsername('has space')).toMatch(/letters, numbers/);
    expect(validateUsername('.dot')).toMatch(/Dots/);
    expect(validateUsername('a..b')).toMatch(/Dots/);
    expect(validateUsername('Admin')).toMatch(/reserved/);
    expect(validateUsername('kev_9.ox')).toBeNull();
    const store = new MemoryStore();
    const u = new Usernames(store);
    expect((await check(u, 'no way')).body).toMatchObject({ available: false, reason: expect.stringMatching(/letters/) });
    expect((await claim(u, 'x')).status).toBe(400);
    await claim(u, 'goalmachine');
    expect(JSON.stringify([...(store as unknown as { data: Map<string, unknown> }).data])).not.toContain(me.secret);
  });

  it('limits how fast names can be claimed', async () => {
    const u = new Usernames(new MemoryStore());
    for (let i = 0; i < 20; i++) await claim(u, `name_${i}`, { ...me, profileId: `profile-${String(i).padStart(8, '0')}` }, '9.9.9.9');
    expect((await claim(u, 'one_more', me, '9.9.9.9')).status).toBe(429);
    expect((await claim(u, 'one_more', me, '8.8.8.8')).status).toBe(201);
  });

  it('agrees with the in-app rules', () => {
    for (const name of ['ab', 'ok_name', 'bad name', '.x.', 'twenty_characters_xx', 'twenty_one_characters']) {
      expect(usernameProblem(name) === null).toBe(validateUsername(name) === null || validateUsername(name) === 'That username is reserved.');
    }
  });
});

describe('username register over HTTP', () => {
  const serve = (env: Record<string, string>) =>
    new Promise<{ close: () => void; base: string }>((resolve) => {
      const handler = profileHandler(env);
      const server = createServer((rq, rs) => void handler(rq, rs));
      server.listen(0, () => resolve({ close: () => server.close(), base: `http://localhost:${(server.address() as { port: number }).port}/api/profile` }));
    });

  it('explains when username storage is missing on Vercel', async () => {
    const { close, base } = await serve({ VERCEL: '1' });
    const res = await fetch(`${base}?action=check&username=abc`);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/Username storage isn't set up/);
    close();
    expect(publicConfig({ VERCEL: '1' }).profiles).toBe('device');
    expect(publicConfig({ VERCEL: '1', KV_REST_API_URL: 'u', KV_REST_API_TOKEN: 't' }).profiles).toBe('server');
  });

  it('refuses cross-site claims', async () => {
    const { close, base } = await serve({ FOOTIQ_DEV_DB: '/dev/null/unused.json' });
    const res = await fetch(`${base}?action=claim`, {
      method: 'POST',
      headers: { Origin: 'https://evil.example.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'stolen', ...me }),
    });
    expect(res.status).toBe(403);
    close();
  });
});

describe('profile on this device', () => {
  const memoryStorage = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };

  it('saves favourites and the XI, and keeps them across visits', () => {
    const storage = memoryStorage();
    const a = new ProfileDataStore(storage);
    const seen = vi.fn();
    a.subscribe(seen);
    a.set('teams', [{ id: 1, name: 'Arsenal' }]);
    expect(seen).toHaveBeenCalled();
    expect(new ProfileDataStore(storage).get('teams')).toEqual([{ id: 1, name: 'Arsenal' }]);
  });

  it('carries over older favourites without overwriting new ones, and clears on start over', () => {
    const s = new ProfileDataStore(memoryStorage());
    s.set('teams', [{ id: 2 }]);
    s.seed({ teams: [{ id: 1 }], players: [{ id: 9 }] });
    expect(s.get('teams')).toEqual([{ id: 2 }]);
    expect(s.get('players')).toEqual([{ id: 9 }]);
    s.clear();
    expect(s.get('players')).toBeUndefined();
  });

  it('lists countries with flags, including the home nations', () => {
    const list = countries();
    expect(list.length).toBeGreaterThan(200);
    expect(countryByCode('GB-ENG')).toMatchObject({ name: 'England' });
    expect(countryByCode('GB-SCT')!.name).toBe('Scotland');
    expect(countryByCode('CI')!.name).toBe('Ivory Coast');
    expect(countryByCode('BR')).toMatchObject({ name: 'Brazil', flag: '🇧🇷' });
    expect(flagFor('FR')).toBe('🇫🇷');
    expect([...list].sort((a, b) => a.name.localeCompare(b.name))).toEqual(list);
  });
});
