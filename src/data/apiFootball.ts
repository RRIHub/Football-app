import type {
  Competition,
  CompetitionCategory,
  CompetitionData,
  CompetitionRef,
  DataProvider,
  Match,
  MatchStatus,
  Player,
  Position,
  StandingGroup,
  Team,
  TeamData,
  TeamRef,
  Transfer,
  TransferType,
} from './types';
import { estimatePrice } from './pricing';
import { getConfig } from '../config';
import { colorFor, createClient, liveRefreshMs, localDate, MIN } from './http';

// Licensed data from API-Football (https://www.api-football.com): 1,000+
// leagues and cups including lower divisions, live scores, squads, player
// stats and transfers. Requests go through the server route /api/api-football,
// which adds the API key server-side (see server/handlers.ts).


/** API-Football league ids shown in quick pickers, in display order. */
export const FEATURED_IDS = [
  39, 40, 41, 42, // England: Premier League, Championship, League One, League Two
  45, 48, // FA Cup, League Cup
  179, // Scottish Premiership
  140, 141, // Spain: La Liga, Segunda División
  78, 79, // Germany: Bundesliga, 2. Bundesliga
  135, 136, // Italy: Serie A, Serie B
  61, 62, // France: Ligue 1, Ligue 2
  88, 94, // Eredivisie, Primeira Liga
  2, 3, 848, // Champions League, Europa League, Conference League
  1, 4, 9, 6, // World Cup, Euro Championship, Copa América, Africa Cup of Nations
  5, 10, // UEFA Nations League, international friendlies
  32, 34, 29, 30, 31, // World Cup qualifying: Europe, South America, Africa, Asia, CONCACAF
];

interface Envelope<T> {
  errors: unknown[] | Record<string, string>;
  response: T;
}

/** API-Football reports problems (bad key, daily limit) in `errors` with a 200 status. */
export function unwrap(body: unknown): unknown {
  const { errors, response } = body as Envelope<unknown>;
  const messages = Array.isArray(errors) ? errors.map(String) : Object.values(errors ?? {});
  if (messages.length) throw new Error(messages.join('; '));
  return response;
}

const client = createClient({
  route: '/api/api-football',
  maxPerMinute: () => getConfig().apiFootballRequestsPerMinute,
  parse: unwrap,
});
const get = client.get;

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/* ---------- response shapes (subset of API-Football v3) ---------- */

interface AfTeam {
  id: number;
  name: string;
  logo?: string | null;
  code?: string | null;
  country?: string | null;
  national?: boolean;
}
interface AfLeagueEntry {
  league: { id: number; name: string; type: 'League' | 'Cup'; logo?: string };
  country: { name: string; code: string | null; flag: string | null };
  seasons: { year: number; current: boolean }[];
}
interface AfFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null; extra?: number | null };
  };
  league: { id: number; name: string; round?: string | null };
  teams: { home: AfTeam; away: AfTeam };
  goals: { home: number | null; away: number | null };
  score?: { penalty?: { home: number | null; away: number | null } };
}
interface AfStandingRow {
  rank: number;
  team: AfTeam;
  points: number;
  group?: string | null;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}
interface AfPlayerStats {
  team: AfTeam;
  league: { id: number; name: string };
  games: { appearences: number | null; minutes: number | null; position: string | null };
  goals: { total: number | null; assists: number | null; conceded: number | null };
  cards: { yellow: number | null; red: number | null };
}
interface AfPlayer {
  player: { id: number; name: string; age: number | null; nationality: string | null; photo?: string };
  statistics: AfPlayerStats[];
}
interface AfSquad {
  team: AfTeam;
  players: { id: number; name: string; age: number | null; position: string | null }[];
}
interface AfTransfer {
  player: { id: number; name: string };
  transfers: { date: string; type: string | null; teams: { in: AfTeam; out: AfTeam } }[];
}

/* ---------- mapping ---------- */

const INTERNATIONAL = /world cup|euro championship|nations league|friendlies|qualification|copa am[eé]rica|africa cup|asian cup|gold cup|olympic/i;
const CLUB_CONTINENTAL = /club|libertadores|sudamericana|champions league|europa|conference|super cup/i;

