import { useCallback, useEffect, useReducer } from 'react';

interface Entry {
  loading: boolean;
  data?: unknown;
  error?: string;
  at: number;
}

// Shared across components so each resource is fetched once and reused.
const store = new Map<string, Entry>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function start(key: string, load: () => Promise<unknown>) {
  const prev = store.get(key);
  if (prev?.loading) return;
  store.set(key, { ...prev, loading: true, at: prev?.at ?? 0 });
  notify();
  load()
    .then((data) => store.set(key, { loading: false, data, at: Date.now() }))
    // Keep showing the last good data if a refresh fails.
    .catch((e: unknown) =>
      store.set(key, { ...store.get(key), loading: false, error: e instanceof Error ? e.message : String(e), at: Date.now() }),
    )
    .finally(notify);
}

export interface Resource<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads data once per key and shares it between components. Pass `null` as
 * the key to skip loading. `maxAgeMs` makes the data refresh on next use.
 */
export function useResource<T>(key: string | null, load: () => Promise<T>, maxAgeMs = Infinity): Resource<T> {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  useEffect(() => {
    if (!key) return;
    const e = store.get(key);
    if (!e || (!e.loading && Date.now() - e.at > maxAgeMs)) start(key, load);
    // `load` is identified by `key`; depending on its identity would refetch every render.
  }, [key, maxAgeMs]);

  const reload = useCallback(() => {
    if (key) start(key, load);
  }, [key]);

  const e = key ? store.get(key) : undefined;
  return {
    data: e?.data as T | undefined,
    error: e?.error,
    loading: Boolean(key) && (!e || e.loading),
    reload,
  };
}
