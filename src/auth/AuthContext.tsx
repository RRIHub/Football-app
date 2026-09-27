import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as accounts from './accounts';
import type { PublicAccount } from './accounts';

interface AuthState {
  user: PublicAccount | null;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  finishOnboarding: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicAccount | null>(() => accounts.currentAccount());

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    setUser(await accounts.signUp(name, email, password));
  }, []);
  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await accounts.signIn(email, password));
  }, []);
  const signOut = useCallback(() => {
    accounts.signOut();
    setUser(null);
    location.hash = '#/';
  }, []);
  const finishOnboarding = useCallback(() => {
    setUser((u) => (u ? accounts.markOnboarded(u.id) : u));
  }, []);

  const value = useMemo(() => ({ user, signUp, signIn, signOut, finishOnboarding }), [user, signUp, signIn, signOut, finishOnboarding]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
