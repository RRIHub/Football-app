import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AccountDataProvider } from './auth/accountData';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { fetchConfig, setConfig } from './config';
import { LoginPage } from './pages/LoginPage';
import { AppProvider } from './state/AppContext';
import './styles.css';

function Gate() {
  const { backend, user } = useAuth();
  if (!user) return <LoginPage />;
  return (
    // Keyed by account so switching users starts from a clean slate.
    <AccountDataProvider key={user.id} backend={backend} user={user}>
      <AppProvider userId={user.id}>
        <App />
      </AppProvider>
    </AccountDataProvider>
  );
}

/**
 * Loads the server's config (which data sources have keys) before anything
 * else. If the server can't be reached we say so, rather than quietly
 * showing demo data in place of live scores.
 */
function Bootstrap() {
  const [state, setState] = useState<'loading' | 'ready' | { error: string }>('loading');
  const load = useCallback(() => {
    setState('loading');
    fetchConfig()
      .then((config) => {
        setConfig(config);
        setState('ready');
      })
      .catch((e: unknown) => setState({ error: e instanceof Error ? e.message : String(e) }));
  }, []);
  useEffect(load, [load]);

  if (state === 'ready')
    return (
      <AuthProvider>
        <Gate />
      </AuthProvider>
    );
  return (
    <div className="splash">
      <h1 className="brand">
        Foot<span>IQ</span>
      </h1>
      {state === 'loading' ? (
        <p className="muted">Connecting…</p>
      ) : (
        <div className="error-box splash-error" role="alert">
          <p>
            <strong>Live data is unavailable.</strong>
          </p>
          <p>{state.error}</p>
          <button className="btn" onClick={load}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
