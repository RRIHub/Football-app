// The username register: the only thing FootIQ keeps on the server about
// people. It guarantees usernames are unique. Favourites stay on the device.
//
// Claiming a username stores who owns it as a profile id plus a SHA-256 of a
// secret that only the owner's device knows, so only that device can rename
// or release it. There are no passwords and no personal data.

import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Env } from './handlers.js';
import { sharedStore, type Store } from './store.js';

const RESERVED = new Set([
  'admin', 'administrator', 'footiq', 'support', 'help', 'moderator', 'mod', 'root', 'system', 'staff',
  'official', 'null', 'undefined', 'me', 'api', 'anonymous', 'guest',
]);
const CHECKS_PER_WINDOW = 120;
const CLAIMS_PER_WINDOW = 20;
const WINDOW_SECONDS = 10 * 60;

/** Why a username can't be used, or null if it's fine. Case doesn't matter for uniqueness. */
export function validateUsername(name: string): string | null {
  if (name.length < 3 || name.length > 20) return 'Usernames are 3 to 20 characters.';
  if (!/^[A-Za-z0-9_.]+$/.test(name)) return 'Use letters, numbers, dots and underscores only.';
  if (/^\.|\.$|\.\./.test(name)) return "Dots can't start or end a username, or come in pairs.";
  if (RESERVED.has(name.toLowerCase())) return 'That username is reserved.';
  return null;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const key = (name: string) => `username:${name.toLowerCase()}`;

interface Owner {
  profileId: string;
  secretHash: string;
  display: string;
  claimedAt: string;
}

export interface Result {
  status: number;
  body: unknown;
}
const fail = (status: number, error: string): Result => ({ status, body: { error } });

export class Usernames {
  constructor(private store: Store) {}

  private async owner(name: string): Promise<Owner | null> {
    const raw = await this.store.get(key(name));
    return raw ? (JSON.parse(raw) as Owner) : null;
  }

  private static owns(o: Owner, profileId: string, secret: string): boolean {
    const a = Buffer.from(o.secretHash, 'hex');
    const b = Buffer.from(sha256(secret), 'hex');
    return o.profileId === profileId && a.length === b.length && timingSafeEqual(a, b);
  }

  async handle(action: string, method: string, body: Record<string, unknown>, query: URLSearchParams, ip: string): Promise<Result> {
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

    if (method === 'GET' && action === 'check') {
      if ((await this.store.incr(`rate:check:${sha256(ip)}`, WINDOW_SECONDS)) > CHECKS_PER_WINDOW)
        return fail(429, 'Too many checks. Wait a few minutes and try again.');
      const name = str(query.get('username'));
      const problem = validateUsername(name);
      if (problem) return { status: 200, body: { available: false, reason: problem } };
      const taken = await this.owner(name);
      const mine = taken && Usernames.owns(taken, str(query.get('profileId')), str(query.get('secret')));
      return { status: 200, body: taken && !mine ? { available: false, reason: 'That username is taken.' } : { available: true } };
    }

    if (method === 'POST' && (action === 'claim' || action === 'release')) {
      const [name, profileId, secret] = [str(body.username), str(body.profileId), str(body.secret)];
      if (!/^[\w-]{8,64}$/.test(profileId) || secret.length < 32 || secret.length > 128) return fail(400, 'Invalid profile.');
      if (action === 'release') {
        const o = await this.owner(name);
        if (o && Usernames.owns(o, profileId, secret)) await this.store.del(key(name));
        return { status: 200, body: { ok: true } };
      }
      if ((await this.store.incr(`rate:claim:${sha256(ip)}`, WINDOW_SECONDS)) > CLAIMS_PER_WINDOW)
        return fail(429, 'Too many attempts. Wait a few minutes and try again.');
      const problem = validateUsername(name);
      if (problem) return fail(400, problem);
      const record: Owner = { profileId, secretHash: sha256(secret), display: name, claimedAt: new Date().toISOString() };
      // Atomic: two people can't claim the same name at once.
      if (await this.store.set(key(name), JSON.stringify(record), { onlyIfNew: true })) return { status: 201, body: { ok: true } };
      const o = await this.owner(name);
      if (o && Usernames.owns(o, profileId, secret)) {
        // Already yours (e.g. changing the capitalisation).
        await this.store.set(key(name), JSON.stringify({ ...o, display: name }));
        return { status: 200, body: { ok: true } };
      }
      return fail(409, 'That username is taken.');
    }

    return fail(404, 'Unknown action.');
  }
}

/* ---------- Node handler (Vercel function and dev server) ---------- */

/** Rejects cross-site writes: a browser always sends Origin on POST. */
export function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  // Vercel's Node runtime may have parsed the body already.
  const pre = (req as IncomingMessage & { body?: unknown }).body;
  if (pre !== undefined) return (typeof pre === 'string' || Buffer.isBuffer(pre) ? JSON.parse(String(pre) || '{}') : pre) as Record<string, unknown>;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4096) throw new Error('too large');
  }
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

export function profileHandler(env: Env = process.env) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const reply = ({ status, body }: Result) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    const store = sharedStore(env);
    if (!store)
      return reply(fail(503, "Username storage isn't set up on the server. Add Upstash Redis to this project (Vercel → Storage), then redeploy."));
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://localhost');
    let body: Record<string, unknown> = {};
    if (method !== 'GET') {
      if (!sameOrigin(req)) return reply(fail(403, 'Cross-site request refused.'));
      if (!String(req.headers['content-type'] ?? '').includes('application/json')) return reply(fail(415, 'Send JSON.'));
      try {
        body = await readBody(req);
      } catch {
        return reply(fail(400, 'Invalid request body.'));
      }
    }
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket?.remoteAddress || '';
    try {
      reply(await new Usernames(store).handle(url.searchParams.get('action') ?? '', method, body, url.searchParams, ip));
    } catch (e) {
      reply(fail(503, e instanceof Error ? e.message : 'Username service error.'));
    }
  };
}
