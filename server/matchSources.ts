// Extra match details (goals with assists, cards, substitutions, line-ups,
// team stats) from other sources, for when the main data provider doesn't
// supply them:
//
// - SportMonks (licensed API, needs SPORTMONKS_API_TOKEN): any league on your plan.
// - OpenLigaDB (free, community-maintained): German leagues and the DFB-Pokal. Goals only.
// - StatsBomb Open Data (free, attribution required): selected past tournaments
//   and seasons, e.g. World Cup 2022, Euro 2024, Copa América 2024, AFCON 2023.
//
// Each source finds the same match by date, team names and score (IDs differ
// between providers), and a match only counts if all three agree.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Env } from './handlers.js';

/* ---------- shared shapes (mirrors src/data/types.ts, by side not team id) ---------- */

export type Side = 'home' | 'away';
export interface SourcePlayer {
  name: string;
}
export interface SourceEvent {
  minute: number;
  extra?: number;
  side: Side;
  type: 'goal' | 'own-goal' | 'penalty' | 'missed-penalty' | 'yellow' | 'second-yellow' | 'red' | 'sub' | 'var';
  player?: SourcePlayer;
  assist?: SourcePlayer;
  playerOn?: SourcePlayer;
  playerOff?: SourcePlayer;
  detail?: string;
}
export interface SourceLineupPlayer extends SourcePlayer {
  number?: number;
  position?: 'G' | 'D' | 'M' | 'F';
  grid?: string;
}
export interface SourceLineup {
  side: Side;
  formation?: string;
  coach?: string;
  startXI: SourceLineupPlayer[];
  substitutes: SourceLineupPlayer[];
}
export interface SourceStat {
  label: string;
  home: number | string | null;
  away: number | string | null;
}
export interface SourceDetails {
  source: { name: string; url: string };
  events?: SourceEvent[];
  lineups?: SourceLineup[];
  stats?: SourceStat[];
  halfTime?: { home: number; away: number };
  venue?: string;
  referee?: string;
  note?: string;
}

export interface MatchQuery {
  home: string;
  away: string;
  /** Kick-off, ISO 8601. */
  kickoff: string;
  competition: string;
  homeScore?: number;
  awayScore?: number;
}

/* ---------- matching helpers ---------- */

const STOP = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'as', 'ssc', 'club', 'de', 'the', 'cd', 'ud', 'rc', 'sv', 'vfl', 'vfb', 'tsg', 'fk', 'sk', 'bk', 'if', 'calcio', 'football', 'futbol', 'e', 'v']);

/** "1. FC Köln" → ["koln"], "Bayer 04 Leverkusen" → ["bayer", "04", "leverkusen"]. */
export function nameTokens(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t) && !/^\d$/.test(t));
}

/** Whether two team names refer to the same team, allowing for sponsor words and abbreviations. */
export function sameTeam(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;
  const joined = (t: string[]) => t.join('');
  if (joined(ta) === joined(tb)) return true;
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  // Prefixes count only between real words ("Man" ~ "Manchester"), not stray letters.
  const prefix = (t: string, u: string) => Math.min(t.length, u.length) >= 3 && (u.startsWith(t) || t.startsWith(u));
  const shared = small.filter((t) => big.some((u) => u === t || prefix(t, u)));
  // Every word of the shorter name appears in the longer one (e.g. "Leverkusen" in "Bayer 04 Leverkusen").
  return shared.length === small.length;
}

const DAY = 86_400_000;
const withinDays = (a: string, b: string, days: number) => Math.abs(Date.parse(a) - Date.parse(b)) <= days * DAY;

/**
 * Which way round a candidate match is compared with ours: 'same', 'swapped'
 * (listed away-v-home, e.g. at a neutral venue), or null if it isn't this match.
 */
