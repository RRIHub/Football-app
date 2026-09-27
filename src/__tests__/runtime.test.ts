import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchConfig, setConfig } from '../config';
import { createClient, dataHealth } from '../data/http';
import { selectNews, selectProvider } from '../data';

afterEach(() => {
  vi.unstubAllGlobals();
  setConfig({ dataSource: 'demo', news: false, competitions: '', liveRefreshSeconds: 20, apiFootballRequestsPerMinute: 10 });
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('fetchConfig', () => {
  it('returns the server config', async () => {
    const cfg = await fetchConfig(async () => jsonResponse({ dataSource: 'football-data', news: true }));
    expect(cfg).toMatchObject({ dataSource: 'football-data', news: true, liveRefreshSeconds: 20 });
  });

  it('fails loudly when the functions are missing, instead of falling back to demo', async () => {
    // A static host answers unknown routes with the app's HTML.
    const html = async () => new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } });
    await expect(fetchConfig(html)).rejects.toThrow(/not JSON.*functions in \/api/);
    await expect(fetchConfig(async () => new Response('nope', { status: 404 }))).rejects.toThrow(/returned 404/);
    await expect(
      fetchConfig(async () => {
        throw new TypeError('offline');
      }),
    ).rejects.toThrow(/Couldn't reach the FootIQ server/);
  });
});

describe('provider selection', () => {
  it('follows the server config', () => {
    expect(selectProvider({ dataSource: 'football-data', news: false, competitions: '', liveRefreshSeconds: 20, apiFootballRequestsPerMinute: 10 }).id).toBe('football-data');
    expect(selectProvider({ dataSource: 'api-football', news: false, competitions: '', liveRefreshSeconds: 20, apiFootballRequestsPerMinute: 10 }).id).toBe('api-football');
    expect(selectNews({ dataSource: 'demo', news: true, competitions: '', liveRefreshSeconds: 20, apiFootballRequestsPerMinute: 10 }).id).toBe('guardian');
  });
});

describe('data errors', () => {
  it("surfaces the server's message and clears once that source recovers", async () => {
    const client = createClient({ route: '/api/test-errors', maxPerMinute: () => 100 });
    vi.stubGlobal('fetch', async () => jsonResponse({ error: 'FOOTBALL_DATA_API_KEY is not set on the server.' }, 503));
    await expect(client.get('/matches', 0)).rejects.toThrow('FOOTBALL_DATA_API_KEY is not set on the server.');
    expect(dataHealth.get()).toBe('FOOTBALL_DATA_API_KEY is not set on the server.');

    vi.stubGlobal('fetch', async () => jsonResponse({ ok: true }));
    await client.get('/matches', 0);
    expect(dataHealth.get()).toBeNull();
  });
});
