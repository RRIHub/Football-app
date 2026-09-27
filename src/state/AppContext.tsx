import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { liveRefreshMs } from '../data/http';
import {
  news,
  provider,
  type Competition,
  type CompetitionData,
  type CompetitionRef,
  type Match,
  type NewsItem,
  type Player,
  type Position,
  type Team,
  type TeamData,
  type TeamRef,
  type Transfer,
} from '../data';
import { useResource } from './resource';
import { useFollowList } from './storage';

export type FollowedTeam = TeamRef & { league?: CompetitionRef; national?: boolean };
export interface FollowedPlayer {
  id: number;
  name: string;
  position: Position;
  team: TeamRef;
  competition: CompetitionRef;
}

export const followTeam = (t: Team | FollowedTeam): FollowedTeam => ({
  id: t.id,
  name: t.name,
  shortName: t.shortName,
  tla: t.tla,
  crest: t.crest,
  color: t.color,
  league: t.league,
  national: t.national,
});
export const followPlayer = (p: Player): FollowedPlayer => ({
  id: p.id,
  name: p.name,
  position: p.position,
  team: p.team,
  competition: p.competition,
});

interface AppState {
  source: typeof provider.id;
  userId: string;
  competitions: Competition[];
  competition: (code: string | undefined) => Competition | undefined;
  followedTeams: ReturnType<typeof useFollowList<FollowedTeam>>;
  followedPlayers: ReturnType<typeof useFollowList<FollowedPlayer>>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ userId, children }: { userId: string; children: ReactNode }) {
  // Favourites belong to the signed-in account and are saved with it.
  const followedTeams = useFollowList<FollowedTeam>('teams');
  const followedPlayers = useFollowList<FollowedPlayer>('players');
  const comps = useResource<Competition[]>('competitions', () => provider.listCompetitions());

  const value = useMemo<AppState | null>(() => {
    if (!comps.data) return null;
    const list = comps.data;
    const byCode = new Map(list.map((c) => [c.code, c]));
    return {
      source: provider.id,
      userId,
      competitions: list,
      competition: (code) => (code ? byCode.get(code) : undefined),
      followedTeams,
      followedPlayers,
    };
  }, [comps.data, userId, followedTeams, followedPlayers]);

  if (!value)
    return (
      <div className="splash">
        <h1 className="brand">
          Foot<span>IQ</span>
        </h1>
        {comps.error ? (
          <>
            <p>Couldn't load competitions: {comps.error}</p>
            <button className="btn" onClick={comps.reload}>
              Try again
            </button>
          </>
        ) : (
          <p className="muted">Loading competitions…</p>
        )}
      </div>
    );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

/* ---------- data hooks ---------- */

const MIN = 60_000;
// Functions, not constants: the data source is only known once the server config has loaded.
const isLive = () => provider.id !== 'demo';

export function useCompetition(code: string | null | undefined) {
  return useResource<CompetitionData>(code ? `comp:${code}` : null, () => provider.loadCompetition(code!), 5 * MIN);
}

export function useTeam(id: number | null) {
  return useResource<TeamData>(id === null ? null : `team:${id}`, () => provider.loadTeam(id!), 5 * MIN);
}

/** Full stats for a player, where the provider supports loading them individually. */
export function usePlayer(code: string, id: number) {
  return useResource<Player | undefined>(
    provider.loadPlayer ? `player:${code}:${id}` : null,
    () => provider.loadPlayer!(code, id),
    30 * MIN,
  );
}

export const canLoadPlayer = () => Boolean(provider.loadPlayer);

/** All matches on one local calendar day (0 = today), across every competition. */
export function useMatchesOnDay(dayOffset = 0) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + dayOffset);
  const key = `day:${start.toDateString()}`;
  const res = useResource<Match[]>(
    key,
    () => {
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return provider.loadMatches(start, end);
    },
    isLive() && dayOffset === 0 ? liveRefreshMs() : Infinity,
  );
  // Keep scores fresh while any match is in play.
  const hasLive = res.data?.some((m) => m.status === 'LIVE') ?? false;
  const { reload } = res;
  useEffect(() => {
    if (!hasLive || !isLive()) return;
    const t = setInterval(reload, liveRefreshMs());
    return () => clearInterval(t);
  }, [hasLive, reload]);
  return res;
}

/**
 * Confirmed transfers. Providers that only list transfers per team get the
 * given team ids; with none, `needsTeams` is true and nothing loads.
 */
export function useTransfers(teamIds: number[]) {
  const ids = [...new Set(teamIds)].sort((a, b) => a - b);
  const byTeam = Boolean(provider.transfersByTeam);
  const key = byTeam ? (ids.length ? `transfers:${ids.join(',')}` : null) : 'transfers';
  const res = useResource<Transfer[] | null>(key, () => provider.loadTransfers(ids), 30 * MIN);
  return { ...res, needsTeams: byTeam && !ids.length };
}

/** Latest news; pass teams to get only stories about them, or a topic. */
export function useNews(teams?: { id: number; name: string; shortName?: string }[], topic?: 'transfers') {
  const ids = teams?.map((t) => t.id).sort((a, b) => a - b).join(',');
  const key = `news:${topic ?? 'all'}:${ids ?? 'all'}`;
  // Headlines use short names ("Arsenal", not "Arsenal FC").
  const query = teams?.map((t) => ({ id: t.id, name: t.shortName ?? t.name }));
  return useResource<NewsItem[]>(teams && !teams.length ? null : key, () => news.load(query, topic), 10 * MIN);
}

export const newsAttribution = () => news.attribution;
export const dataAttribution = () => provider.attribution;