export function orientation(
  q: MatchQuery,
  c: { home: string; away: string; date: string; homeScore?: number | null; awayScore?: number | null },
): 'same' | 'swapped' | null {
  if (!withinDays(q.kickoff, c.date, 1.5)) return null;
  const scoresAgree = (h?: number | null, a?: number | null) =>
    q.homeScore === undefined || q.awayScore === undefined || h === undefined || h === null || a === undefined || a === null
      ? true
      : h === q.homeScore && a === q.awayScore;
  if (sameTeam(q.home, c.home) && sameTeam(q.away, c.away) && scoresAgree(c.homeScore, c.awayScore)) return 'same';
  if (sameTeam(q.home, c.away) && sameTeam(q.away, c.home) && scoresAgree(c.awayScore, c.homeScore)) return 'swapped';
  return null;
}

const flip = (s: Side): Side => (s === 'home' ? 'away' : 'home');

/** Put a source's details the right way round for our home/away. */
export function orient(d: SourceDetails, o: 'same' | 'swapped'): SourceDetails {
  if (o === 'same') return d;
  return {
    ...d,
    events: d.events?.map((e) => ({ ...e, side: flip(e.side) })),
    lineups: d.lineups?.map((l) => ({ ...l, side: flip(l.side) })),
    stats: d.stats?.map((s) => ({ ...s, home: s.away, away: s.home })),
    halfTime: d.halfTime && { home: d.halfTime.away, away: d.halfTime.home },
  };
}

/* ---------- fetching with a small in-memory cache ---------- */

type Fetch = typeof fetch;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

async function getJson<T>(url: string, ttlMs: number, fetchImpl: Fetch, headers?: Record<string, string>): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = (async () => {
    const res = await fetchImpl(url, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
    return res.json() as Promise<T>;
  })();
  cache.set(url, { at: Date.now(), value });
  value.catch(() => cache.delete(url));
  // Keep memory bounded: drop the oldest entries.
  if (cache.size > 200) for (const k of [...cache.keys()].slice(0, 50)) cache.delete(k);
  return value;
}

const HOUR = 3_600_000;

/* ---------- StatsBomb Open Data ---------- */

const SB = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data';
export const STATSBOMB = { name: 'StatsBomb Open Data', url: 'https://github.com/statsbomb/open-data' };

interface SbCompetition {
  competition_id: number;
  season_id: number;
  competition_name: string;
  season_name: string;
}
interface SbMatch {
  match_id: number;
  match_date: string;
  kick_off: string | null;
  home_team: { home_team_name: string; managers?: { name: string; nickname?: string | null }[] };
  away_team: { away_team_name: string; managers?: { name: string; nickname?: string | null }[] };
  home_score: number | null;
  away_score: number | null;
  stadium?: { name: string } | null;
  referee?: { name: string } | null;
}
interface SbRef {
  id: number;
  name: string;
}
export interface SbEvent {
  id: string;
  period: number;
  minute: number;
  second?: number;
  duration?: number;
  type: { name: string };
  team: SbRef;
  possession_team?: SbRef;
  player?: SbRef;
  tactics?: { formation: number; lineup: { player: SbRef; position: SbRef; jersey_number: number }[] };
  shot?: { outcome: { name: string }; type?: { name: string }; statsbomb_xg?: number; key_pass_id?: string };
  pass?: { outcome?: { name: string }; type?: { name: string }; goal_assist?: boolean };
  substitution?: { replacement: SbRef };
  foul_committed?: { card?: { name: string } };
  bad_behaviour?: { card?: { name: string } };
  goalkeeper?: { type?: { name: string } };
}
export interface SbLineupTeam {
  team_name: string;
  lineup: { player_id: number; player_name: string; player_nickname: string | null; jersey_number: number }[];
}

/** StatsBomb minutes count from 0 and run on through stoppage time: 46:09 in the second half is 47'. */
export function sbMinute(period: number, minute: number): { minute: number; extra?: number } {
  const end = { 1: 45, 2: 90, 3: 105, 4: 120 }[period] ?? 120;
  return minute >= end ? { minute: end, extra: minute - end + 1 } : { minute: minute + 1 };
}

