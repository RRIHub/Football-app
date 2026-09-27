import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { reportProblem } from '../data/http';
import { deviceAccountDataFor, type AccountData, type AuthBackend, type User } from './backend';

const SAVE_DELAY_MS = 600;

/**
 * The signed-in account's data (favourites, Build XI). Changes show at once
 * and are saved to the account shortly after, so they follow the person to
 * any device they sign in on.
 */
export class AccountDataStore {
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;

  constructor(
    private backend: AuthBackend,
    private user: User,
    private data: AccountData,
  ) {}

  get(field: string): unknown {
    return this.data[field];
  }

  set(field: string, value: unknown) {
    this.data = { ...this.data, [field]: value };
    this.listeners.forEach((l) => l());
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save(), SAVE_DELAY_MS);
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };

  /** Save now; `keepalive` lets it finish while the page closes. */
  async save(opts?: { keepalive?: boolean }) {
    clearTimeout(this.timer);
    if (!this.dirty) return;
    this.dirty = false;
    try {
      await this.backend.saveData(this.user, this.data, opts);
      reportProblem('account', null, 'account');
    } catch (e) {
      this.dirty = true;
      reportProblem('account', e instanceof Error ? e.message : String(e), 'account');
    }
  }
}

const Ctx = createContext<AccountDataStore | null>(null);

/** Run before signing out, so pending changes are saved while the session still exists. */
export const beforeSignOut = new Set<() => Promise<void>>();

/**
 * Loads the account's data before showing the app. If the account is new on
 * the server but this browser has favourites from a device-only account with
 * the same email, they're brought across.
 */
export function AccountDataProvider({ backend, user, children }: { backend: AuthBackend; user: User; children: ReactNode }) {
  const [state, setState] = useState<AccountDataStore | { error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The user object changes when e.g. onboarding finishes; only a different
  // person (or a retry) should reload, or changes still waiting to save are lost.
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    let cancelled = false;
    const user = userRef.current;
    setState(null);
    (async () => {
      let data = await backend.loadData(user);
      const imported = backend.kind === 'server' && !Object.keys(data).length ? deviceAccountDataFor(user.email) : null;
      if (imported) data = imported;
      const store = new AccountDataStore(backend, user, data);
      if (imported) for (const [k, v] of Object.entries(imported)) store.set(k, v);
      return store;
    })()
      .then((store) => !cancelled && setState(store))
      .catch((e: unknown) => !cancelled && setState({ error: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
    };
  }, [backend, user.id, attempt]);

  // Don't lose a change made just before the tab closes or the person signs out.
  useEffect(() => {
    if (!(state instanceof AccountDataStore)) return;
    const flush = () => void state.save({ keepalive: true });
    const beforeOut = () => state.save();
    window.addEventListener('pagehide', flush);
    beforeSignOut.add(beforeOut);
    return () => {
      window.removeEventListener('pagehide', flush);
      beforeSignOut.delete(beforeOut);
      // Save anything pending before this store is replaced.
      void state.save();
    };
  }, [state]);

  if (state instanceof AccountDataStore) return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
  return (
    <div className="splash">
      <h1 className="brand">
        Foot<span>IQ</span>
      </h1>
      {state?.error ? (
        <div className="error-box splash-error" role="alert">
          <p>
            <strong>Couldn't load your account.</strong>
          </p>
          <p>{state.error}</p>
          <button className="btn" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <p className="muted">Loading your account…</p>
      )}
    </div>
  );
}

/** A field of the account's data, like useState. Invalid stored values fall back to `initial`. */
export function useAccountField<T>(field: string, initial: T, validate?: (v: unknown) => v is T) {
  const store = useContext(Ctx);
  if (!store) throw new Error('useAccountField must be used inside AccountDataProvider');
  const raw = useSyncExternalStore(store.subscribe, () => store.get(field));
  const value = raw === undefined || (validate && !validate(raw)) ? initial : (raw as T);
  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const current = store.get(field);
      const prev = current === undefined || (validate && !validate(current)) ? initial : (current as T);
      store.set(field, typeof next === 'function' ? (next as (p: T) => T)(prev) : next);
    },
    // `initial` and `validate` are fixed per call site.
    [store, field],
  );
  return [value, setValue] as const;
}
