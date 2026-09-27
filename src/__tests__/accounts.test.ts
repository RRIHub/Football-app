import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const accounts = await import('../auth/accounts');

beforeEach(() => store.clear());

describe('accounts', () => {
  it('signs up, stays signed in and never stores the password', async () => {
    const user = await accounts.signUp('Sam', 'Sam@Example.com ', 'correct horse');
    expect(user).toMatchObject({ name: 'Sam', email: 'sam@example.com', onboarded: false });
    expect(accounts.currentAccount()?.id).toBe(user.id);
    const raw = store.get('footiq.accounts')!;
    expect(raw).not.toContain('correct horse');
    expect(JSON.parse(raw)[0].hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('signs in with the right password only', async () => {
    await accounts.signUp('Sam', 'sam@example.com', 'correct horse');
    accounts.signOut();
    expect(accounts.currentAccount()).toBeNull();
    await expect(accounts.signIn('sam@example.com', 'wrong password')).rejects.toThrow(/incorrect/);
    await expect(accounts.signIn('nobody@example.com', 'correct horse')).rejects.toThrow(/incorrect/);
    const user = await accounts.signIn('SAM@example.com', 'correct horse');
    expect(accounts.currentAccount()?.id).toBe(user.id);
  });

  it('rejects duplicate emails and weak input', async () => {
    await accounts.signUp('Sam', 'sam@example.com', 'correct horse');
    await expect(accounts.signUp('Sam 2', 'sam@example.com', 'another one')).rejects.toThrow(/already exists/);
    expect(accounts.validateSignUp('', 'a@b.co', '12345678')).toMatch(/name/);
    expect(accounts.validateSignUp('A', 'not-an-email', '12345678')).toMatch(/email/);
    expect(accounts.validateSignUp('A', 'a@b.co', 'short')).toMatch(/8 characters/);
  });

  it('remembers that onboarding is done', async () => {
    const user = await accounts.signUp('Sam', 'sam@example.com', 'correct horse');
    expect(accounts.markOnboarded(user.id)?.onboarded).toBe(true);
    expect(accounts.currentAccount()?.onboarded).toBe(true);
  });
});