/** Pitch position of each StatsBomb position id: [row from the goalkeeper, column from the left, line]. */
const SB_POSITIONS: Record<number, [number, number, SourceLineupPlayer['position']]> = {
  1: [1, 3, 'G'],
  2: [2, 5, 'D'], 3: [2, 4, 'D'], 4: [2, 3, 'D'], 5: [2, 2, 'D'], 6: [2, 1, 'D'],
  7: [3, 6, 'D'], 8: [3, 0, 'D'],
  9: [3, 4, 'M'], 10: [3, 3, 'M'], 11: [3, 2, 'M'],
  12: [4, 5, 'M'], 13: [4, 4, 'M'], 14: [4, 3, 'M'], 15: [4, 2, 'M'], 16: [4, 1, 'M'],
  17: [5, 5, 'F'], 18: [5, 4, 'M'], 19: [5, 3, 'M'], 20: [5, 2, 'M'], 21: [5, 1, 'F'],
  22: [6, 4, 'F'], 23: [6, 3, 'F'], 24: [6, 2, 'F'], 25: [6, 3, 'F'],
};

/** Condense a StatsBomb match (lineups + ~3,000 events) into summary, line-ups and stats. */
export function mapStatsBomb(m: SbMatch, lineups: SbLineupTeam[], events: SbEvent[]): SourceDetails {
  const homeName = m.home_team.home_team_name;
  const sideOf = (team: SbRef): Side => (team.name === homeName ? 'home' : 'away');
  const nick = new Map<number, string>();
  for (const t of lineups) for (const p of t.lineup) nick.set(p.player_id, p.player_nickname || p.player_name);
  const who = (p?: SbRef): SourcePlayer | undefined => (p ? { name: nick.get(p.id) ?? p.name } : undefined);
  const byId = new Map(events.map((e) => [e.id, e]));
  const inPlay = events.filter((e) => e.period <= 4);

  // Summary.
  const out: SourceEvent[] = [];
  for (const e of inPlay) {
    const at = sbMinute(e.period, e.minute);
    const t = e.type.name;
    if (t === 'Shot' && e.shot) {
      const penalty = e.shot.type?.name === 'Penalty';
      if (e.shot.outcome.name === 'Goal') {
        const pass = e.shot.key_pass_id ? byId.get(e.shot.key_pass_id) : undefined;
        const assist = pass?.pass?.goal_assist ? who(pass.player) : undefined;
        out.push({ ...at, side: sideOf(e.team), type: penalty ? 'penalty' : 'goal', player: who(e.player), assist: penalty ? undefined : assist });
      } else if (penalty) {
        out.push({ ...at, side: sideOf(e.team), type: 'missed-penalty', player: who(e.player) });
      }
    } else if (t === 'Own Goal Against') {
      // Recorded against the team that conceded; it counts for the other side.
      out.push({ ...at, side: flip(sideOf(e.team)), type: 'own-goal', player: who(e.player) });
    } else if (t === 'Substitution' && e.substitution) {
      out.push({ ...at, side: sideOf(e.team), type: 'sub', playerOff: who(e.player), playerOn: who(e.substitution.replacement) });
    } else {
      const card = e.foul_committed?.card?.name ?? e.bad_behaviour?.card?.name;
      if (card) {
        const type = /second/i.test(card) ? 'second-yellow' : /red/i.test(card) ? 'red' : 'yellow';
        out.push({ ...at, side: sideOf(e.team), type, player: who(e.player) });
      }
    }
  }
  out.sort((a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0));

  const goalsIn = (side: Side, pred: (e: SourceEvent) => boolean) =>
    out.filter((e) => e.side === side && ['goal', 'penalty', 'own-goal'].includes(e.type) && pred(e)).length;
  const firstHalf = (e: SourceEvent) => e.minute <= 45;

  // Penalty shoot-out (period 5).
  let note: string | undefined;
  const shootout = events.filter((e) => e.period === 5 && e.type.name === 'Shot');
  if (shootout.length) {
    const scored = (side: Side) => shootout.filter((e) => sideOf(e.team) === side && e.shot?.outcome.name === 'Goal').length;
    const [h, a] = [scored('home'), scored('away')];
    const winner = h > a ? homeName : m.away_team.away_team_name;
    note = `${winner} win ${Math.max(h, a)}-${Math.min(h, a)} on penalties`;
  }

  // Line-ups: starting XI and formation from the "Starting XI" events; everyone else is a substitute.
  const sbLineups: SourceLineup[] = [];
  for (const xiEvent of events.filter((e) => e.type.name === 'Starting XI' && e.tactics)) {
    const side = sideOf(xiEvent.team);
    const team = lineups.find((t) => t.team_name === xiEvent.team.name);
    const starters = new Set(xiEvent.tactics!.lineup.map((p) => p.player.id));
    const manager = (side === 'home' ? m.home_team.managers : m.away_team.managers)?.[0];
    sbLineups.push({
      side,
      formation: String(xiEvent.tactics!.formation).split('').join('-'),
      coach: manager ? manager.nickname || manager.name : undefined,
      startXI: xiEvent.tactics!.lineup.map((p) => {
        const [row, col, position] = SB_POSITIONS[p.position.id] ?? [4, 3, 'M'];
        return { name: nick.get(p.player.id) ?? p.player.name, number: p.jersey_number, position, grid: `${row}:${col}` };
      }),
      substitutes: (team?.lineup ?? [])
        .filter((p) => !starters.has(p.player_id))
        .sort((a, b) => a.jersey_number - b.jersey_number)
        .map((p) => ({ name: p.player_nickname || p.player_name, number: p.jersey_number })),
    });
  }
  sbLineups.sort((a, b) => Number(b.side === 'home') - Number(a.side === 'home'));

  // Team stats, counted from the events.
  const count = (side: Side, pred: (e: SbEvent) => boolean) => inPlay.filter((e) => sideOf(e.team) === side && pred(e)).length;
  const shots = (side: Side) => count(side, (e) => e.type.name === 'Shot');
  const onTarget = (side: Side) => count(side, (e) => e.type.name === 'Shot' && ['Goal', 'Saved', 'Saved To Post'].includes(e.shot!.outcome.name));
  const xg = (side: Side) =>
    inPlay.filter((e) => sideOf(e.team) === side && e.type.name === 'Shot').reduce((n, e) => n + (e.shot?.statsbomb_xg ?? 0), 0);
  const passes = (side: Side) => count(side, (e) => e.type.name === 'Pass');
  const completed = (side: Side) => count(side, (e) => e.type.name === 'Pass' && !e.pass?.outcome);
  const possessionTime = (side: Side) =>
    inPlay.filter((e) => e.possession_team && sideOf(e.possession_team) === side).reduce((n, e) => n + (e.duration ?? 0), 0);
  const [ph, pa] = [possessionTime('home'), possessionTime('away')];
  const possession = ph + pa > 0 ? Math.round((ph / (ph + pa)) * 100) : null;
  const cards = (side: Side, types: SourceEvent['type'][]) => out.filter((e) => e.side === side && types.includes(e.type)).length;
  const both = (label: string, f: (s: Side) => number | string | null): SourceStat => ({ label, home: f('home'), away: f('away') });
  const stats: SourceStat[] = [
    ...(possession === null ? [] : [{ label: 'Possession', home: `${possession}%`, away: `${100 - possession}%` }]),
    both('Expected goals (xG)', (s) => xg(s).toFixed(2)),
    both('Shots', shots),
    both('Shots on target', onTarget),
    both('Corners', (s) => count(s, (e) => e.type.name === 'Pass' && e.pass?.type?.name === 'Corner')),
    both('Offsides', (s) => count(s, (e) => e.type.name === 'Offside' || e.pass?.outcome?.name === 'Pass Offside')),
    both('Fouls', (s) => count(s, (e) => e.type.name === 'Foul Committed')),
    both('Yellow cards', (s) => cards(s, ['yellow'])),
    both('Red cards', (s) => cards(s, ['red', 'second-yellow'])),
    both('Saves', (s) => count(s, (e) => e.type.name === 'Goal Keeper' && /saved/i.test(e.goalkeeper?.type?.name ?? ''))),
    both('Passes', passes),
    both('Pass accuracy', (s) => (passes(s) ? `${Math.round((completed(s) / passes(s)) * 100)}%` : null)),
  ];

  return {
    source: STATSBOMB,
    events: out,
    lineups: sbLineups,
    stats,
    halfTime: { home: goalsIn('home', firstHalf), away: goalsIn('away', firstHalf) },
    venue: m.stadium?.name,
    referee: m.referee?.name,
    note,
  };
}

