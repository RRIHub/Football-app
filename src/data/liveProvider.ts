import type { DataProvider, FootballData, Match, MatchStatus, Player, Position, StandingRow, Team } from './types';
import { estimatePrice } from './pricing';

// Licensed data from football-data.org (https://www.football-data.org).
// Requests go through the dev/preview proxy at /api, which adds the API key
// server-side (see vite.config.ts). Free tier: 10 requests/minute.

const COMPETITION = 'PL';

/* Subset of the football-data.org v4 response shapes we rely on. */
interface ApiTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  clubColors?: string;
  squad?: { id: number; name: string; position: string | null; dateOfBirth: string | null; nationality: string | null }[];
}
interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  minute?: number | string;
  matchday: number | null;
  homeTeam: { id: number };
  awayTeam: { id: number };
  score: { fullTime: { home: number | null; away: number | null } };
}
interface ApiScorer {
  player: { id: number; name: string; nationality: string | null; position?: string | null; section?: string | null; dateOfBirth?: string | null };
  team: { id: number };
  playedMatches: number | null;
  goals: number | null;
  assists: number | null;
}
interface ApiStandingRow {
  position: number;
  team: { id: number };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (res.status === 429) throw new Error('Rate limit reached – try again in a minute.');
  if (!res.ok) throw new Error(`Data request failed (${res.status})`);
  return res.json() as Promise<T>;
}

const CSS_COLORS: Record<string, string> = {
  red: '#d7263d', blue: '#1d4ed8', 'sky blue': '#6cabdd', navy: '#1e2a5a', 'navy blue': '#1e2a5a',
  white: '#e5e7eb', black: '#111827', yellow: '#facc15', gold: '#d4a017', claret: '#7a263a',
  green: '#15803d', orange: '#f97316', purple: '#6b21a8', maroon: '#7f1d1d', amber: '#f59e0b',
};

export function clubColor(clubColors: string | undefined): string {
  const first = clubColors?.split('/')[0]?.trim().toLowerCase();
  return (first && CSS_COLORS[first]) || '#64748b';
}

export function mapPosition(raw: string | null | undefined): Position {
  const p = (raw ?? '').toLowerCase();
  if (p.includes('goal')) return 'GK';
  if (p.includes('midfield')) return 'MID';
  if (p.includes('back') || p.includes('defen')) return 'DEF';
  if (p.includes('wing') || p.includes('forward') || p.includes('offence') || p.includes('striker') || p.includes('attack'))
    return 'FWD';
  return 'MID';
}

export function mapStatus(raw: string): MatchStatus {
  switch (raw) {
    case 'IN_PLAY':
    case 'PAUSED':
    case 'LIVE':
      return 'LIVE';
    case 'FINISHED':
    case 'AWARDED':
      return 'FINISHED';
    case 'POSTPONED':
    case 'SUSPENDED':
    case 'CANCELLED':
      return 'POSTPONED';
    default:
      return 'SCHEDULED';
  }
}

function ageFrom(dob: string | null | undefined): number | undefined {
  if (!dob) return undefined;
  const ms = Date.now() - new Date(dob).getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
}

function mapMatch(m: ApiMatch): Match {
  const minute = typeof m.minute === 'number' ? m.minute : Number.parseInt(String(m.minute ?? ''), 10);
  return {
    id: m.id,
    utcDate: m.utcDate,
    status: mapStatus(m.status),
    minute: Number.isFinite(minute) ? minute : undefined,
    matchday: m.matchday ?? undefined,
    homeTeamId: m.homeTeam.id,
    awayTeamId: m.awayTeam.id,
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
  };
}

async function fetchMatches(): Promise<Match[]> {
  const { matches } = await get<{ matches: ApiMatch[] }>(`/competitions/${COMPETITION}/matches`);
  return matches.map(mapMatch);
}

export const liveProvider: DataProvider = {
  id: 'live',

  async load(): Promise<FootballData> {
    const [teamsRes, matches, scorersRes, standingsRes] = await Promise.all([
      get<{ competition: { name: string }; season: { startDate: string }; teams: ApiTeam[] }>(
        `/competitions/${COMPETITION}/teams`,
      ),
      fetchMatches(),
      get<{ scorers: ApiScorer[] }>(`/competitions/${COMPETITION}/scorers?limit=100`),
      get<{ standings: { type: string; table: ApiStandingRow[] }[] }>(`/competitions/${COMPETITION}/standings`),
    ]);

    const teams: Team[] = teamsRes.teams.map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      tla: t.tla,
      crest: t.crest,
      color: clubColor(t.clubColors),
    }));

    const scorerById = new Map(scorersRes.scorers.map((s) => [s.player.id, s]));
    const players: Player[] = [];
    const seen = new Set<number>();

    const addPlayer = (
      id: number,
      name: string,
      teamId: number,
      rawPosition: string | null | undefined,
      nationality: string | null,
      dob: string | null | undefined,
    ) => {
      if (seen.has(id)) return;
      seen.add(id);
      const s = scorerById.get(id);
      const position = mapPosition(rawPosition);
      const stats = {
        appearances: s?.playedMatches ?? 0,
        goals: s?.goals ?? 0,
        assists: s?.assists ?? 0,
        // Not available on the free tier.
        cleanSheets: 0,
        yellowCards: 0,
        redCards: 0,
        minutes: 0,
      };
      players.push({
        id,
        name,
        teamId,
        position,
        nationality: nationality ?? '—',
        age: ageFrom(dob),
        price: estimatePrice(position, stats),
        stats,
      });
    };

    for (const t of teamsRes.teams) {
      for (const p of t.squad ?? []) addPlayer(p.id, p.name, t.id, p.position, p.nationality, p.dateOfBirth);
    }
    for (const s of scorersRes.scorers) {
      addPlayer(s.player.id, s.player.name, s.team.id, s.player.section ?? s.player.position, s.player.nationality, s.player.dateOfBirth);
    }

    const total = standingsRes.standings.find((s) => s.type === 'TOTAL') ?? standingsRes.standings[0];
    const standings: StandingRow[] = (total?.table ?? []).map((r) => ({
      position: r.position,
      teamId: r.team.id,
      played: r.playedGames,
      won: r.won,
      drawn: r.draw,
      lost: r.lost,
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
      points: r.points,
    }));

    const start = new Date(teamsRes.season.startDate).getUTCFullYear();
    return {
      competition: teamsRes.competition.name,
      season: `${start}/${String(start + 1).slice(2)}`,
      teams,
      players,
      matches,
      standings,
      transfers: [],
      transfersUnavailable: true,
      fetchedAt: new Date().toISOString(),
    };
  },

  loadMatches: fetchMatches,
};
