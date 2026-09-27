import { describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { Accounts, accountHandler, readCookie, SESSION_COOKIE, type AccountRequest } from '../../server/accounts';
import { MemoryStore, RedisStore, hasAccountStore } from '../../server/store';
import { publicConfig } from '../../server/handlers';

const req = (over: Partial<AccountRequest>): AccountRequest => ({ action: 'me', method: 'GET', secure: true, ip: '1.2.3.4', ...over });
const cookieFrom = (setCookie?: string) => `${SESSION_COOKIE}=${readCookie(setCookie, SESSION_COOKIE)}`;

async function signedUp(store = new MemoryStore()) {
  const accounts = new Accounts(store);
  const res = await accounts.handle(
    req({ action: 'signup', method: 'POST', body: { name: 'Sam', email: 'Sam@Example.com ', password: 'correct horse' } }),
  );
  return { accounts, store, res, cookie: cookieFrom(res.cookie) };
}

describe('server accounts', () => {
  it('creates an account and signs straight in with a secure, long-lived cookie', async () => {
    const { res } = await signedUp();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ user: { name: 'Sam', email: 'sam@example.com', onboarded: false } });
    expect(JSON.stringify(res.body)).not.toMatch(/hash|salt/);
    expect(res.cookie).toMatch(/HttpOnly/);
    expect(res.cookie).toMatch(/SameSite=Lax/);
    expect(res.cookie).toMatch(/Secure/);
    expect(res.cookie).toMatch(/Max-Age=2592000/);
  });

  it('keeps people signed in: the session cookie identifies them and is renewed', async () => {
    const { accounts, cookie } = await signedUp();
    const me = await accounts.handle(req({ cookie }));
    expect(me.body).toMatchObject({ user: { email: 'sam@example.com' } });
    expect(me.cookie).toMatch(/Max-Age=2592000/);
    expect((await accounts.handle(req({}))).body).toEqual({ user: null });
    expect((await accounts.handle(req({ cookie: `${SESSION_COOKIE}=forged-token-value-xxxxxxxx` }))).body).toEqual({ user: null });
  });

  it('signs in on another device with the same email and password', async () => {
    const { accounts } = await signedUp();
    const bad = await accounts.handle(req({ action: 'login', method: 'POST', body: { email: 'sam@example.com', password: 'wrong password' } }));
    expect(bad).toMatchObject({ status: 401, body: { error: 'Email or password is incorrect.' } });
    const unknown = await accounts.handle(req({ action: 'login', method: 'POST', body: { email: 'nobody@example.com', password: 'correct horse' } }));
    expect(unknown.body).toEqual(bad.body);
    const ok = await accounts.handle(req({ action: 'login', method: 'POST', body: { email: ' SAM@example.com', password: 'correct horse' } }));
    expect(ok.status).toBe(200);
    const me = await accounts.handle(req({ cookie: cookieFrom(ok.cookie) }));
    expect(me.body).toMatchObject({ user: { email: 'sam@example.com' } });
  });

  it('never stores the password or the session token as-is', async () => {
    const { store, cookie } = await signedUp();
    const dump = JSON.stringify([...(store as unknown as { data: Map<string, unknown> }).data]);
    expect(dump).not.toContain('correct horse');
    expect(dump).not.toContain(cookie.split('=')[1]);
  });

  it('rejects duplicate emails and weak input', async () => {
    const { accounts } = await signedUp();
    const dup = await accounts.handle(req({ action: 'signup', method: 'POST', body: { name: 'Sam', email: 'sam@example.com', password: 'another one' } }));
    expect(dup).toMatchObject({ status: 409 });
    const weak = await accounts.handle(req({ action: 'signup', method: 'POST', body: { name: 'A', email: 'a@b.co', password: 'short' } }));
    expect(weak).toMatchObject({ status: 400, body: { error: expect.stringMatching(/8 characters/) } });
  });

  it('signs out by ending the session', async () => {
    const { accounts, cookie } = await signedUp();
    const out = await accounts.handle(req({ action: 'logout', method: 'POST', cookie }));
    expect(out.cookie).toMatch(/Max-Age=0/);
    expect((await accounts.handle(req({ cookie }))).body).toEqual({ user: null });
  });

  it('limits repeated failed sign-ins', async () => {
    const { accounts } = await signedUp();
    const attempt = (password: string) =>
      accounts.handle(req({ action: 'login', method: 'POST', body: { email: 'sam@example.com', password } }));
    for (let i = 0; i < 10; i++) expect((await attempt('wrong password')).status).toBe(401);
    expect((await attempt('correct horse')).status).toBe(429);
  });

  it('saves favourites to the account and returns them on any device', async () => {
    const { accounts, cookie } = await signedUp();
    const data = { teams: [{ id: 57, name: 'Arsenal' }], xi: { name: 'My XI' } };
    expect((await accounts.handle(req({ action: 'data', method: 'PUT', cookie, body: { data } }))).status).toBe(200);
    const login = await accounts.handle(req({ action: 'login', method: 'POST', body: { email: 'sam@example.com', password: 'correct horse' } }));
    const loaded = await accounts.handle(req({ action: 'data', cookie: cookieFrom(login.cookie) }));
    expect(loaded.body).toEqual({ data });
    expect((await accounts.handle(req({ action: 'data' }))).status).toBe(401);
    const huge = { blob: 'x'.repeat(70_000) };
    expect((await accounts.handle(req({ action: 'data', method: 'PUT', cookie, body: { data: huge } }))).status).toBe(413);
  });

  it('remembers that onboarding is done', async () => {
    const { accounts, cookie } = await signedUp();
    await accounts.handle(req({ action: 'onboarded', method: 'POST', cookie }));
    expect((await accounts.handle(req({ cookie }))).body).toMatchObject({ user: { onboarded: true } });
  });
});

