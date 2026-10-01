import { useState, type FormEvent } from 'react';
import { NationalityPicker } from '../profile/NationalityPicker';
import { useProfile } from '../profile/ProfileContext';
import { UsernameField, useUsernameStatus } from '../profile/UsernameField';
import { FavouritesPicker } from './FavouritesPicker';

const TOTAL_STEPS = 4;

/** First visit: pick a unique username, your nationality, then favourite teams and players. */
export function SetupPage() {
  const { profile, create, setNationality, finishSetup } = useProfile();
  // Resume where set-up was left: past step 1 once a username is reserved.
  const [step, setStep] = useState<'username' | 'nationality' | 'favourites'>(profile ? 'nationality' : 'username');

  return (
    <main className="container onboarding">
      <h1 className="brand">
        Foot<span>IQ</span>
      </h1>
      {step === 'username' ? (
        <UsernameStep onDone={() => setStep('nationality')} create={create} initial={profile?.username ?? ''} />
      ) : step === 'nationality' ? (
        <section className="panel picker-step">
          <p className="step-count muted small">Step 2 of {TOTAL_STEPS}</p>
          <h2>Where are you from, @{profile?.username}?</h2>
          <p className="muted">Your nationality. We'll suggest your national team to follow.</p>
          <NationalityPicker value={profile?.nationality} onChange={(code) => setNationality(code)} />
          <div className="step-actions">
            <button className="btn ghost" onClick={() => setStep('username')}>
              Back
            </button>
            <button className="btn" onClick={() => setStep('favourites')}>
              {profile?.nationality ? 'Next: favourite teams' : 'Skip for now'}
            </button>
          </div>
        </section>
      ) : (
        <FavouritesPicker
          welcomeName={profile?.username}
          firstStep={3}
          totalSteps={TOTAL_STEPS}
          onBack={() => setStep('nationality')}
          onDone={finishSetup}
        />
      )}
    </main>
  );
}

function UsernameStep({ initial, create, onDone }: { initial: string; create: (u: string) => Promise<void>; onDone: () => void }) {
  const { profile } = useProfile();
  const [name, setName] = useState(initial);
  const status = useUsernameStatus(name, profile);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = status.state === 'available' || status.state === 'unchecked';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await create(name.trim());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel picker-step">
      <p className="step-count muted small">Step 1 of {TOTAL_STEPS}</p>
      <h2>Welcome to FootIQ</h2>
      <p className="muted">
        Choose a username. It's unique to you, and it's all we need: no email or password. Your favourites are saved on
        this device.
      </p>
      <form onSubmit={submit} className="login-form">
        <UsernameField value={name} onChange={setName} status={status} autoFocus />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="step-actions">
          <button className="btn" type="submit" disabled={!ready || busy}>
            {busy ? 'Saving…' : 'Next: nationality'}
          </button>
        </div>
      </form>
    </section>
  );
}