export function mapLeague(e: AfLeagueEntry): Competition {
  const world = e.country.name === 'World';
  const name = e.league.name;
  const friendlies = /friendlies/i.test(name);
  const international = world && INTERNATIONAL.test(name) && !CLUB_CONTINENTAL.test(name);
  const category: CompetitionCategory = international
    ? 'international'
    : world && !friendlies
      ? 'europe'
      : e.league.type === 'Cup' || friendlies
        ? 'cup'
        : 'domestic';
  // Friendlies (national or club) have no table: just a list of matches.
  const format = category === 'cup' || friendlies ? 'knockout' : category === 'international' ? 'groups' : 'league';
  const season = e.seasons.find((s) => s.current)?.year ?? e.seasons.at(-1)?.year;
  return {
    code: String(e.league.id),
    name: e.league.name,
    area: e.country.name,
    emblem: e.league.logo,
    category,
    format,
    featured: FEATURED_IDS.includes(e.league.id),
    season,
  };
}

export function mapPosition(raw: string | null | undefined): Position {
  switch ((raw ?? '').toLowerCase()) {
    case 'goalkeeper':
    case 'g':
      return 'GK';
    case 'defender':
    case 'd':
      return 'DEF';
    case 'attacker':
    case 'f':
      return 'FWD';
    default:
      return 'MID';
  }
}

const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
const FINISHED = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
const OFF = new Set(['PST', 'CANC', 'ABD']);
const LABEL: Record<string, string> = {
  HT: 'HT', BT: 'ET break', P: 'Pens', INT: 'Paused', SUSP: 'Susp.',
  AET: 'AET', PEN: 'Pens', AWD: 'Awd', WO: 'W/O', PST: 'PP', CANC: 'Canc', ABD: 'Abd',
};

export function mapStatus(short: string): MatchStatus {
  if (LIVE.has(short)) return 'LIVE';
  if (FINISHED.has(short)) return 'FINISHED';
  if (OFF.has(short)) return 'POSTPONED';
  return 'SCHEDULED';
}

/** "Regular Season - 7" → matchday 7; "Group A - 2" → Group A, matchday 2; "Round of 16" → stage. */
export function parseRound(round: string | null | undefined): { matchday?: number; stage?: string } {
  if (!round) return {};
  const m = /^(.*?)\s*-\s*(\d+)$/.exec(round);
  if (!m) return { stage: round };
  return m[1] === 'Regular Season' ? { matchday: Number(m[2]) } : { matchday: Number(m[2]), stage: m[1] };
}

function teamRef(t: AfTeam): TeamRef {
  return { id: t.id, name: t.name, shortName: t.name, tla: t.code ?? t.name.slice(0, 3).toUpperCase(), crest: t.logo ?? undefined, color: colorFor(t.id) };
}

export function mapFixture(f: AfFixture): Match {
  const short = f.fixture.status.short;
  const status = mapStatus(short);
  const { elapsed, extra } = f.fixture.status;
  const pens = f.score?.penalty;
  let note: string | undefined;
  if (pens && pens.home !== null && pens.away !== null) {
    const winner = pens.home > pens.away ? f.teams.home : f.teams.away;
    note = `${winner.name} win ${Math.max(pens.home, pens.away)}-${Math.min(pens.home, pens.away)} on penalties`;
  }
  return {
    id: f.fixture.id,
    competition: { code: String(f.league.id), name: f.league.name },
    utcDate: new Date(f.fixture.date).toISOString(),
    status,
    minute: status === 'LIVE' && elapsed !== null && !LABEL[short] ? elapsed : undefined,
    statusText: LABEL[short] ?? (status === 'LIVE' && elapsed !== null && extra ? `${elapsed}+${extra}'` : undefined),
    ...parseRound(f.league.round),
    home: teamRef(f.teams.home),
    away: teamRef(f.teams.away),
    homeScore: f.goals.home,
    awayScore: f.goals.away,
    note,
  };
}

function statsFor(p: AfPlayer, leagueId?: number): AfPlayerStats | undefined {
  return p.statistics.find((s) => s.league.id === leagueId) ?? p.statistics[0];
}

export function mapPlayer(p: AfPlayer, competition: CompetitionRef, leagueId?: number): Player | undefined {
  const s = statsFor(p, leagueId);
  if (!s) return undefined;
  const position = mapPosition(s.games.position);
  const stats = {
    appearances: s.games.appearences ?? 0,
    goals: s.goals.total ?? 0,
    assists: s.goals.assists ?? 0,
    // A keeper or defender's clean sheets aren't reported per player; leave at 0.
    cleanSheets: 0,
    yellowCards: s.cards.yellow ?? 0,
    redCards: s.cards.red ?? 0,
    minutes: s.games.minutes ?? 0,
  };
  const team = teamRef(s.team);
  return {
    id: p.player.id,
    name: p.player.name,
    teamId: team.id,
    team,
    competition: s.league.id === leagueId ? competition : { code: String(s.league.id), name: s.league.name },
    position,
    nationality: p.player.nationality ?? '—',
    age: p.player.age ?? undefined,
    price: estimatePrice(position, stats),
    stats,
  };
}

