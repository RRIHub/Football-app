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

// Licensed data from football-data.org (https://www.football-data.org).
// Requests go through the dev/preview proxy at /api, which adds the API key
// server-side (see vite.config.ts). Free tier: 10 requests/minute.

declare const __COMPETITIONS__: string;
declare const __LIVE_REFRESH_SECONDS__: number;

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

function configuredCompetitions(): Competition[] {
  const raw = typeof __COMPETITIONS__ === 'string' && __COMPETITIONS__ ? __COMPETITIONS__ : '';
  const codes = raw ? raw.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean) : DEFAULT_CODES;
  return codes.map((code) => ({
    code,
    ...(CATALOGUE[code] ?? { name: code, area: '', category: 'domestic' as CompetitionCategory, format: 'league' as const }),
  }));
}

/* ---------- request throttling + caching ---------- */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const sent: number[] = [];
let queue: Promise<unknown> = Promise.resolve();

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Serialises requests so we never exceed the free-tier rate limit. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const now = Date.now();
    while (sent.length && now - sent[0] > WINDOW_MS) sent.shift();
    if (sent.length >= MAX_PER_WINDOW) await wait(WINDOW_MS - (now - sent[0]) + 50);
    sent.push(Date.now());
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

const cache = new Map<string, { at: number; value: Promise<unknown> }>();

async function get<T>(path: string, ttlMs: number): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = throttled(async () => {
    const res = await fetch(`/api${path}`);
    if (res.status === 429) throw new Error('Rate limit reached – try again in a minute.');
    if (res.status === 403) throw new Error('This competition is not included in your data plan.');
    if (!res.ok) throw new Error(`Data request failed (${res.status})`);
    return res.json() as Promise<T>;
  });
  cache.set(path, { at: Date.now(), value });
  value.catch(() => cache.delete(path));
  return value;
}

const MIN = 60_000;

/**
 * How often live scores are re-fetched. Each refresh is one request, and the
 * free tier allows 10 a minute shared with everything else, so default to 20s.
 */
export const LIVE_REFRESH_MS =
  Math.max(5, typeof __LIVE_REFRESH_SECONDS__ === 'number' ? __LIVE_REFRESH_SECONDS__ : 20) * 1000;

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

const competitions = configuredCompetitions();

export const liveProvider: DataProvider = {
  id: 'live',
  competitions,

  async loadCompetition(code): Promise<CompetitionData> {
    const competition = competitions.find((c) => c.code === code);
    if (!competition) throw new Error(`Unknown competition ${code}`);
    const [teamsRes, matchesRes, scorersRes, standingsRes] = await Promise.all([
      get<{ competition: { name: string; emblem?: string }; season: { startDate: string }; teams: ApiTeam[] }>(
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

    const start = new Date(teamsRes.season.startDate).getUTCFullYear();
    return {
      competition: { ...competition, emblem: teamsRes.competition.emblem },
      season: competition.category === 'international' ? String(start) : `${start}/${String(start + 1).slice(2)}`,
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
    const { matches } = await get<{ matches: ApiMatch[] }>(
      `/matches?dateFrom=${isoDate(from)}&dateTo=${isoDate(to)}`,
      LIVE_REFRESH_MS - 1000,
    );
    return matches.map((m) => mapMatch(m));
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
