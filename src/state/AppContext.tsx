import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { provider, type FootballData, type Player, type Team } from '../data';
import { useFollowSet } from './storage';

interface AppState {
  data: FootballData;
  source: 'live' | 'demo';
  team: (id: number | undefined) => Team | undefined;
  player: (id: number | undefined) => Player | undefined;
  followedTeams: ReturnType<typeof useFollowSet>;
  followedPlayers: ReturnType<typeof useFollowSet>;
}

const Ctx = createContext<AppState | null>(null);

const LIVE_POLL_MS = 60_000;

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FootballData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const followedTeams = useFollowSet('footiq.followedTeams');
  const followedPlayers = useFollowSet('footiq.followedPlayers');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    provider
      .load()
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Keep scores fresh while any match is in play.
  const hasLive = data?.matches.some((m) => m.status === 'LIVE') ?? false;
  useEffect(() => {
    if (!hasLive || provider.id !== 'live') return;
    const timer = setInterval(() => {
      provider
        .loadMatches()
        .then((matches) => setData((d) => (d ? { ...d, matches, fetchedAt: new Date().toISOString() } : d)))
        .catch(() => {
          /* keep showing the last good scores */
        });
    }, LIVE_POLL_MS);
    return () => clearInterval(timer);
  }, [hasLive]);

  const value = useMemo<AppState | null>(() => {
    if (!data) return null;
    const teams = new Map(data.teams.map((t) => [t.id, t]));
    const players = new Map(data.players.map((p) => [p.id, p]));
    return {
      data,
      source: provider.id,
      team: (id) => (id === undefined ? undefined : teams.get(id)),
      player: (id) => (id === undefined ? undefined : players.get(id)),
      followedTeams,
      followedPlayers,
    };
  }, [data, followedTeams, followedPlayers]);

  if (error)
    return (
      <div className="splash">
        <h1 className="brand">Foot<span>IQ</span></h1>
        <p>Couldn't load football data: {error}</p>
        <button className="btn" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
      </div>
    );
  if (!value)
    return (
      <div className="splash">
        <h1 className="brand">Foot<span>IQ</span></h1>
        <p className="muted">Loading the latest scores…</p>
      </div>
    );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
