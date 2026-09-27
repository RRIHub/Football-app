import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { LIVE_REFRESH_MS } from '../data/liveProvider';
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
  source: 'live' | 'demo';
  competitions: Competition[];
  competition: (code: string | undefined) => Competition | undefined;
  followedTeams: ReturnType<typeof useFollowList<FollowedTeam>>;
  followedPlayers: ReturnType<typeof useFollowList<FollowedPlayer>>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const followedTeams = useFollowList<FollowedTeam>('footiq.teams');
  const followedPlayers = useFollowList<FollowedPlayer>('footiq.players');
  const value = useMemo<AppState>(() => {
    const byCode = new Map(provider.competitions.map((c) => [c.code, c]));
    return {
      source: provider.id,
      competitions: provider.competitions,
      competition: (code) => (code ? byCode.get(code) : undefined),
      followedTeams,
      followedPlayers,
    };
  }, [followedTeams, followedPlayers]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

/* ---------- data hooks ---------- */

const MIN = 60_000;

export function useCompetition(code: string | null | undefined) {
  return useResource<CompetitionData>(code ? `comp:${code}` : null, () => provider.loadCompetition(code!), 5 * MIN);
}

export function useTeam(id: number | null) {
  return useResource<TeamData>(id === null ? null : `team:${id}`, () => provider.loadTeam(id!), 5 * MIN);
}

/** Matches from `daysBack` days ago to `daysAhead` days ahead, across all competitions. */
export function useMatchWindow(daysBack = 3, daysAhead = 6) {
  const res = useResource<Match[]>(
    `window:${daysBack}:${daysAhead}`,
    () => {
      const from = new Date();
      from.setUTCHours(0, 0, 0, 0);
      from.setUTCDate(from.getUTCDate() - daysBack);
      const to = new Date(from);
      to.setUTCDate(to.getUTCDate() + daysBack + daysAhead);
      to.setUTCHours(23, 59, 59, 999);
      return provider.loadMatches(from, to);
    },
    provider.id === 'live' ? LIVE_REFRESH_MS : Infinity,
  );
  // Keep scores fresh while any match is in play.
  const hasLive = res.data?.some((m) => m.status === 'LIVE') ?? false;
  const { reload } = res;
  useEffect(() => {
    if (!hasLive || provider.id !== 'live') return;
    const t = setInterval(reload, LIVE_REFRESH_MS);
    return () => clearInterval(t);
  }, [hasLive, reload]);
  return res;
}

/** Latest news; pass teams to get only stories about them. */
export function useNews(teams?: { id: number; name: string; shortName?: string }[]) {
  const key = teams ? `news:${teams.map((t) => t.id).sort((a, b) => a - b).join(',')}` : 'news:all';
  // Headlines use short names ("Arsenal", not "Arsenal FC").
  const query = teams?.map((t) => ({ id: t.id, name: t.shortName ?? t.name }));
  return useResource<NewsItem[]>(teams && !teams.length ? null : key, () => news.load(query), 10 * MIN);
}

export const newsAttribution = news.attribution;

export function useTransfers() {
  return useResource<Transfer[] | null>('transfers', () => provider.loadTransfers(), 30 * MIN);
}
