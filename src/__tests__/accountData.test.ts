import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountDataStore } from '../auth/accountData';
import type { AuthBackend, User } from '../auth/backend';
import { dataHealth } from '../data/http';

const user: User = { id: 'u1', name: 'Sam', email: 'sam@example.com', createdAt: '', onboarded: true };
const backend = (saveData: AuthBackend['saveData']) => ({ kind: 'server', saveData }) as unknown as AuthBackend;

afterEach(() => vi.useRealTimers());

describe('account data', () => {
  it('saves changes to the account shortly after they happen, in one request', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => undefined);
    const store = new AccountDataStore(backend(save), user, {});
    store.set('teams', [{ id: 1 }]);
    store.set('teams', [{ id: 1 }, { id: 2 }]);
    expect(store.get('teams')).toEqual([{ id: 1 }, { id: 2 }]);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(700);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(user, { teams: [{ id: 1 }, { id: 2 }] }, undefined);
  });

  it("says when changes aren't being saved, and retries on the next save", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('Please sign in again.')).mockResolvedValue(undefined);
    const store = new AccountDataStore(backend(save), user, {});
    store.set('xi', { name: 'A' });
    await store.save();
    expect(dataHealth.get()).toEqual([{ kind: 'account', message: 'Please sign in again.' }]);
    await store.save();
    expect(save).toHaveBeenCalledTimes(2);
    expect(dataHealth.get()).toEqual([]);
  });
});