async function fromStatsBomb(q: MatchQuery, fetchImpl: Fetch): Promise<SourceDetails | null> {
  const year = new Date(q.kickoff).getUTCFullYear();
  const comps = await getJson<SbCompetition[]>(`${SB}/competitions.json`, 24 * HOUR, fetchImpl);
  // Only seasons that include this year; each season's match list is small.
  const candidates = comps.filter((c) => c.season_name.includes(String(year))).slice(0, 16);
  for (const c of candidates) {
    const matches = await getJson<SbMatch[]>(`${SB}/matches/${c.competition_id}/${c.season_id}.json`, 24 * HOUR, fetchImpl).catch(() => []);
    for (const m of matches) {
      const o = orientation(q, {
        home: m.home_team.home_team_name,
        away: m.away_team.away_team_name,
        date: `${m.match_date}T${m.kick_off ?? '12:00:00'}Z`,
        homeScore: m.home_score,
        awayScore: m.away_score,
      });
      if (!o) continue;
      const [lineups, events] = await Promise.all([
        getJson<SbLineupTeam[]>(`${SB}/lineups/${m.match_id}.json`, 24 * HOUR, fetchImpl),
        // Large (a few MB): fetched once, condensed, and not kept in the cache.
        fetchImpl(`${SB}/events/${m.match_id}.json`, { signal: AbortSignal.timeout(25_000) }).then((r) => {
          if (!r.ok) throw new Error(`StatsBomb events returned ${r.status}`);
          return r.json() as Promise<SbEvent[]>;
        }),
      ]);
      return orient(mapStatsBomb(m, lineups, events), o);
    }
  }
  return null;
}

