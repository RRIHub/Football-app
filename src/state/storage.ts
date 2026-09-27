import { useCallback, useEffect, useState } from 'react';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** useState that survives reloads. Storage failures (private mode etc.) are ignored. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => read(key, initial));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export function useFollowSet(key: string) {
  const [ids, setIds] = usePersistentState<number[]>(key, []);
  const isFollowing = useCallback((id: number) => ids.includes(id), [ids]);
  const toggle = useCallback(
    (id: number) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])),
    [setIds],
  );
  return { ids, isFollowing, toggle };
}
