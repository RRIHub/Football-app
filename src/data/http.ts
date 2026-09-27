// Shared request queue + cache for rate-limited data providers, plus a small
// store of the latest data error so the app can say when live data is failing.

import { getConfig } from '../config';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Client {
  /** GET `path` via the client's server route, reusing a cached response younger than `ttlMs`. */
  get<T>(path: string, ttlMs: number): Promise<T>;
}

/* ---------- live-data health ---------- */

type Listener = () => void;
// Latest error per server route, so news working doesn't hide scores failing.
const errors = new Map<string, string>();
let snapshot: string | null = null;
const listeners = new Set<Listener>();

export const dataHealth = {
  /** The current error message, or null when every data source is healthy. */
  get: () => snapshot,
  subscribe(l: Listener) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};

function report(route: string, error: string | null) {
  if ((errors.get(route) ?? null) === error) return;
  if (error) errors.set(route, error);
  else errors.delete(route);
  snapshot = errors.size ? [...errors.values()].join(' ') : null;
  listeners.forEach((l) => l());
}

/** Reads the server's `{ error }` message, falling back to the status code. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === 'string') return body.error;
  } catch {
    /* not JSON */
  }
  if (res.status === 404) return 'The data service was not found (404). Check that the /api functions are deployed.';
  return `Data request failed (${res.status}).`;
}

/* ---------- client ---------- */

export function createClient({
  route,
  maxPerMinute,
  parse = (body) => body,
}: {
  /** Server route that forwards to the provider, e.g. "/api/football-data". */
  route: string;
  maxPerMinute: () => number;
  /** Validate/unwrap a JSON body; throw to report a provider error. */
  parse?: (body: unknown) => unknown;
}): Client {
  const sent: number[] = [];
  let queue: Promise<unknown> = Promise.resolve();
  const cache = new Map<string, { at: number; value: Promise<unknown> }>();

  // Serialise requests so we never exceed the plan's per-minute limit.
  const throttled = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(async () => {
      const now = Date.now();
      while (sent.length && now - sent[0] > 60_000) sent.shift();
      if (sent.length >= maxPerMinute()) await wait(60_000 - (now - sent[0]) + 50);
      sent.push(Date.now());
      return fn();
    });
    queue = run.catch(() => undefined);
    return run;
  };

  return {
    get<T>(path: string, ttlMs: number): Promise<T> {
      const hit = cache.get(path);
      if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
      const value = throttled(async () => {
        let res: Response;
        try {
          res = await fetch(`${route}?path=${encodeURIComponent(path)}`);
        } catch {
          throw new Error("Couldn't reach the FootIQ server. Check your connection.");
        }
        if (!res.ok) throw new Error(await errorMessage(res));
        return parse(await res.json()) as T;
      });
      cache.set(path, { at: Date.now(), value });
      value.then(
        () => report(route, null),
        (e: unknown) => {
          cache.delete(path);
          report(route, e instanceof Error ? e.message : String(e));
        },
      );
      return value;
    },
  };
}

export const MIN = 60_000;

/** Stable colour for teams whose provider doesn't supply club colours. */
export function colorFor(id: number): string {
  const palette = ['#d7263d', '#1d4ed8', '#15803d', '#7a263a', '#f59e0b', '#0e7490', '#6b21a8', '#be185d', '#475569', '#b45309'];
  return palette[Math.abs(id) % palette.length];
}

/** YYYY-MM-DD for a date in the given IANA time zone. */
export function localDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/**
 * How often live scores are re-fetched. Each refresh is one request, so the
 * default (20s) stays well inside a 10-requests-a-minute plan.
 */
export function liveRefreshMs(): number {
  return Math.max(5, getConfig().liveRefreshSeconds) * 1000;
}
