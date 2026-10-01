import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';

// Favourite teams and players and the Build XI, saved in this browser.

const DATA_KEY = 'footiq.data';

/** Favourites saved by earlier versions of the app (device accounts), to carry over once. */
export function legacyData(): Record<string, unknown> | null {
  const read = (key: string): unknown => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  };
  const id = (() => {
    try {
      return localStorage.getItem('footiq.session');
    } catch {
      return null;
    }
  })();
  if (id) {
    const saved = read(`footiq.${id}.data`);
    if (saved && typeof saved === 'object') return saved as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const [field, key] of [['teams', `footiq.${id}.teams`], ['players', `footiq.${id}.players`]] as const) {
      const v = read(key);
      if (v) data[field] = v;
    }
    const xi = read('footiq.xi');
    if (xi) data.xi = xi;
    if (Object.keys(data).length) return data;
  }
  return null;
}

export class ProfileDataStore {
  private listeners = new Set<() => void>();
  private data: Record<string, unknown>;

  constructor(private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeStorage()) {
    this.data = this.load();
  }

  private load(): Record<string, unknown> {
    try {
      const raw = this.storage?.getItem(DATA_KEY);
      if (raw) return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      /* unreadable: start empty */
    }
    return {};
  }

  get(field: string): unknown {
    return this.data[field];
  }

  set(field: string, value: unknown) {
    this.data = { ...this.data, [field]: value };
    try {
      this.storage?.setItem(DATA_KEY, JSON.stringify(this.data));
    } catch {
      /* storage full or blocked: keep it for this visit */
    }
    this.listeners.forEach((l) => l());
  }

  /** Fill in anything not set yet (used to carry over older favourites). */
  seed(values: Record<string, unknown>) {
    for (const [k, v] of Object.entries(values)) if (this.data[k] === undefined) this.set(k, v);
  }

  clear() {
    this.data = {};
    try {
      this.storage?.removeItem(DATA_KEY);
    } catch {
      /* ignore */
    }
    this.listeners.forEach((l) => l());
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const Ctx = createContext<ProfileDataStore | null>(null);

export function ProfileDataProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => new ProfileDataStore(), []);
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useProfileDataStore(): ProfileDataStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useProfileDataStore must be used inside ProfileDataProvider');
  return store;
}

/** A saved field, like useState. Invalid stored values fall back to `initial`. */
export function useProfileField<T>(field: string, initial: T, validate?: (v: unknown) => v is T) {
  const store = useProfileDataStore();
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