/* ---------- OpenLigaDB ---------- */

const OLDB = 'https://api.openligadb.de';
export const OPENLIGADB = { name: 'OpenLigaDB', url: 'https://www.openligadb.de' };

/** OpenLigaDB league shortcut for German competitions, by name. */
export function openLigaShortcut(competition: string): string | null {
  const c = competition.toLowerCase();
  if (/frauen|women/.test(c)) return null;
  if (/dfb[- ]?pokal/.test(c)) return 'dfb';
  if (/^3\.?\s*liga/.test(c)) return 'bl3';
  if (/2\.?\s*bundesliga/.test(c)) return 'bl2';
  if (/bundesliga/.test(c)) return 'bl1';
  return null;
}

export interface OldbMatch {
  matchID: number;
  matchDateTimeUTC: string;
  team1: { teamName: string };
  team2: { teamName: string };
  matchIsFinished: boolean;
  matchResults?: { resultTypeID: number; resultName?: string; pointsTeam1: number; pointsTeam2: number }[];
  goals?: {
    scoreTeam1: number;
    scoreTeam2: number;
    matchMinute: number | null;
    goalGetterName: string | null;
    isPenalty: boolean | null;
    isOwnGoal: boolean | null;
    isOvertime?: boolean | null;
  }[];
  location?: { locationStadium?: string | null; locationCity?: string | null } | null;
}

const oldbFinal = (m: OldbMatch) => m.matchResults?.find((r) => r.resultTypeID === 2) ?? m.matchResults?.at(-1);