describe('account storage', () => {
  it('talks to Upstash Redis over REST', async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ result: 'OK' })));
    const store = new RedisStore('https://example.upstash.io', 'token', fetch);
    expect(await store.set('k', 'v', { ttlSeconds: 60, onlyIfNew: true })).toBe(true);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://example.upstash.io');
    expect(new Headers(init!.headers).get('Authorization')).toBe('Bearer token');
    expect(JSON.parse(String(init!.body))).toEqual(['SET', 'k', 'v', 'EX', 60, 'NX']);
  });

  it('is available with Redis configured or in local development, not on Vercel without it', () => {
    expect(hasAccountStore({ KV_REST_API_URL: 'u', KV_REST_API_TOKEN: 't', VERCEL: '1' })).toBe(true);
    expect(hasAccountStore({ UPSTASH_REDIS_REST_URL: 'u', UPSTASH_REDIS_REST_TOKEN: 't', VERCEL: '1' })).toBe(true);
    expect(hasAccountStore({})).toBe(true);
    expect(hasAccountStore({ VERCEL: '1' })).toBe(false);
    expect(publicConfig({ VERCEL: '1' }).accounts).toBe('device');
  });
});

describe('account HTTP handler', () => {
  const serve = (env: Record<string, string>) =>
    new Promise<{ server: Server; base: string }>((resolve) => {
      const handler = accountHandler(env);
      const server = createServer((rq, rs) => void handler(rq, rs));
      server.listen(0, () => {
        const addr = server.address() as { port: number };
        resolve({ server, base: `http://localhost:${addr.port}/api/account` });
      });
    });

  it('explains when account storage is missing on Vercel', async () => {
    const { server, base } = await serve({ VERCEL: '1' });
    const res = await fetch(`${base}?action=me`);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/Account storage isn't set up/);
    server.close();
  });

  it('refuses cross-site and non-JSON writes', async () => {
    const { server, base } = await serve({ FOOTIQ_DEV_DB: '/dev/null/unused.json' });
    const cross = await fetch(`${base}?action=login`, {
      method: 'POST',
      headers: { Origin: 'https://evil.example.com', 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(cross.status).toBe(403);
    const form = await fetch(`${base}?action=login`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
    expect(form.status).toBe(415);
    server.close();
  });
});
