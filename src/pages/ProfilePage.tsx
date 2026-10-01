import { useState, type FormEvent } from 'react';
import { countryByCode } from '../profile/countries';
import { NationalityPicker } from '../profile/NationalityPicker';
import { useProfile } from '../profile/ProfileContext';
import { UsernameField, useUsernameStatus } from '../profile/UsernameField';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';

export function ProfilePage() {
  const { profile, rename, setNationality, startOver } = useProfile();
  const { followedTeams, followedPlayers } = useApp();
  const [name, setName] = useState(profile?.username ?? '');
  const status = useUsernameStatus(name, profile);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const nation = countryByCode(profile.nationality);
  const changed = name.trim() !== profile.username;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await rename(name.trim());
      setMessage({ ok: true, text: 'Username saved.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="panel profile-card">
        <div className="row gap">
          <span className="avatar big" aria-hidden>
            {profile.username.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1>@{profile.username}</h1>
            <p className="muted">
              {nation ? (
                <>
                  <span aria-hidden>{nation.flag}</span> {nation.name}
                </>
              ) : (
                'No nationality set'
              )}
              {' · '}
              {followedTeams.items.length} teams · {followedPlayers.items.length} players
            </p>
          </div>
        </div>
        <a className="btn" href={href.favourites}>
          Edit favourite teams &amp; players
        </a>
      </section>

      <section className="panel">
        <h2>Username</h2>
        <form onSubmit={save} className="login-form">
          <UsernameField value={name} onChange={setName} status={changed ? status : { state: 'idle' }} />
          {message && (
            <p className={message.ok ? 'form-ok' : 'form-error'} role="status">
              {message.text}
            </p>
          )}
          <div>
            <button className="btn" type="submit" disabled={!changed || busy || !(status.state === 'available' || status.state === 'unchecked')}>
              {busy ? 'Saving…' : 'Change username'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Nationality</h2>
        <NationalityPicker value={profile.nationality} onChange={(code) => setNationality(code)} />
      </section>

      <section className="panel">
        <h2>Start over</h2>
        <p className="muted">
          Frees up your username and clears your favourites and Build XI on this device. Then you can set up a new
          profile.
        </p>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Clear your profile, favourites and Build XI on this device?')) void startOver();
          }}
        >
          Start over
        </button>
      </section>
    </>
  );
}
