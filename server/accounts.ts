// Account API: sign up, sign in, sign out, current user and per-account data
// (favourites, Build XI). Served as one route, /api/account?action=…, so it
// counts as a single serverless function.
//
// Passwords are hashed with scrypt. Sessions are random tokens in an HttpOnly
// cookie; only a SHA-256 of the token is stored, and each visit renews it, so
// people stay signed in until they sign out or are away for 30 days.

import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { promisify } from 'node:util';
import type { Env } from './handlers.js';
import { accountStore, type Store } from './store.js';

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'footiq_session';
export const SESSION_DAYS = 30;
const SESSION_SECONDS = SESSION_DAYS * 24 * 3600;
const MAX_DATA_BYTES = 64 * 1024;
const LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  onboarded: boolean;
}
interface StoredUser extends User {
  salt: string;
  hash: string;
}

export interface Result {
  status: number;
  body: unknown;
  /** Set-Cookie header value, if the response changes the session. */
  cookie?: string;
}

const fail = (status: number, error: string): Result => ({ status, body: { error } });
const publicUser = ({ salt: _s, hash: _h, ...user }: StoredUser): User => user;
const normaliseEmail = (email: string) => email.trim().toLowerCase();
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function validateSignUp(name: string, email: string, password: string): string | null {
  if (!name.trim() || name.trim().length > 60) return 'Enter your name (up to 60 characters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 200) return 'Enter a valid email address.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 200) return 'Password must be at most 200 characters.';
  return null;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  return (await scrypt(password, Buffer.from(salt, 'hex'), 64)).toString('hex');
}

async function passwordMatches(password: string, user: StoredUser): Promise<boolean> {
  const actual = Buffer.from(await hashPassword(password, user.salt), 'hex');
  const expected = Buffer.from(user.hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sessionCookie(token: string, secure: boolean, maxAge = SESSION_SECONDS): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

export interface AccountRequest {
  action: string;
  method: string;
  cookie?: string;
  body?: unknown;
  /** Client address, for rate limiting sign-in attempts. */
  ip?: string;
  secure: boolean;
}

export class Accounts {
  constructor(private store: Store) {}

  private async user(id: string): Promise<StoredUser | null> {
    const raw = await this.store.get(`user:${id}`);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  }

  private async startSession(userId: string, secure: boolean): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.store.set(`session:${sha256(token)}`, userId, { ttlSeconds: SESSION_SECONDS });
    return sessionCookie(token, secure);
  }

  /** The signed-in user, renewing the session so active users stay signed in. */
  private async sessionUser(req: AccountRequest): Promise<{ user: StoredUser; cookie: string } | null> {
    const token = readCookie(req.cookie, SESSION_COOKIE);
    if (!token || !/^[\w-]{20,100}$/.test(token)) return null;
    const key = `session:${sha256(token)}`;
    const userId = await this.store.get(key);
    const user = userId ? await this.user(userId) : null;
    if (!user) return null;
    await this.store.expire(key, SESSION_SECONDS);
    return { user, cookie: sessionCookie(token, req.secure) };
  }

  async handle(req: AccountRequest): Promise<Result> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) : '');

    switch (`${req.method} ${req.action}`) {
      case 'GET me': {
        const s = await this.sessionUser(req);
        return s ? { status: 200, body: { user: publicUser(s.user) }, cookie: s.cookie } : { status: 200, body: { user: null } };
      }

      case 'POST signup': {
        const [name, email, password] = [str('name').trim(), normaliseEmail(str('email')), str('password')];
        const problem = validateSignUp(name, email, password);
        if (problem) return fail(400, problem);
        const id = randomUUID();
        // Claiming the email atomically stops two sign-ups racing for the same address.
        if (!(await this.store.set(`email:${email}`, id, { onlyIfNew: true })))
          return fail(409, 'An account with that email already exists. Sign in instead.');
        const salt = randomBytes(16).toString('hex');
        const user: StoredUser = {
          id,
          name,
          email,
          createdAt: new Date().toISOString(),
          onboarded: false,
          salt,
          hash: await hashPassword(password, salt),
        };
        await this.store.set(`user:${id}`, JSON.stringify(user));
        return { status: 201, body: { user: publicUser(user) }, cookie: await this.startSession(id, req.secure) };
      }

      case 'POST login': {
        const email = normaliseEmail(str('email'));
        const password = str('password');
        if (!email || !password) return fail(400, 'Enter your email and password.');
        const attemptsKey = `login-attempts:${sha256(`${email}|${req.ip ?? ''}`)}`;
        const attempts = await this.store.incr(attemptsKey, LOGIN_WINDOW_SECONDS);
        if (attempts > LOGIN_ATTEMPTS) return fail(429, 'Too many sign-in attempts. Wait 15 minutes and try again.');
        const id = await this.store.get(`email:${email}`);
        const user = id ? await this.user(id) : null;
        // Same message either way, so the form doesn't reveal which emails have accounts.
        if (!user || !(await passwordMatches(password, user))) return fail(401, 'Email or password is incorrect.');
        await this.store.del(attemptsKey);
        return { status: 200, body: { user: publicUser(user) }, cookie: await this.startSession(user.id, req.secure) };
      }

      case 'POST logout': {
        const token = readCookie(req.cookie, SESSION_COOKIE);
        if (token) await this.store.del(`session:${sha256(token)}`);
        return { status: 200, body: { ok: true }, cookie: sessionCookie('', req.secure, 0) };
      }

      case 'POST onboarded': {
        const s = await this.sessionUser(req);
        if (!s) return fail(401, 'Please sign in again.');
        const user = { ...s.user, onboarded: true };
        await this.store.set(`user:${user.id}`, JSON.stringify(user));
        return { status: 200, body: { user: publicUser(user) }, cookie: s.cookie };
      }

      case 'GET data': {
        const s = await this.sessionUser(req);
        if (!s) return fail(401, 'Please sign in again.');
        const raw = await this.store.get(`data:${s.user.id}`);
        return { status: 200, body: { data: raw ? JSON.parse(raw) : {} }, cookie: s.cookie };
      }

      case 'PUT data': {
        const s = await this.sessionUser(req);
        if (!s) return fail(401, 'Please sign in again.');
        const data = body.data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) return fail(400, 'Invalid data.');
        const json = JSON.stringify(data);
        if (json.length > MAX_DATA_BYTES) return fail(413, 'Too much data to save.');
        await this.store.set(`data:${s.user.id}`, json);
        return { status: 200, body: { ok: true }, cookie: s.cookie };
      }

      default:
        return fail(404, 'Unknown account action.');
    }
  }
}

