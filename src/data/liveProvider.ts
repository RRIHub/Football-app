import type {
  Competition,
  CompetitionCategory,
  CompetitionData,
  DataProvider,
  Match,
  MatchStatus,
  Player,
  Position,
  StandingGroup,
  Team,
  TeamData,
  TeamRef,
} from './types';
import { estimatePrice } from './pricing';
import { getConfig } from '../config';
import { createClient, liveRefreshMs, MIN, seasonName } from './http';

// Licensed data from football-data.org (https://www.football-data.org).
// Requests go through the server route /api/football-data, which adds the API
// key server-side (see server/handlers.ts). Free tier: 10 requests/minute.

const CATALOGUE: Record<string, Omit<Competition, 'code' | 'emblem'>> = {
  PL: { name: 'Premier League', area: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', category: 'domestic', format: 'league' },
  ELC: { name: 'Championship', area: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', category: 'domestic', format: 'league' },
  PD: { name: 'La Liga', area: 'Spain', flag: '🇪🇸', category: 'domestic', format: 'league' },
  BL1: { name: 'Bundesliga', area: 'Germany', flag: '🇩🇪', category: 'domestic', format: 'league' },
  SA: { name: 'Serie A', area: 'Italy', flag: '🇮🇹', category: 'domestic', format: 'league' },
  FL1: { name: 'Ligue 1', area: 'France', flag: '🇫🇷', category: 'domestic', format: 'league' },
  DED: { name: 'Eredivisie', area: 'Netherlands', flag: '🇳🇱', category: 'domestic', format: 'league' },
  PPL: { name: 'Primeira Liga', area: 'Portugal', flag: '🇵🇹', category: 'domestic', format: 'league' },
  BSA: { name: 'Brasileirão Série A', area: 'Brazil', flag: '🇧🇷', category: 'domestic', format: 'league' },
  // Paid plans only; enable via FOOTBALL_DATA_COMPETITIONS.
  FAC: { name: 'FA Cup', area: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', category: 'cup', format: 'knockout' },
  EL: { name: 'UEFA Europa League', area: 'Europe', flag: '🇪🇺', category: 'europe', format: 'league' },
  CL: { name: 'UEFA Champions League', area: 'Europe', flag: '🇪🇺', category: 'europe', format: 'league' },
  EC: { name: 'European Championship', area: 'Europe', flag: '🇪🇺', category: 'international', format: 'groups' },
  WC: { name: 'FIFA World Cup', area: 'World', flag: '🌍', category: 'international', format: 'groups' },
};

// Everything on football-data.org's free tier.
const DEFAULT_CODES = ['PL', 'ELC', 'PD', 'BL1', 'SA', 'FL1', 'DED', 'PPL', 'BSA', 'CL', 'EC', 'WC'];

export function configuredCompetitions(raw = getConfig().competitions): Competition[] {
  const codes = raw.trim() ? raw.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean) : DEFAULT_CODES;
  return codes.map((code) => ({
    code,
    featured: true,
    ...(CATALOGUE[code] ?? { name: code, area: '', category: 'domestic' as CompetitionCategory, format: 'league' as const }),
  }));
}

const client = createClient({ route: '/api/football-data', maxPerMinute: () => 10 });
const get = client.get;

/* ---------- response shapes (subset of football-data.org v4) ---------- */

interface ApiTeamRef {
  id: number;
  name: string;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
}
interface ApiTeam extends ApiTeamRef {
  clubColors?: string | null;
  area?: { name: string };
  runningCompetitions?: { code: string; name: string; type: string }[];
  squad?: { id: number; name: string; position: string | null; dateOfBirth: string | null; nationality: string | null }[];
}
interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  minute?: number | string;
  matchday: number | null;
  stage?: string | null;
  group?: string | null;
  competition?: { code: string; name: string };
  homeTeam: ApiTeamRef;
  awayTeam: ApiTeamRef;
  score: { fullTime: { home: number | null; away: number | null } };
}
interface ApiScorer {
  player: { id: number; name: string; nationality: string | null; section?: string | null; position?: string | null; dateOfBirth?: string | null };
  team: ApiTeamRef;
  playedMatches: number | null;
  goals: number | null;
  assists: number | null;
}
interface ApiStanding {
  type: string;
  group?: string | null;
  stage?: string | null;
  table: {
    position: number;
    team: ApiTeamRef;
    playedGames: number;
    won: number;
    draw: number;
    lost: number;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
  }[];
}

/* ---------- mapping ---------- */

const CSS_COLORS: Record<string, string> = {
  red: '#d7263d', blue: '#1d4ed8', 'sky blue': '#6cabdd', navy: '#1e2a5a', 'navy blue': '#1e2a5a',
  white: '#9ca3af', black: '#111827', yellow: '#facc15', gold: '#d4a017', claret: '#7a263a',
  green: '#15803d', orange: '#f97316', purple: '#6b21a8', maroon: '#7f1d1d', amber: '#f59e0b',
};

export function clubColor(clubColors: string | null | undefined): string {
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

/** "GROUP_A" → "Group A", "LAST_16" → "Last 16". */
export function prettyStage(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const group = /^GROUP_([A-Z])$/.exec(raw);
  if (group) return `Group ${group[1]}`;
  const s = raw.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function teamRef(t: ApiTeamRef, color?: string): TeamRef {
  const name = t.name ?? 'TBC';
  return {
    id: t.id,
    name,
    shortName: t.shortName ?? name,
    tla: t.tla ?? name.slice(0, 3).toUpperCase(),
    crest: t.crest ?? undefined,
    color: color ?? '#64748b',
  };
}

function ageFrom(dob: string | null | undefined): number | undefined {
  if (!dob) return undefined;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function mapMatch(m: ApiMatch, fallback?: { code: string; name: string }): Match {
  const minute = typeof m.minute === 'number' ? m.minute : Number.parseInt(String(m.minute ?? ''), 10);
  const competition = m.competition ?? fallback ?? { code: '?', name: 'Unknown' };
  return {
    id: m.id,
    competition: { code: competition.code, name: CATALOGUE[competition.code]?.name ?? competition.name },
    utcDate: m.utcDate,
    status: mapStatus(m.status),
    minute: Number.isFinite(minute) ? minute : undefined,
    statusText: m.status === 'PAUSED' ? 'HT' : undefined,
    matchday: m.matchday ?? undefined,
    stage: prettyStage(m.group ?? (m.stage === 'REGULAR_SEASON' ? null : m.stage)),
    home: teamRef(m.homeTeam),
    away: teamRef(m.awayTeam),
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function makePlayer(
  p: { id: number; name: string; position?: string | null; nationality: string | null; dateOfBirth?: string | null },
  team: TeamRef,
  competition: { code: string; name: string },
  scorer?: ApiScorer,
): Player {
  const position = mapPosition(p.position);
  const stats = {
    appearances: scorer?.playedMatches ?? 0,
    goals: scorer?.goals ?? 0,
    assists: scorer?.assists ?? 0,
    // Not available on the free tier.
    cleanSheets: 0,
    yellowCards: 0,
    redCards: 0,
    minutes: 0,
  };
  return {
    id: p.id,
    name: p.name,
    teamId: team.id,
    team,
    competition,
    position,
    nationality: p.nationality ?? '—',
    age: ageFrom(p.dateOfBirth),
    price: estimatePrice(position, stats),
    stats,
  };
}

/* ---------- provider ---------- */

// Read when first needed, after the server's config has loaded.
const competitions = () => configuredCompetitions();

export const liveProvider: DataProvider = {
  id: 'football-data',
  attribution: { label: 'football-data.org', url: 'https://www.football-data.org' },

  async listCompetitions() {
    return competitions();
  },

  async searchTeams(query) {
    // No search endpoint: look through the (cached) team lists of each competition.
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const lists = await Promise.allSettled(competitions().map((c) => this.loadCompetition(c.code)));
    const seen = new Set<number>();
    return lists
      .flatMap((r) => (r.status === 'fulfilled' ? r.value.teams : []))
      .filter((t) => (t.name.toLowerCase().includes(q) || t.shortName.toLowerCase().includes(q)) && !seen.has(t.id) && seen.add(t.id))
      .slice(0, 30);
  },

  async loadCompetition(code): Promise<CompetitionData> {
    const competition = competitions().find((c) => c.code === code);
    if (!competition) throw new Error(`Unknown competition ${code}`);
    const [teamsRes, matchesRes, scorersRes, standingsRes] = await Promise.all([
      get<{ competition: { name: string; emblem?: string }; season: { startDate: string; endDate?: string | null }; teams: ApiTeam[] }>(
        `/competitions/${code}/teams`,
        60 * MIN,
      ),
      get<{ matches: ApiMatch[] }>(`/competitions/${code}/matches`, 2 * MIN),
      get<{ scorers: ApiScorer[] }>(`/competitions/${code}/scorers?limit=100`, 30 * MIN),
      get<{ standings: ApiStanding[] }>(`/competitions/${code}/standings`, 5 * MIN),
    ]);
    const compRef = { code, name: competition.name };
    const isLeague = competition.category === 'domestic';

    const teams: Team[] = teamsRes.teams.map((t) => ({
      ...teamRef(t, clubColor(t.clubColors)),
      area: t.area?.name,
      national: competition.category === 'international',
      league: isLeague ? compRef : undefined,
    }));
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const colorOf = (r: TeamRef): TeamRef => ({ ...r, color: teamById.get(r.id)?.color ?? r.color });

    const scorerById = new Map(scorersRes.scorers.map((s) => [s.player.id, s]));
    const players = new Map<number, Player>();
    for (const t of teamsRes.teams) {
      const ref = teamById.get(t.id)!;
      for (const p of t.squad ?? []) players.set(p.id, makePlayer(p, ref, compRef, scorerById.get(p.id)));
    }
    for (const s of scorersRes.scorers) {
      if (players.has(s.player.id)) continue;
      const ref = teamById.get(s.team.id) ?? teamRef(s.team);
      players.set(
        s.player.id,
        makePlayer({ ...s.player, position: s.player.section ?? s.player.position }, ref, compRef, s),
      );
    }

    const standings: StandingGroup[] = standingsRes.standings
      .filter((s) => s.type === 'TOTAL')
      .map((s) => ({
        name: prettyStage(s.group) ?? (competition.format === 'groups' ? prettyStage(s.stage) : undefined),
        rows: s.table.map((r) => ({
          position: r.position,
          team: colorOf(teamRef(r.team)),
          played: r.playedGames,
          won: r.won,
          drawn: r.draw,
          lost: r.lost,
          goalsFor: r.goalsFor,
          goalsAgainst: r.goalsAgainst,
          points: r.points,
        })),
      }));

    return {
      competition: { ...competition, emblem: teamsRes.competition.emblem },
      season: seasonName(teamsRes.season.startDate, teamsRes.season.endDate),
      teams,
      players: [...players.values()],
      matches: matchesRes.matches.map((m) => {
        const match = mapMatch(m, compRef);
        return { ...match, home: colorOf(match.home), away: colorOf(match.away) };
      }),
      standings,
    };
  },

  async loadMatches(from, to) {
    // The /matches endpoint covers every competition in the plan in one request.
    // Dates are UTC, so ask for the UTC days that cover the local range, then trim.
    const { matches } = await get<{ matches: ApiMatch[] }>(
      `/matches?dateFrom=${isoDate(from)}&dateTo=${isoDate(to)}`,
      liveRefreshMs() - 1000,
    );
    return matches
      .map((m) => mapMatch(m))
      .filter((m) => Date.parse(m.utcDate) >= from.getTime() && Date.parse(m.utcDate) <= to.getTime());
  },

  async loadTeam(id): Promise<TeamData> {
    const [t, matchesRes] = await Promise.all([
      get<ApiTeam>(`/teams/${id}`, 60 * MIN),
      get<{ matches: ApiMatch[] }>(`/teams/${id}/matches`, 2 * MIN),
    ]);
    const color = clubColor(t.clubColors);
    const running = (t.runningCompetitions ?? []).map((c) => ({ code: c.code, name: CATALOGUE[c.code]?.name ?? c.name }));
    const leagueCode = t.runningCompetitions?.find((c) => c.type === 'LEAGUE')?.code;
    const league = running.find((c) => c.code === leagueCode);
    const national = !leagueCode && (t.runningCompetitions ?? []).every((c) => ['WC', 'EC'].includes(c.code));
    const team: Team = { ...teamRef(t, color), area: t.area?.name, league, national };
    const statsComp = league ?? running[0] ?? { code: '?', name: '' };
    return {
      team,
      competitions: running,
      squad: (t.squad ?? []).map((p) => makePlayer(p, team, statsComp)),
      matches: matchesRes.matches.map((m) => {
        const match = mapMatch(m);
        return {
          ...match,
          home: match.home.id === id ? { ...match.home, color } : match.home,
          away: match.away.id === id ? { ...match.away, color } : match.away,
        };
      }),
    };
  },

  async loadTransfers() {
    return null;
  },
};
