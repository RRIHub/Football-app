import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { fetchConfig, setConfig } from './config';
import { SetupPage } from './pages/SetupPage';
import { ProfileDataProvider } from './profile/profileData';
import { ProfileProvider, useProfile } from './profile/ProfileContext';
import { AppProvider } from './state/AppContext';
import './styles.css';

function Gate() {
  const { profile } = useProfile();
  return (
    <AppProvider userId={profile?.id ?? 'new'}>
      {/* First visit (or set-up not finished): username, nationality, favourites. */}
      {profile?.setupDone ? <App /> : <SetupPage />}
    </AppProvider>
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
      <ProfileDataProvider>
        <ProfileProvider>
          <Gate />
        </ProfileProvider>
      </ProfileDataProvider>
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