/* ---------- Node handler (Vercel function and dev server) ---------- */

async function readBody(req: IncomingMessage): Promise<unknown> {
  // Vercel's Node runtime may have parsed the body already.
  const pre = (req as IncomingMessage & { body?: unknown }).body;
  if (pre !== undefined) return typeof pre === 'string' || Buffer.isBuffer(pre) ? JSON.parse(String(pre) || '{}') : pre;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_DATA_BYTES * 2) throw new Error('too large');
  }
  return raw ? JSON.parse(raw) : {};
}

function reply(res: ServerResponse, result: Result) {
  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (result.cookie) res.setHeader('Set-Cookie', result.cookie);
  res.end(JSON.stringify(result.body));
}

/** Rejects cross-site writes: a browser always sends Origin on POST/PUT. */
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

export function accountHandler(env: Env = process.env) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const store = accountStore(env);
    if (!store)
      return reply(
        res,
        fail(
          503,
          "Account storage isn't set up on the server. Add Upstash Redis to this project (Vercel → Storage), then redeploy.",
        ),
      );
    const method = req.method ?? 'GET';
    const action = new URL(req.url ?? '/', 'http://localhost').searchParams.get('action') ?? '';
    if (method !== 'GET') {
      if (!sameOrigin(req)) return reply(res, fail(403, 'Cross-site request refused.'));
      if (!String(req.headers['content-type'] ?? '').includes('application/json'))
        return reply(res, fail(415, 'Send JSON.'));
    }
    let body: unknown;
    try {
      body = method === 'GET' ? undefined : await readBody(req);
    } catch {
      return reply(res, fail(400, 'Invalid request body.'));
    }
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
    try {
      reply(
        res,
        await new Accounts(store).handle({
          action,
          method,
          body,
          cookie: req.headers.cookie,
          ip: forwarded || req.socket?.remoteAddress,
          secure: req.headers['x-forwarded-proto'] === 'https' || Boolean(env.VERCEL),
        }),
      );
    } catch (e) {
      reply(res, fail(503, e instanceof Error ? e.message : 'Account service error.'));
    }
  };
}
