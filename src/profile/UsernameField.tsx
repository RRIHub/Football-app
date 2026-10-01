import { useEffect, useState } from 'react';
import { checkUsername, usernameProblem, usernamesChecked, type Profile } from './ProfileContext';

export type UsernameStatus =
  | { state: 'idle' | 'checking' | 'available' | 'unchecked' }
  | { state: 'invalid' | 'taken' | 'error'; message: string };

/** Live availability for a username, checked against the server's register as you type. */
export function useUsernameStatus(name: string, mine?: Pick<Profile, 'id' | 'secret'> | null): UsernameStatus {
  const [status, setStatus] = useState<UsernameStatus>({ state: 'idle' });
  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) return setStatus({ state: 'idle' });
    const problem = usernameProblem(trimmed);
    if (problem) return setStatus({ state: 'invalid', message: problem });
    if (!usernamesChecked()) return setStatus({ state: 'unchecked' });
    setStatus({ state: 'checking' });
    let cancelled = false;
    const t = setTimeout(() => {
      checkUsername(trimmed, mine ?? undefined)
        .then((r) => !cancelled && setStatus(r.available ? { state: 'available' } : { state: 'taken', message: r.reason ?? 'That username is taken.' }))
        .catch((e: unknown) => !cancelled && setStatus({ state: 'error', message: e instanceof Error ? e.message : String(e) }));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [name, mine]);
  return status;
}

export function UsernameField({
  value,
  onChange,
  status,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  status: UsernameStatus;
  autoFocus?: boolean;
}) {
  return (
    <label className="username-field">
      <span>Username</span>
      <span className="input-prefix">
        <span aria-hidden>@</span>
        <input
          className="input"
          value={value}
          maxLength={20}
          autoComplete="username"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-describedby="username-status"
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
      <small id="username-status" className={`username-status ${status.state}`} role="status">
        {status.state === 'checking'
          ? 'Checking…'
          : status.state === 'available'
            ? '✓ Available'
            : status.state === 'unchecked'
              ? "Usernames can't be checked for uniqueness: username storage isn't set up on the server."
              : 'message' in status
                ? status.message
                : '3–20 letters, numbers, dots or underscores.'}
      </small>
    </label>
  );
}
