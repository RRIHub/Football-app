import type {
  DataProvider,
  FootballData,
  Match,
  Player,
  Position,
  Team,
  Transfer,
  TransferType,
} from './types';
import { computeStandings } from './standings';
import { estimatePrice } from './pricing';

// Deterministic sample data so the app works fully without an API key.
// Player names are fictional; nothing here reflects real results.

const TEAMS: Omit<Team, 'crest'>[] = [
  { id: 1, name: 'Arsenal', shortName: 'Arsenal', tla: 'ARS', color: '#ef0107' },
  { id: 2, name: 'Aston Villa', shortName: 'Villa', tla: 'AVL', color: '#670e36' },
  { id: 3, name: 'Bournemouth', shortName: 'Bournemouth', tla: 'BOU', color: '#da291c' },
  { id: 4, name: 'Brentford', shortName: 'Brentford', tla: 'BRE', color: '#e30613' },
  { id: 5, name: 'Brighton & Hove Albion', shortName: 'Brighton', tla: 'BHA', color: '#0057b8' },
  { id: 6, name: 'Chelsea', shortName: 'Chelsea', tla: 'CHE', color: '#034694' },
  { id: 7, name: 'Crystal Palace', shortName: 'Palace', tla: 'CRY', color: '#1b458f' },
  { id: 8, name: 'Everton', shortName: 'Everton', tla: 'EVE', color: '#003399' },
  { id: 9, name: 'Fulham', shortName: 'Fulham', tla: 'FUL', color: '#9ca3af' },
  { id: 10, name: 'Leeds United', shortName: 'Leeds', tla: 'LEE', color: '#ffcd00' },
  { id: 11, name: 'Liverpool', shortName: 'Liverpool', tla: 'LIV', color: '#c8102e' },
  { id: 12, name: 'Manchester City', shortName: 'Man City', tla: 'MCI', color: '#6cabdd' },
  { id: 13, name: 'Manchester United', shortName: 'Man United', tla: 'MUN', color: '#da291c' },
  { id: 14, name: 'Newcastle United', shortName: 'Newcastle', tla: 'NEW', color: '#6b7280' },
  { id: 15, name: 'Nottingham Forest', shortName: "Nott'm Forest", tla: 'NFO', color: '#dd0000' },
  { id: 16, name: 'Sunderland', shortName: 'Sunderland', tla: 'SUN', color: '#eb172b' },
  { id: 17, name: 'Tottenham Hotspur', shortName: 'Spurs', tla: 'TOT', color: '#132257' },
  { id: 18, name: 'West Ham United', shortName: 'West Ham', tla: 'WHU', color: '#7a263a' },
  { id: 19, name: 'Wolverhampton Wanderers', shortName: 'Wolves', tla: 'WOL', color: '#fdb913' },
  { id: 20, name: 'Burnley', shortName: 'Burnley', tla: 'BUR', color: '#6c1d45' },
];