/** "€ 25M" → "€25m"; "Loan" → loan; "Free" → free; anything else is a permanent move. */
export function mapTransferType(raw: string | null): { type: TransferType; fee?: string } {
  const t = (raw ?? '').trim();
  if (/back from loan/i.test(t)) return { type: 'loan', fee: 'Loan return' };
  if (/loan/i.test(t)) return { type: 'loan', fee: 'Loan' };
  if (/free/i.test(t)) return { type: 'free', fee: 'Free' };
  const fee = /[€£$]\s*[\d.,]+\s*[mk]?/i.exec(t)?.[0];
  return { type: 'permanent', fee: fee ? fee.replace(/\s+/g, '').replace(/M$/, 'm').replace(/K$/, 'k') : undefined };
}

/* ---------- provider ---------- */

async function competitions(): Promise<Competition[]> {
  const leagues = await get<AfLeagueEntry[]>('/leagues?current=true', 24 * 60 * MIN);
  const featuredOrder = (c: Competition) => {
    const i = FEATURED_IDS.indexOf(Number(c.code));
    return i === -1 ? Infinity : i;
  };
  return leagues
    .map(mapLeague)
    .sort((a, b) => featuredOrder(a) - featuredOrder(b) || a.area.localeCompare(b.area) || a.name.localeCompare(b.name));
}

async function competitionMeta(code: string): Promise<Competition> {
  const c = (await competitions()).find((x) => x.code === code);
  if (!c) throw new Error('Unknown competition');
  return c;
}

const DAY = 86_400_000;

