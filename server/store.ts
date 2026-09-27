// Key-value storage for accounts. Production uses Redis over Upstash's REST API
// (what Vercel's Marketplace "Upstash for Redis" integration provides); local
// development uses a JSON file so accounts survive restarts.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Env } from './handlers.js';

export interface Store {
  get(key: string): Promise<string | null>;
  /** Set a value, optionally expiring after `ttlSeconds`. With `onlyIfNew`, returns false if the key exists. */
  set(key: string, value: string, opts?: { ttlSeconds?: number; onlyIfNew?: boolean }): Promise<boolean>;
  del(key: string): Promise<void>;
  /** Increment a counter, starting its expiry window when it's created. */
  incr(key: string, ttlSeconds: number): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
}

/** Redis via the Upstash REST API: POST a command as a JSON array, get `{ result }` back. */
export class RedisStore implements Store {
  constructor(
    private url: string,
    private token: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async command(...args: (string | number)[]): Promise<unknown> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new Error('Account storage could not be reached.');
    }
    const body = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
    if (!res.ok || body.error) throw new Error(`Account storage error: ${body.error ?? res.status}`);
    return body.result;
  }

  async get(key: string) {
    return ((await this.command('GET', key)) as string | null) ?? null;
  }
  async set(key: string, value: string, opts: { ttlSeconds?: number; onlyIfNew?: boolean } = {}) {
    const args: (string | number)[] = ['SET', key, value];
    if (opts.ttlSeconds) args.push('EX', opts.ttlSeconds);
    if (opts.onlyIfNew) args.push('NX');
    return (await this.command(...args)) === 'OK';
  }
  async del(key: string) {
    await this.command('DEL', key);
  }
  async incr(key: string, ttlSeconds: number) {
    const n = Number(await this.command('INCR', key));
    if (n === 1) await this.command('EXPIRE', key, ttlSeconds);
    return n;
  }
  async expire(key: string, ttlSeconds: number) {
    await this.command('EXPIRE', key, ttlSeconds);
  }
}

/** In-memory store with expiry; the file store builds on it. Also used by tests. */
export class MemoryStore implements Store {
  protected data = new Map<string, { value: string; expires?: number }>();

  protected live(key: string) {
    const e = this.data.get(key);
    if (e?.expires && e.expires <= Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }
  protected changed() {}

  async get(key: string) {
    return this.live(key)?.value ?? null;
  }
  async set(key: string, value: string, opts: { ttlSeconds?: number; onlyIfNew?: boolean } = {}) {
    if (opts.onlyIfNew && this.live(key)) return false;
    this.data.set(key, { value, expires: opts.ttlSeconds ? Date.now() + opts.ttlSeconds * 1000 : undefined });
    this.changed();
    return true;
  }
  async del(key: string) {
    this.data.delete(key);
    this.changed();
  }
  async incr(key: string, ttlSeconds: number) {
    const e = this.live(key);
    const n = (e ? Number(e.value) : 0) + 1;
    this.data.set(key, { value: String(n), expires: e?.expires ?? Date.now() + ttlSeconds * 1000 });
    this.changed();
    return n;
  }
  async expire(key: string, ttlSeconds: number) {
    const e = this.live(key);
    if (e) {
      e.expires = Date.now() + ttlSeconds * 1000;
      this.changed();
    }
  }
}

/** Development only: a MemoryStore saved to a JSON file. */
export class FileStore extends MemoryStore {
  constructor(private path: string) {
    super();
    if (existsSync(path)) {
      try {
        this.data = new Map(Object.entries(JSON.parse(readFileSync(path, 'utf8'))));
      } catch {
        /* start empty if the file is unreadable */
      }
    }
  }
  protected override changed() {
    writeFileSync(this.path, JSON.stringify(Object.fromEntries(this.data)));
  }
}

/** Whether accounts can be stored server-side here (Redis configured, or local development). */
export function hasAccountStore(env: Env): boolean {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token) || !env.VERCEL;
}

const stores = new Map<string, Store>();

/**
 * The account store for this environment, or null when none is configured on a
 * host where local files don't persist (e.g. Vercel without Redis).
 */
export function accountStore(env: Env): Store | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  const key = url && token ? `redis:${url}` : env.VERCEL ? '' : 'file';
  if (!key) return null;
  let store = stores.get(key);
  if (!store) {
    store = url && token ? new RedisStore(url, token) : new FileStore(env.FOOTIQ_DEV_DB ?? '.footiq-dev-db.json');
    stores.set(key, store);
  }
  return store;
}