const FIRST = [
  'Alex', 'Ben', 'Callum', 'Dani', 'Eli', 'Femi', 'Gabe', 'Hugo', 'Isaac', 'Jonah',
  'Kai', 'Luca', 'Marco', 'Nico', 'Omar', 'Pablo', 'Quinn', 'Rafa', 'Sami', 'Theo',
  'Umar', 'Victor', 'Wes', 'Xavi', 'Yusuf', 'Zane', 'Leo', 'Mateo', 'Jude', 'Ruben',
];
const LAST = [
  'Adeyemi', 'Barros', 'Carver', 'Duarte', 'Ekwueme', 'Fischer', 'Gallo', 'Hartley',
  'Ivanov', 'Jansen', 'Kovac', 'Lindqvist', 'Mensah', 'Novak', 'Okafor', 'Petit',
  'Quaresma', 'Rinaldi', 'Silva', 'Toure', 'Ueda', 'Vidal', 'Walsh', 'Yilmaz',
  'Zielinski', 'Moreau', 'Kane-Riley', 'Osei', 'Brandt', 'Castro', 'Doherty', 'Lange',
];
const NATIONS = [
  'England', 'France', 'Spain', 'Brazil', 'Portugal', 'Germany', 'Netherlands',
  'Nigeria', 'Ghana', 'Norway', 'Argentina', 'Belgium', 'Scotland', 'Wales', 'Japan',
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SQUAD_SHAPE: Position[] = [
  'GK', 'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD',
];
const PLAYED_MATCHDAYS = 5;

/** Circle-method round robin: returns [home, away] pairs per matchday. */
function roundRobin(teamIds: number[]): [number, number][][] {
  const ids = [...teamIds];
  const rounds: [number, number][][] = [];
  for (let r = 0; r < ids.length - 1; r++) {
    const round: [number, number][] = [];
    for (let i = 0; i < ids.length / 2; i++) {
      const a = ids[i];
      const b = ids[ids.length - 1 - i];
      round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    ids.splice(1, 0, ids.pop()!);
  }
  return rounds;
}

function scoreFor(rand: () => number): number {
  const r = rand();
  if (r < 0.25) return 0;
  if (r < 0.6) return 1;
  if (r < 0.85) return 2;
  if (r < 0.96) return 3;
  return 4;
}

function seasonLabel(now: Date): string {
  const start = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${start}/${String(start + 1).slice(2)}`;
}

export function buildDemoData(now = new Date()): FootballData {
  const rand = mulberry32(2026);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const teams: Team[] = TEAMS.map((t) => ({ ...t }));

  // Fixtures: 5 finished matchdays, today's matchday (some live), then 2 upcoming.
  const rounds = roundRobin(teams.map((t) => t.id)).slice(0, PLAYED_MATCHDAYS + 3);
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const matches: Match[] = [];
  let matchId = 1000;
  rounds.forEach((round, r) => {
    const dayOffset = (r - PLAYED_MATCHDAYS) * 7;
    round.forEach(([home, away], i) => {
      const kickoff = new Date(today);
      kickoff.setUTCDate(kickoff.getUTCDate() + dayOffset);
      kickoff.setUTCHours([12, 14, 14, 14, 14, 17, 12, 14, 16, 19][i], i % 2 ? 30 : 0);
      let status: Match['status'] = 'SCHEDULED';
      let minute: number | undefined;
      if (r < PLAYED_MATCHDAYS) status = 'FINISHED';
      else if (r === PLAYED_MATCHDAYS && i < 3) {
        status = 'LIVE';
        minute = 20 + i * 25;
      } else if (r === PLAYED_MATCHDAYS && i === 9) status = 'POSTPONED';
      const played = status === 'FINISHED' || status === 'LIVE';
      const partial = status === 'LIVE' ? (minute ?? 0) / 90 : 1;
      matches.push({
        id: matchId++,
        utcDate: kickoff.toISOString(),
        status,
        minute,
        matchday: r + 1,
        homeTeamId: home,
        awayTeamId: away,
        homeScore: played ? Math.round(scoreFor(rand) * partial) : null,
        awayScore: played ? Math.round(scoreFor(rand) * partial) : null,
      });
    });
  });

  // Squads with season stats consistent with the number of matchdays played.
  const players: Player[] = [];
  let playerId = 1;
  const usedNames = new Set<string>();
  for (const team of teams) {
    const conceded = matches
      .filter((m) => m.status === 'FINISHED')
      .filter((m) => m.homeTeamId === team.id || m.awayTeamId === team.id)
      .map((m) => (m.homeTeamId === team.id ? m.awayScore! : m.homeScore!));
    const cleanSheets = conceded.filter((c) => c === 0).length;
    SQUAD_SHAPE.forEach((position, idx) => {
      let name = `${pick(FIRST)} ${pick(LAST)}`;
      while (usedNames.has(name)) name = `${pick(FIRST)} ${pick(LAST)}`;
      usedNames.add(name);
      const starter = idx % 5 !== 1; // roughly one rotation player per block
      const appearances = starter ? PLAYED_MATCHDAYS - Math.floor(rand() * 2) : Math.floor(rand() * 3);
      const attack = { GK: 0, DEF: 0.08, MID: 0.25, FWD: 0.55 }[position];
      const goals = Array.from({ length: appearances }).filter(() => rand() < attack).length;
      const assists = Array.from({ length: appearances }).filter(() => rand() < attack * 0.7).length;
      const stats = {
        appearances,
        goals,
        assists,
        cleanSheets: position === 'GK' || position === 'DEF' ? Math.min(cleanSheets, appearances) : 0,
        yellowCards: Math.floor(rand() * 3),
        redCards: rand() < 0.03 ? 1 : 0,
        minutes: appearances * (70 + Math.floor(rand() * 21)),
      };
      players.push({
        id: playerId++,
        name,
        teamId: team.id,
        position,
        nationality: pick(NATIONS),
        age: 18 + Math.floor(rand() * 17),
        price: estimatePrice(position, stats, starter ? 1 : 0.6),
        stats,
      });
    });
  }

  // Transfer window activity (demo).
  const types: TransferType[] = ['permanent', 'permanent', 'loan', 'free', 'rumour'];
  const transfers: Transfer[] = [];
  for (let i = 0; i < 24; i++) {
    const player = pick(players);
    const to = pick(teams.filter((t) => t.id !== player.teamId));
    const from = teams.find((t) => t.id === player.teamId)!;
    const type = pick(types);
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - Math.floor(rand() * 90) + (type === 'rumour' ? 30 : 0));
    transfers.push({
      id: `t${i}`,
      playerName: player.name,
      playerId: player.id,
      fromTeamId: from.id,
      fromName: from.name,
      toTeamId: to.id,
      toName: to.name,
      fee:
        type === 'permanent' ? `£${(5 + Math.floor(rand() * 70)).toString()}m`
        : type === 'loan' ? 'Loan'
        : type === 'free' ? 'Free'
        : `£${(10 + Math.floor(rand() * 60)).toString()}m (reported)`,
      date: date.toISOString(),
      type,
    });
  }
  transfers.sort((a, b) => b.date.localeCompare(a.date));

  return {
    competition: 'Premier League',
    season: seasonLabel(now),
    teams,
    players,
    matches,
    standings: computeStandings(teams, matches),
    transfers,
    fetchedAt: now.toISOString(),
  };
}

export const demoProvider: DataProvider = {
  id: 'demo',
  async load() {
    return buildDemoData();
  },
  async loadMatches() {
    return buildDemoData().matches;
  },
};
