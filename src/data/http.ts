// Shared request queue + cache for rate-limited data providers.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Client {
  /** GET `path` (relative to the client's base), reusing a cached response younger than `ttlMs`. */
  get<T>(path: string, ttlMs: number): Promise<T>;
}

export function createClient({
  base,
  maxPerMinute,
  parse = (body) => body,
}: {
  base: string;
  maxPerMinute: number;
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
      if (sent.length >= maxPerMinute) await wait(60_000 - (now - sent[0]) + 50);
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
        const res = await fetch(`${base}${path}`);
        if (res.status === 429) throw new Error('Rate limit reached – try again in a minute.');
        if (res.status === 403) throw new Error('This data is not included in your plan.');
        if (!res.ok) throw new Error(`Data request failed (${res.status})`);
        return parse(await res.json()) as T;
      });
      cache.set(path, { at: Date.now(), value });
      value.catch(() => cache.delete(path));
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

declare const __LIVE_REFRESH_SECONDS__: number;

/**
 * How often live scores are re-fetched. Each refresh is one request, so the
 * default (20s) stays well inside a 10-requests-a-minute plan.
 */
export const LIVE_REFRESH_MS =
  Math.max(5, typeof __LIVE_REFRESH_SECONDS__ === 'number' ? __LIVE_REFRESH_SECONDS__ : 20) * 1000;