/** Goals only: which team scored follows from which score went up. */
export function mapOpenLiga(m: OldbMatch): SourceDetails {
  const goals = [...(m.goals ?? [])].sort((a, b) => a.scoreTeam1 + a.scoreTeam2 - (b.scoreTeam1 + b.scoreTeam2));
  let homeGoals = 0;
  const events: SourceEvent[] = [];
  for (const g of goals) {
    const side: Side = g.scoreTeam1 > homeGoals ? 'home' : 'away';
    homeGoals = g.scoreTeam1;
    const player = g.goalGetterName ? { name: g.goalGetterName } : undefined;
    events.push({
      minute: g.matchMinute ?? 0,
      side,
      type: g.isOwnGoal ? 'own-goal' : g.isPenalty ? 'penalty' : 'goal',
      player,
    });
  }
  const ht = m.matchResults?.find((r) => r.resultTypeID === 1);
  const venue = [m.location?.locationStadium, m.location?.locationCity].filter(Boolean).join(', ');
  return {
    source: OPENLIGADB,
    events,
    halfTime: ht ? { home: ht.pointsTeam1, away: ht.pointsTeam2 } : undefined,
    venue: venue || undefined,
  };
}

async function fromOpenLiga(q: MatchQuery, fetchImpl: Fetch): Promise<SourceDetails | null> {
  const shortcut = openLigaShortcut(q.competition);
  if (!shortcut) return null;
  const d = new Date(q.kickoff);
  const season = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  const matches = await getJson<OldbMatch[]>(`${OLDB}/getmatchdata/${shortcut}/${season}`, 10 * 60_000, fetchImpl);
  for (const m of matches) {
    const final = oldbFinal(m);
    const o = orientation(q, {
      home: m.team1.teamName,
      away: m.team2.teamName,
      date: m.matchDateTimeUTC,
      homeScore: final?.pointsTeam1,
      awayScore: final?.pointsTeam2,
    });
    if (o) return orient(mapOpenLiga(m), o);
  }
  return null;
}

/* ---------- SportMonks ---------- */

const SM = 'https://api.sportmonks.com/v3/football';
export const SPORTMONKS = { name: 'Sportmonks', url: 'https://www.sportmonks.com' };

interface SmParticipant {
  id: number;
  name: string;
  meta?: { location?: string };
}
interface SmTyped {
  type?: { developer_name?: string; name?: string } | null;
}
export interface SmFixture {
  id: number;
  starting_at: string;
  participants?: SmParticipant[];
  scores?: { description: string; score: { goals: number; participant: string } }[];
  events?: (SmTyped & {
    participant_id: number;
    minute: number | null;
    extra_minute: number | null;
    player_name: string | null;
    related_player_name: string | null;
    info?: string | null;
  })[];
  lineups?: (SmTyped & {
    team_id: number;
    player_name: string;
    jersey_number: number | null;
    position_id: number | null;
    formation_field: string | null;
    type_id: number;
  })[];
  formations?: { participant_id: number; formation: string; location?: string }[];
  statistics?: (SmTyped & { participant_id: number; location?: string; data?: { value: number | string | null } })[];
  venue?: { name?: string | null; city_name?: string | null } | null;
}

const SM_STATS: [string, string, string?][] = [
  ['BALL_POSSESSION', 'Possession', '%'],
  ['EXPECTED_GOALS', 'Expected goals (xG)'],
  ['SHOTS_TOTAL', 'Shots'],
  ['SHOTS_ON_TARGET', 'Shots on target'],
  ['SHOTS_OFF_TARGET', 'Shots off target'],
  ['SHOTS_BLOCKED', 'Blocked shots'],
  ['CORNERS', 'Corners'],
  ['OFFSIDES', 'Offsides'],
  ['FOULS', 'Fouls'],
  ['YELLOWCARDS', 'Yellow cards'],
  ['REDCARDS', 'Red cards'],
  ['SAVES', 'Saves'],
  ['PASSES', 'Passes'],
  ['SUCCESSFUL_PASSES_PERCENTAGE', 'Pass accuracy', '%'],
];
// Sportmonks position ids: goalkeeper, defender, midfielder, attacker.
const SM_POSITIONS: Record<number, SourceLineupPlayer['position']> = { 24: 'G', 25: 'D', 26: 'M', 27: 'F' };

