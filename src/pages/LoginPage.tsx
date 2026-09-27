import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') await signUp(name, email, password);
      else await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const switchMode = (m: 'signin' | 'signup') => {
    setMode(m);
    setError(null);
  };

  return (
    <div className="login">
      <div className="login-card panel">
        <h1 className="brand login-brand">
          Foot<span>IQ</span>
        </h1>
        <p className="muted login-tag">Scores, stats, news and transfers for the clubs and players you love.</p>

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'active' : ''} onClick={() => switchMode('signin')}>
            Sign in
          </button>
          <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>
            Create account
          </button>
        </div>

        <form onSubmit={submit} className="login-form">
          {mode === 'signup' && (
            <label>
              <span>Name</span>
              <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
          )}
          <label>
            <span>Email</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              className="input"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={mode === 'signup' ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {mode === 'signup' && <small className="muted">At least 8 characters.</small>}
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn wide" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="muted small login-note">Your account and favourites are saved on this device.</p>
      </div>
    </div>
  );
}
