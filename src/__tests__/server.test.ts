import { describe, expect, it, vi } from 'vitest';
import { proxy, publicConfig } from '../../server/handlers';

const ok = (body: unknown, type = 'application/json') =>
  vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': type } }));

const req = (path: string) => `/api/x?path=${encodeURIComponent(path)}`;

describe('publicConfig', () => {
  it('reports which sources have keys without exposing them', () => {
    const cfg = publicConfig({ FOOTBALL_DATA_API_KEY: 'secret-fd', GUARDIAN_API_KEY: 'secret-g' });
    expect(cfg).toMatchObject({ dataSource: 'football-data', news: true, liveRefreshSeconds: 20 });
    expect(JSON.stringify(cfg)).not.toContain('secret');
    expect(publicConfig({}).dataSource).toBe('demo');
    expect(publicConfig({ API_FOOTBALL_KEY: 'k', FOOTBALL_DATA_API_KEY: 'k' }).dataSource).toBe('api-football');
  });
});

describe('proxy', () => {
  const env = { FOOTBALL_DATA_API_KEY: 'fd-key', GUARDIAN_API_KEY: 'g-key', API_FOOTBALL_KEY: 'af-key' };

  it('forwards to football-data.org with the key in a header', async () => {
    const fetch = ok({ matches: [] });
    const res = await proxy('football-data', req('/competitions/PL/matches?matchday=3'), 'GET', env, fetch);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ matches: [] });
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe('https://api.football-data.org/v4/competitions/PL/matches?matchday=3');
    expect(new Headers(init!.headers).get('X-Auth-Token')).toBe('fd-key');
    // Live scores are cached at the CDN briefly so visitors share requests.
    expect(res.headers['Cache-Control']).toContain('s-maxage=15');
  });

  it('adds the Guardian key server-side and ignores one sent by the browser', async () => {
    const fetch = ok({ response: { results: [] } });
    await proxy('news', req('/search?q=Arsenal&api-key=attacker'), 'GET', env, fetch);
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe('https://content.guardianapis.com/search');
    expect(url.searchParams.getAll('api-key')).toEqual(['g-key']);
    expect(url.searchParams.get('q')).toBe('Arsenal');
  });

  it('uses the API-Football header', async () => {
    const fetch = ok({ errors: [], response: [] });
    await proxy('api-football', req('/fixtures?live=all'), 'GET', env, fetch);
    expect(new Headers(fetch.mock.calls[0][1]!.headers).get('x-apisports-key')).toBe('af-key');
  });

  it('explains a missing key instead of failing silently', async () => {
    const res = await proxy('football-data', req('/matches'), 'GET', {}, ok({}));
    expect(res.status).toBe(503);
    expect(JSON.parse(res.body).error).toMatch(/FOOTBALL_DATA_API_KEY is not set/);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it.each([
    ['/../../etc/passwd'],
    ['/competitions/%2e%2e/%2e%2e/admin'],
    ['//evil.example.com/x'],
    ['https://evil.example.com/'],
    ['/admin/users'],
    ['competitions/PL'],
  ])('refuses %s', async (path) => {
    const fetch = ok({});
    const res = await proxy('football-data', req(path), 'GET', env, fetch);
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('only allows GET', async () => {
    const res = await proxy('football-data', req('/matches'), 'POST', env, ok({}));
    expect(res.status).toBe(405);
  });

  it('passes on upstream errors with a readable message and a hint', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ message: 'Your API token is invalid.' }), { status: 400 }));
    const bad = await proxy('football-data', req('/matches'), 'GET', env, fetch);
    expect(bad.status).toBe(400);
    expect(JSON.parse(bad.body).error).toBe('football-data.org returned 400: Your API token is invalid..');

    const forbidden = vi.fn(async () => new Response('{"message":"restricted"}', { status: 403 }));
    const res = await proxy('football-data', req('/competitions/FAC/matches'), 'GET', env, forbidden);
    expect(JSON.parse(res.body).error).toMatch(/403: restricted\. Check that FOOTBALL_DATA_API_KEY is correct/);

    const limited = vi.fn(async () => new Response('Too many', { status: 429 }));
    expect(JSON.parse((await proxy('football-data', req('/matches'), 'GET', env, limited)).body).error).toMatch(
      /429\. The request limit/,
    );
  });

  it('reports an unreachable or slow upstream', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const res = await proxy('football-data', req('/matches'), 'GET', env, down);
    expect(res.status).toBe(502);
    expect(JSON.parse(res.body).error).toBe('football-data.org could not be reached.');

    const slow = vi.fn(async () => {
      throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    });
    expect(JSON.parse((await proxy('news', req('/search'), 'GET', env, slow)).body).error).toBe('The Guardian timed out.');
  });
});