export function mapSportmonks(f: SmFixture): SourceDetails {
  const home = f.participants?.find((p) => p.meta?.location === 'home');
  const sideOf = (teamId: number): Side => (teamId === home?.id ? 'home' : 'away');
  const who = (name: string | null | undefined) => (name ? { name } : undefined);

  const events: SourceEvent[] = [];
  for (const e of f.events ?? []) {
    const dev = (e.type?.developer_name ?? '').toUpperCase();
    const base = { minute: e.minute ?? 0, extra: e.extra_minute ?? undefined, side: sideOf(e.participant_id) };
    if (dev.includes('SHOOTOUT')) continue;
    if (dev === 'OWNGOAL') events.push({ ...base, type: 'own-goal', player: who(e.player_name) });
    else if (dev === 'MISSED_PENALTY') events.push({ ...base, type: 'missed-penalty', player: who(e.player_name) });
    else if (dev === 'PENALTY') events.push({ ...base, type: 'penalty', player: who(e.player_name) });
    else if (dev === 'GOAL') events.push({ ...base, type: 'goal', player: who(e.player_name), assist: who(e.related_player_name) });
    else if (dev === 'YELLOWREDCARD') events.push({ ...base, type: 'second-yellow', player: who(e.player_name) });
    else if (dev === 'REDCARD') events.push({ ...base, type: 'red', player: who(e.player_name) });
    else if (dev === 'YELLOWCARD') events.push({ ...base, type: 'yellow', player: who(e.player_name) });
    // Substitutions: the player is the one coming on, the related player the one going off.
    else if (dev === 'SUBSTITUTION') events.push({ ...base, type: 'sub', playerOn: who(e.player_name), playerOff: who(e.related_player_name) });
    else if (dev.startsWith('VAR')) events.push({ ...base, type: 'var', player: who(e.player_name), detail: e.info ?? undefined });
  }
  events.sort((a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0));

  const lineups: SourceLineup[] = (f.participants ?? []).map((p) => {
    const mine = (f.lineups ?? []).filter((l) => l.team_id === p.id);
    const starting = (l: (typeof mine)[number]) => (l.type?.developer_name ? l.type.developer_name === 'LINEUP' : l.type_id === 11);
    const player = (l: (typeof mine)[number]): SourceLineupPlayer => ({
      name: l.player_name,
      number: l.jersey_number ?? undefined,
      position: l.position_id ? SM_POSITIONS[l.position_id] : undefined,
      grid: l.formation_field ?? undefined,
    });
    return {
      side: sideOf(p.id),
      formation: f.formations?.find((x) => x.participant_id === p.id)?.formation,
      startXI: mine.filter(starting).map(player),
      substitutes: mine.filter((l) => !starting(l)).map(player),
    };
  }).filter((l) => l.startXI.length);
  lineups.sort((a, b) => Number(b.side === 'home') - Number(a.side === 'home'));

  const statFor = (dev: string, side: Side) =>
    f.statistics?.find((s) => s.type?.developer_name === dev && (s.location ? s.location === side : sideOf(s.participant_id) === side))?.data
      ?.value ?? null;
  const stats: SourceStat[] = SM_STATS.filter(([dev]) => statFor(dev, 'home') !== null || statFor(dev, 'away') !== null).map(
    ([dev, label, unit]) => {
      const fmt = (v: number | string | null) => (v === null ? null : unit ? `${v}${unit}` : v);
      return { label, home: fmt(statFor(dev, 'home')), away: fmt(statFor(dev, 'away')) };
    },
  );

  const half = (side: Side) => f.scores?.find((s) => s.description === '1ST_HALF' && s.score.participant === side)?.score.goals;
  const [hh, ha] = [half('home'), half('away')];
  const venue = [f.venue?.name, f.venue?.city_name].filter(Boolean).join(', ');
  return {
    source: SPORTMONKS,
    events,
    lineups,
    stats,
    halfTime: hh !== undefined && ha !== undefined ? { home: hh, away: ha } : undefined,
    venue: venue || undefined,
  };
}

