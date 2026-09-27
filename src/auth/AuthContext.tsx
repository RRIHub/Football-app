import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { reportProblem } from '../data/http';
import { beforeSignOut } from './accountData';
import { selectBackend, type AuthBackend, type User } from './backend';

interface AuthState {
  backend: AuthBackend;
  user: User | null;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  finishOnboarding: () => void;
}

const Ctx = createContext<AuthState | null>(null);

type Status = { state: 'loading' } | { state: 'ready'; user: User | null } | { state: 'error'; error: string };

/**
 * Restores the session on load (the server keeps people signed in for 30
 * days, renewed on every visit), then provides sign in / sign up / sign out.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const backend = useMemo(selectBackend, []);
  const [status, setStatus] = useState<Status>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus({ state: 'loading' });
    backend
      .current()
      .then((user) => !cancelled && setStatus({ state: 'ready', user }))
      .catch((e: unknown) => !cancelled && setStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
    };
  }, [backend, attempt]);

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      setStatus({ state: 'ready', user: await backend.signUp(name, email, password) });
    },
    [backend],
  );
  const signIn = useCallback(
    async (email: string, password: string) => {
      setStatus({ state: 'ready', user: await backend.signIn(email, password) });
    },
    [backend],
  );
  const signOut = useCallback(async () => {
    try {
      await Promise.all([...beforeSignOut].map((save) => save().catch(() => undefined)));
      await backend.signOut();
    } finally {
      setStatus({ state: 'ready', user: null });
      location.hash = '#/';
    }
  }, [backend]);
  const finishOnboarding = useCallback(() => {
    // Show the app straight away; the server is told in the background.
    setStatus((s) => (s.state === 'ready' && s.user ? { state: 'ready', user: { ...s.user, onboarded: true } } : s));
    backend.markOnboarded().catch((e: unknown) => reportProblem('onboarding', e instanceof Error ? e.message : String(e), 'account'));
  }, [backend]);

  const user = status.state === 'ready' ? status.user : null;
  // Warnings about saving belong to whoever was signed in.
  const userId = user?.id;
  useEffect(() => {
    reportProblem('account', null, 'account');
    reportProblem('onboarding', null, 'account');
  }, [userId]);
  const value = useMemo(
    () => ({ backend, user, signUp, signIn, signOut, finishOnboarding }),
    [backend, user, signUp, signIn, signOut, finishOnboarding],
  );

  if (status.state !== 'ready')
    return (
      <div className="splash">
        <h1 className="brand">
          Foot<span>IQ</span>
        </h1>
        {status.state === 'loading' ? (
          <p className="muted">Signing you in…</p>
        ) : (
          <div className="error-box splash-error" role="alert">
            <p>
              <strong>Couldn't check whether you're signed in.</strong>
            </p>
            <p>{status.error}</p>
            <button className="btn" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </div>
        )}
      </div>
    );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