export const apiFootballProvider: DataProvider = {
  id: 'api-football',
  attribution: { label: 'API-Football', url: 'https://www.api-football.com' },
  transfersByTeam: true,

  listCompetitions: competitions,

  async loadCompetition(code): Promise<CompetitionData> {
    const competition = await competitionMeta(code);
    const q = `league=${code}&season=${competition.season}`;
    const [standingsRes, fixtures, teamsRes, scorers, assisters] = await Promise.all([
      get<{ league: { standings: AfStandingRow[][] } }[]>(`/standings?${q}`, 5 * MIN).catch(() => []),
      get<AfFixture[]>(`/fixtures?${q}&timezone=${encodeURIComponent(timeZone)}`, 2 * MIN),
      get<{ team: AfTeam }[]>(`/teams?${q}`, 24 * 60 * MIN),
      get<AfPlayer[]>(`/players/topscorers?${q}`, 30 * MIN).catch(() => []),
      get<AfPlayer[]>(`/players/topassists?${q}`, 30 * MIN).catch(() => []),
    ]);
    const ref = { code, name: competition.name };
    const league = competition.category === 'domestic' ? ref : undefined;
    const teams: Team[] = teamsRes.map(({ team }) => ({
      ...teamRef(team),
      area: team.country ?? undefined,
      national: Boolean(team.national),
      league,
    }));
    const groups = standingsRes[0]?.league.standings ?? [];
    const standings: StandingGroup[] = groups.map((rows) => ({
      name: groups.length > 1 ? (rows[0]?.group ?? undefined) : undefined,
      rows: rows.map((r) => ({
        position: r.rank,
        team: teamRef(r.team),
        played: r.all.played,
        won: r.all.win,
        drawn: r.all.draw,
        lost: r.all.lose,
        goalsFor: r.all.goals.for,
        goalsAgainst: r.all.goals.against,
        points: r.points,
      })),
    }));
    // The leaderboards are the only per-competition player stats that don't cost a request per player.
    const players = new Map<number, Player>();
    for (const p of [...scorers, ...assisters]) {
      const player = mapPlayer(p, ref, Number(code));
      if (player && !players.has(player.id)) players.set(player.id, player);
    }
    const start = competition.season ?? new Date().getFullYear();
    return {
      competition,
      season: competition.category === 'international' ? String(start) : `${start}/${String(start + 1).slice(2)}`,
      teams,
      players: [...players.values()],
      matches: fixtures.map(mapFixture),
      standings,
    };
  },

  async loadMatches(from, to) {
    // One request per local calendar day, all competitions, in the viewer's time zone.
    const days = new Set<string>();
    for (let t = from.getTime(); t <= to.getTime(); t += DAY) days.add(localDate(new Date(t), timeZone));
    days.add(localDate(to, timeZone));
    const today = localDate(new Date(), timeZone);
    const lists = await Promise.all(
      [...days].map((d) =>
        get<AfFixture[]>(
          `/fixtures?date=${d}&timezone=${encodeURIComponent(timeZone)}`,
          // Today's scores change constantly; other days rarely do.
          d === today ? liveRefreshMs() - 1000 : 30 * MIN,
        ),
      ),
    );
    return lists
      .flat()
      .map(mapFixture)
      .filter((m) => Date.parse(m.utcDate) >= from.getTime() && Date.parse(m.utcDate) <= to.getTime());
  },

  async loadTeam(id): Promise<TeamData> {
    const tz = encodeURIComponent(timeZone);
    const [teamRes, last, next, squadRes, comps] = await Promise.all([
      get<{ team: AfTeam }[]>(`/teams?id=${id}`, 24 * 60 * MIN),
      get<AfFixture[]>(`/fixtures?team=${id}&last=10&timezone=${tz}`, 2 * MIN),
      get<AfFixture[]>(`/fixtures?team=${id}&next=10&timezone=${tz}`, 2 * MIN),
      get<AfSquad[]>(`/players/squads?team=${id}`, 24 * 60 * MIN).catch(() => []),
      competitions(),
    ]);
    const raw = teamRes[0]?.team;
    if (!raw) throw new Error('Team not found');
    const matches = [...last, ...next].map(mapFixture);
    const byCode = new Map(comps.map((c) => [c.code, c]));
    const played = [...new Set(matches.map((m) => m.competition.code))]
      .map((code) => byCode.get(code))
      .filter((c): c is Competition => Boolean(c));
    // The team's league is the domestic league it plays most often in.
    const counts = new Map<string, number>();
    for (const m of matches) counts.set(m.competition.code, (counts.get(m.competition.code) ?? 0) + 1);
    const leagueComp = played
      .filter((c) => c.category === 'domestic')
      .sort((a, b) => (counts.get(b.code) ?? 0) - (counts.get(a.code) ?? 0))[0];
    const league = leagueComp ? { code: leagueComp.code, name: leagueComp.name } : undefined;
    const team: Team = { ...teamRef(raw), area: raw.country ?? undefined, national: Boolean(raw.national), league };
    const statsComp = league ?? (played[0] ? { code: played[0].code, name: played[0].name } : { code: '', name: '' });
    const squad: Player[] = (squadRes[0]?.players ?? []).map((p) => {
      const position = mapPosition(p.position);
      const stats = { appearances: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, minutes: 0 };
      return {
        id: p.id,
        name: p.name,
        teamId: team.id,
        team: teamRef(raw),
        competition: statsComp,
        position,
        nationality: '—',
        age: p.age ?? undefined,
        price: estimatePrice(position, stats),
        stats,
      };
    });
    return {
      team,
      competitions: played.map((c) => ({ code: c.code, name: c.name })),
      squad,
      matches,
    };
  },

  async loadPlayer(code, id) {
    const competition = await competitionMeta(code);
    const res = await get<AfPlayer[]>(`/players?id=${id}&season=${competition.season}`, 30 * MIN);
    return res[0] ? mapPlayer(res[0], { code, name: competition.name }, Number(code)) : undefined;
  },

  async searchTeams(query) {
    const q = query.trim();
    // The search endpoint needs at least 3 characters.
    if (q.length < 3) return [];
    const res = await get<{ team: AfTeam }[]>(`/teams?search=${encodeURIComponent(q)}`, 60 * MIN);
    return res.map(({ team }) => ({ ...teamRef(team), area: team.country ?? undefined, national: Boolean(team.national) }));
  },

  async loadTransfers(teamIds) {
    const cutoff = Date.now() - 365 * DAY;
    const lists = await Promise.all(
      teamIds.map((id) => get<AfTransfer[]>(`/transfers?team=${id}`, 60 * MIN).catch(() => [] as AfTransfer[])),
    );
    const seen = new Set<string>();
    const out: Transfer[] = [];
    for (const entry of lists.flat()) {
      for (const t of entry.transfers) {
        const at = Date.parse(t.date);
        if (!Number.isFinite(at) || at < cutoff || at > Date.now() + 30 * DAY) continue;
        const id = `${entry.player.id}-${t.date}-${t.teams.in.id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({
          id,
          playerName: entry.player.name,
          playerId: entry.player.id,
          from: teamRef(t.teams.out),
          to: teamRef(t.teams.in),
          ...mapTransferType(t.type),
          date: new Date(at).toISOString(),
        });
      }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
  },
};