async function fromSportmonks(q: MatchQuery, token: string, fetchImpl: Fetch): Promise<SourceDetails | null> {
  const auth = { Authorization: token };
  const date = new Date(q.kickoff).toISOString().slice(0, 10);
  const score = (f: SmFixture, side: string) => f.scores?.find((s) => s.description === 'CURRENT' && s.score.participant === side)?.score.goals;
  for (let page = 1; page <= 5; page++) {
    const res = await getJson<{ data: SmFixture[]; pagination?: { has_more?: boolean } }>(
      `${SM}/fixtures/date/${date}?include=participants;scores&per_page=50&page=${page}`,
      5 * 60_000,
      fetchImpl,
      auth,
    );
    for (const f of res.data ?? []) {
      const home = f.participants?.find((p) => p.meta?.location === 'home');
      const away = f.participants?.find((p) => p.meta?.location === 'away');
      if (!home || !away) continue;
      const o = orientation(q, {
        home: home.name,
        away: away.name,
        date: `${f.starting_at.replace(' ', 'T')}Z`,
        homeScore: score(f, 'home'),
        awayScore: score(f, 'away'),
      });
      if (!o) continue;
      const full = await getJson<{ data: SmFixture }>(
        `${SM}/fixtures/${f.id}?include=participants;scores;events.type;lineups.type;formations;statistics.type;venue`,
        60_000,
        fetchImpl,
        auth,
      );
      return orient(mapSportmonks(full.data), o);
    }
    if (!res.pagination?.has_more) break;
  }
  return null;
}

/* ---------- combining sources ---------- */

export function matchSourceNames(env: Env): string[] {
  return [...(env.SPORTMONKS_API_TOKEN ? ['Sportmonks'] : []), 'OpenLigaDB', 'StatsBomb Open Data'];
}

/**
 * Asks each source in turn (best first) and returns every one that found the
 * match, so the page can take each part from the best source that has it.
 */
export async function findMatchDetails(q: MatchQuery, env: Env, fetchImpl: Fetch = fetch): Promise<SourceDetails[]> {
  const attempts: Promise<SourceDetails | null>[] = [
    env.SPORTMONKS_API_TOKEN ? fromSportmonks(q, env.SPORTMONKS_API_TOKEN, fetchImpl) : Promise.resolve(null),
    fromOpenLiga(q, fetchImpl),
    fromStatsBomb(q, fetchImpl),
  ];
  const results = await Promise.allSettled(attempts);
  return results.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []));
}

export function parseQuery(url: string): MatchQuery | string {
  const p = new URL(url, 'http://localhost').searchParams;
  const text = (k: string) => (p.get(k) ?? '').trim().slice(0, 120);
  const [home, away, kickoff, competition] = [text('home'), text('away'), text('kickoff'), text('competition')];
  if (!home || !away || !kickoff) return 'home, away and kickoff are required.';
  if (Number.isNaN(Date.parse(kickoff))) return 'kickoff must be a date.';
  const num = (k: string) => {
    const v = p.get(k);
    return v !== null && /^\d{1,2}$/.test(v) ? Number(v) : undefined;
  };
  return { home, away, kickoff, competition, homeScore: num('homeScore'), awayScore: num('awayScore') };
}

export function matchDetailsHandler(env: Env = process.env) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, body: unknown, cache = 'no-store') => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', cache);
      res.end(JSON.stringify(body));
    };
    if (req.method && req.method !== 'GET') return reply(405, { error: 'Only GET is supported.' });
    const q = parseQuery(req.url ?? '/');
    if (typeof q === 'string') return reply(400, { error: q });
    const found = await findMatchDetails(q, env);
    // Finished matches don't change; cache them at the CDN for a day.
    const old = Date.now() - Date.parse(q.kickoff) > 6 * HOUR;
    reply(200, { sources: found }, `public, max-age=0, s-maxage=${found.length && old ? 86400 : 120}, stale-while-revalidate=600`);
  };
}
