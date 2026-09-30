// Server-side request handlers, shared by the Vercel functions in /api and the
// Vite dev/preview server (vite.config.ts). API keys are read from the server
// environment here and never sent to the browser.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { matchSourceNames } from './matchSources.js';
import { hasAccountStore } from './store.js';

export type Env = Record<string, string | undefined>;

export type DataSource = 'api-football' | 'football-data' | 'demo';

/** Settings the browser needs. Only flags and numbers – never keys. */
export interface PublicConfig {
  dataSource: DataSource;
  news: boolean;
  /** Optional comma-separated football-data.org competition codes. */
  competitions: string;
  liveRefreshSeconds: number;
  apiFootballRequestsPerMinute: number;
  /** 'server' when accounts are stored server-side, 'device' when they can only live in the browser. */
  accounts: 'server' | 'device';
  /** Extra sources for match details (line-ups, events, stats), in the order they're tried. */
  matchSources: string[];
}

export function publicConfig(env: Env): PublicConfig {
  return {
    dataSource: env.API_FOOTBALL_KEY ? 'api-football' : env.FOOTBALL_DATA_API_KEY ? 'football-data' : 'demo',
    news: Boolean(env.GUARDIAN_API_KEY),
    competitions: env.FOOTBALL_DATA_COMPETITIONS ?? '',
    liveRefreshSeconds: Number(env.LIVE_REFRESH_SECONDS) || 20,
    apiFootballRequestsPerMinute: Number(env.API_FOOTBALL_REQUESTS_PER_MINUTE) || 10,
    accounts: hasAccountStore(env) ? 'server' : 'device',
    matchSources: matchSourceNames(env),
  };
}

interface Upstream {
  label: string;
  envKey: string;
  base: string;
  /** Only these top-level paths are forwarded, so the key can't be used for anything else. */
  allow: RegExp;
  auth: (key: string, url: URL, headers: Headers) => void;
  /** Seconds the CDN may cache a successful response for this path. */
  cacheSeconds: (path: string) => number;
}

export const UPSTREAMS = {
  'football-data': {
    label: 'football-data.org',
    envKey: 'FOOTBALL_DATA_API_KEY',
    base: 'https://api.football-data.org/v4',
    allow: /^\/(competitions|matches|teams|persons)(\/|$)/,
    auth: (key, _url, headers) => headers.set('X-Auth-Token', key),
    cacheSeconds: (path) => (/\/matches/.test(path) ? 15 : /\/standings/.test(path) ? 60 : 600),
  },
  'api-football': {
    label: 'API-Football',
    envKey: 'API_FOOTBALL_KEY',
    base: 'https://v3.football.api-sports.io',
    allow: /^\/(leagues|fixtures|standings|teams|players|transfers)(\/|$)/,
    auth: (key, _url, headers) => headers.set('x-apisports-key', key),
    cacheSeconds: (path) => (/^\/fixtures/.test(path) ? 15 : /^\/standings/.test(path) ? 60 : 600),
  },
  news: {
    label: 'The Guardian',
    envKey: 'GUARDIAN_API_KEY',
    base: 'https://content.guardianapis.com',
    allow: /^\/search$/,
    auth: (key, url) => url.searchParams.set('api-key', key),
    cacheSeconds: () => 300,
  },
} satisfies Record<string, Upstream>;

export type UpstreamName = keyof typeof UPSTREAMS;

export interface ProxyResult {
  status: number;
  headers: Record<string, string>;
  body: string;
}

const json = (status: number, body: unknown, cache = 'no-store'): ProxyResult => ({
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  body: JSON.stringify(body),
});

/** Pull a human-readable message out of an upstream error body. */
function upstreamMessage(text: string): string | undefined {
  try {
    const body = JSON.parse(text) as { message?: unknown; error?: unknown; errors?: unknown; response?: { message?: unknown } };
    const msg = body.message ?? body.error ?? body.response?.message;
    if (typeof msg === 'string') return msg;
    if (body.errors && typeof body.errors === 'object') {
      const values = Object.values(body.errors as Record<string, unknown>).filter((v) => typeof v === 'string');
      if (values.length) return values.join('; ');
    }
  } catch {
    /* not JSON */
  }
  return undefined;
}

/**
 * Forwards `GET /api/<name>?path=/some/path?x=1` to the upstream API with the
 * server's key, and returns the upstream response (or a JSON `{ error }`).
 */
export async function proxy(
  name: UpstreamName,
  requestUrl: string,
  method: string | undefined,
  env: Env,
  fetchImpl: typeof fetch = fetch,
): Promise<ProxyResult> {
  const up: Upstream = UPSTREAMS[name];
  if (method && method !== 'GET' && method !== 'HEAD') return json(405, { error: 'Only GET is supported.' });

  const key = env[up.envKey];
  if (!key) return json(503, { error: `${up.envKey} is not set on the server, so data from ${up.label} is unavailable.` });

  const incoming = new URL(requestUrl, 'http://localhost');
  const target = incoming.searchParams.get('path') ?? '';
  // Reject anything that isn't a plain API path before it reaches the upstream.
  if (!target.startsWith('/') || /\.\.|%2e|\/\/|#|\\/i.test(target)) return json(400, { error: 'Invalid path.' });
  const url = new URL(up.base + target);
  // Check the path as the URL parser resolved it, relative to the API's base path.
  const basePath = new URL(up.base).pathname.replace(/\/$/, '');
  const rel = url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) : '';
  if (url.origin !== new URL(up.base).origin || !up.allow.test(rel))
    return json(400, { error: 'That endpoint is not available.' });
  // Never let the browser choose the key.
  url.searchParams.delete('api-key');

  const headers = new Headers({ Accept: 'application/json' });
  up.auth(key, url, headers);

  let res: Response;
  try {
    res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(10_000) });
  } catch (e) {
    const reason = e instanceof Error && e.name === 'TimeoutError' ? 'timed out' : 'could not be reached';
    return json(502, { error: `${up.label} ${reason}.` });
  }
  const text = await res.text();
  if (!res.ok) {
    const detail = upstreamMessage(text);
    const hint =
      res.status === 401 || res.status === 403
        ? ` Check that ${up.envKey} is correct and your plan includes this data.`
        : res.status === 429
          ? ' The request limit for your plan was reached; try again shortly.'
          : '';
    return json(res.status, { error: `${up.label} returned ${res.status}${detail ? `: ${detail}` : ''}.${hint}` });
  }
  const seconds = up.cacheSeconds(url.pathname);
  return {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/json; charset=utf-8',
      // Shared CDN cache: visitors reuse one upstream request instead of each spending the plan's limit.
      'Cache-Control': `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`,
    },
    body: text,
  };
}

export function send(res: ServerResponse, result: ProxyResult) {
  res.statusCode = result.status;
  for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
  res.end(result.body);
}

/** Node-style handler for one upstream (used by the Vercel functions and the dev server). */
export function proxyHandler(name: UpstreamName, env: Env = process.env) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    send(res, await proxy(name, req.url ?? '/', req.method, env));
  };
}

export function configHandler(env: Env = process.env) {
  return (_req: IncomingMessage, res: ServerResponse) => {
    send(res, json(200, publicConfig(env)));
  };
}
