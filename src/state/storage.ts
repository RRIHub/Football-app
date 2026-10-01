import { useCallback, useEffect, useState } from 'react';
import { useProfileField } from '../profile/profileData';

function read<T>(key: string, fallback: T, validate?: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    return !validate || validate(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

/** useState that survives reloads. Storage failures (private mode etc.) are ignored. */
export function usePersistentState<T>(key: string, initial: T, validate?: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(() => read(key, initial, validate));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

const isSnapshotList = <T,>(v: unknown): v is T[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'object' && x !== null && 'id' in x && 'name' in x);

const NO_ITEMS: never[] = [];

/**
 * A followed list, saved on this device with your profile. It keeps a small
 * snapshot of each item (name, club, league) so the feed can render before
 * that item's competition has loaded.
 */
export function useFollowList<T extends { id: number }>(field: 'teams' | 'players') {
  const [items, setItems] = useProfileField<T[]>(field, NO_ITEMS, isSnapshotList<T>);
  const isFollowing = useCallback((id: number) => items.some((x) => x.id === id), [items]);
  const toggle = useCallback(
    (item: T) => setItems((cur) => (cur.some((x) => x.id === item.id) ? cur.filter((x) => x.id !== item.id) : [...cur, item])),
    [setItems],
  );
  return { items, ids: items.map((x) => x.id), isFollowing, toggle };
}
