import type {
  Competition,
  CompetitionData,
  DataProvider,
  Match,
  Player,
  Position,
  StandingGroup,
  Team,
  TeamData,
  TeamRef,
  Transfer,
  TransferType,
} from './types';
import { computeStandings } from './standings';
import { estimatePrice, fantasyPoints } from './pricing';

// Deterministic sample data so the app works fully without an API key.
// Club and nation names are real; players, fixtures and results are invented.

type TeamSeed = [name: string, shortName: string, tla: string, color: string];

const COMPETITIONS: Competition[] = [
  { code: 'PL', name: 'Premier League', area: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', category: 'domestic', format: 'league' },
  { code: 'PD', name: 'La Liga', area: 'Spain', flag: '🇪🇸', category: 'domestic', format: 'league' },
  { code: 'BL1', name: 'Bundesliga', area: 'Germany', flag: '🇩🇪', category: 'domestic', format: 'league' },
  { code: 'SA', name: 'Serie A', area: 'Italy', flag: '🇮🇹', category: 'domestic', format: 'league' },
  { code: 'FL1', name: 'Ligue 1', area: 'France', flag: '🇫🇷', category: 'domestic', format: 'league' },
  { code: 'CL', name: 'UEFA Champions League', area: 'Europe', flag: '🇪🇺', category: 'europe', format: 'league' },
  { code: 'UNL', name: 'UEFA Nations League', area: 'Europe', flag: '🌍', category: 'international', format: 'groups' },
];

const LEAGUE_TEAMS: Record<string, { idBase: number; nation: string; teams: TeamSeed[] }> = {
  PL: {
    idBase: 1,
    nation: 'England',
    teams: [
      ['Arsenal', 'Arsenal', 'ARS', '#ef0107'], ['Aston Villa', 'Villa', 'AVL', '#670e36'],
      ['Bournemouth', 'Bournemouth', 'BOU', '#da291c'], ['Brentford', 'Brentford', 'BRE', '#e30613'],
      ['Brighton & Hove Albion', 'Brighton', 'BHA', '#0057b8'], ['Chelsea', 'Chelsea', 'CHE', '#034694'],
      ['Crystal Palace', 'Palace', 'CRY', '#1b458f'], ['Everton', 'Everton', 'EVE', '#003399'],
      ['Fulham', 'Fulham', 'FUL', '#9ca3af'], ['Leeds United', 'Leeds', 'LEE', '#ffcd00'],
      ['Liverpool', 'Liverpool', 'LIV', '#c8102e'], ['Manchester City', 'Man City', 'MCI', '#6cabdd'],
      ['Manchester United', 'Man United', 'MUN', '#da291c'], ['Newcastle United', 'Newcastle', 'NEW', '#6b7280'],
      ['Nottingham Forest', "Nott'm Forest", 'NFO', '#dd0000'], ['Sunderland', 'Sunderland', 'SUN', '#eb172b'],
      ['Tottenham Hotspur', 'Spurs', 'TOT', '#132257'], ['West Ham United', 'West Ham', 'WHU', '#7a263a'],
      ['Wolverhampton Wanderers', 'Wolves', 'WOL', '#fdb913'], ['Burnley', 'Burnley', 'BUR', '#6c1d45'],
    ],
  },
  PD: {
    idBase: 101,
    nation: 'Spain',
    teams: [
      ['Real Madrid', 'Real Madrid', 'RMA', '#febe10'], ['FC Barcelona', 'Barcelona', 'FCB', '#a50044'],
      ['Atlético Madrid', 'Atlético', 'ATM', '#cb3524'], ['Athletic Club', 'Athletic', 'ATH', '#ee2523'],
      ['Villarreal', 'Villarreal', 'VIL', '#ffe667'], ['Real Betis', 'Betis', 'BET', '#0bb363'],
      ['Real Sociedad', 'Real Sociedad', 'RSO', '#0067b1'], ['Celta Vigo', 'Celta', 'CEL', '#8ac3ee'],
      ['Osasuna', 'Osasuna', 'OSA', '#d91a21'], ['Getafe', 'Getafe', 'GET', '#005999'],
      ['Rayo Vallecano', 'Rayo', 'RAY', '#e53027'], ['Mallorca', 'Mallorca', 'MLL', '#e20613'],
      ['Valencia', 'Valencia', 'VAL', '#ee3524'], ['Sevilla', 'Sevilla', 'SEV', '#d71920'],
      ['Girona', 'Girona', 'GIR', '#cd2534'], ['Espanyol', 'Espanyol', 'ESP', '#007fc8'],
      ['Deportivo Alavés', 'Alavés', 'ALA', '#0761af'], ['Elche', 'Elche', 'ELC', '#05642c'],
      ['Levante', 'Levante', 'LEV', '#b4053f'], ['Real Oviedo', 'Oviedo', 'OVI', '#0033a0'],
    ],
  },
  BL1: {
    idBase: 201,
    nation: 'Germany',
    teams: [
      ['FC Bayern München', 'Bayern', 'FCB', '#dc052d'], ['Borussia Dortmund', 'Dortmund', 'BVB', '#fde100'],
      ['Bayer 04 Leverkusen', 'Leverkusen', 'B04', '#e32221'], ['RB Leipzig', 'Leipzig', 'RBL', '#dd0741'],
      ['Eintracht Frankfurt', 'Frankfurt', 'SGE', '#e1000f'], ['VfB Stuttgart', 'Stuttgart', 'VFB', '#e32219'],
      ['SC Freiburg', 'Freiburg', 'SCF', '#b40a14'], ['Werder Bremen', 'Bremen', 'SVW', '#1d9053'],
      ["Borussia M'gladbach", "M'gladbach", 'BMG', '#16a34a'], ['VfL Wolfsburg', 'Wolfsburg', 'WOB', '#65b32e'],
      ['1. FSV Mainz 05', 'Mainz', 'M05', '#c3141e'], ['1. FC Union Berlin', 'Union Berlin', 'FCU', '#eb1923'],
      ['FC Augsburg', 'Augsburg', 'FCA', '#ba3733'], ['TSG Hoffenheim', 'Hoffenheim', 'TSG', '#1961b5'],
      ['1. FC Heidenheim', 'Heidenheim', 'HDH', '#e30613'], ['FC St. Pauli', 'St. Pauli', 'STP', '#624839'],
      ['1. FC Köln', 'Köln', 'KOE', '#ed1c24'], ['Hamburger SV', 'Hamburg', 'HSV', '#0a3f86'],
    ],
  },
  SA: {
    idBase: 301,
    nation: 'Italy',
    teams: [
      ['Inter', 'Inter', 'INT', '#0068a8'], ['AC Milan', 'Milan', 'MIL', '#fb090b'],
      ['Juventus', 'Juventus', 'JUV', '#6b7280'], ['Napoli', 'Napoli', 'NAP', '#12a0d7'],
      ['Atalanta', 'Atalanta', 'ATA', '#1e71b8'], ['AS Roma', 'Roma', 'ROM', '#8e1f2f'],
      ['Lazio', 'Lazio', 'LAZ', '#87d8f7'], ['Fiorentina', 'Fiorentina', 'FIO', '#482e92'],
      ['Bologna', 'Bologna', 'BOL', '#1a2f48'], ['Torino', 'Torino', 'TOR', '#881f19'],
      ['Genoa', 'Genoa', 'GEN', '#ad1919'], ['Udinese', 'Udinese', 'UDI', '#7d7d7d'],
      ['Como', 'Como', 'COM', '#1b3f8b'], ['Cagliari', 'Cagliari', 'CAG', '#a0102a'],
      ['Lecce', 'Lecce', 'LEC', '#f6c700'], ['Parma', 'Parma', 'PAR', '#ffd200'],
      ['Hellas Verona', 'Verona', 'VER', '#003e7e'], ['Sassuolo', 'Sassuolo', 'SAS', '#00a752'],
      ['Pisa', 'Pisa', 'PIS', '#1d3c8f'], ['Cremonese', 'Cremonese', 'CRE', '#c8102e'],
    ],
  },
  FL1: {
    idBase: 401,
    nation: 'France',
    teams: [
      ['Paris Saint-Germain', 'PSG', 'PSG', '#004170'], ['Olympique de Marseille', 'Marseille', 'OM', '#2faee0'],
      ['AS Monaco', 'Monaco', 'ASM', '#e51b22'], ['LOSC Lille', 'Lille', 'LIL', '#e01e13'],
      ['Olympique Lyonnais', 'Lyon', 'OL', '#1b3d8f'], ['OGC Nice', 'Nice', 'NIC', '#c8102e'],
      ['RC Lens', 'Lens', 'RCL', '#fcd116'], ['Stade Rennais', 'Rennes', 'REN', '#e13327'],
      ['RC Strasbourg', 'Strasbourg', 'RCS', '#009fe3'], ['FC Nantes', 'Nantes', 'NAN', '#fcd405'],
      ['Toulouse FC', 'Toulouse', 'TFC', '#6a2c91'], ['Stade Brestois', 'Brest', 'SB29', '#e30613'],
      ['AJ Auxerre', 'Auxerre', 'AJA', '#0066b3'], ['Angers SCO', 'Angers', 'SCO', '#6b7280'],
      ['Le Havre AC', 'Le Havre', 'HAC', '#1d9bd7'], ['FC Lorient', 'Lorient', 'FCL', '#f58220'],
      ['Paris FC', 'Paris FC', 'PFC', '#1e3a8a'], ['FC Metz', 'Metz', 'FCM', '#7c1d3f'],
    ],
  },
};

// Clubs in the Champions League from outside the five leagues above.
const EXTRA_CL: { area: string; team: TeamSeed }[] = [
  { area: 'Portugal', team: ['SL Benfica', 'Benfica', 'SLB', '#e20e0e'] },
  { area: 'Portugal', team: ['FC Porto', 'Porto', 'FCP', '#00428c'] },
  { area: 'Portugal', team: ['Sporting CP', 'Sporting', 'SCP', '#008057'] },
  { area: 'Netherlands', team: ['PSV', 'PSV', 'PSV', '#ed1c24'] },
  { area: 'Netherlands', team: ['Ajax', 'Ajax', 'AJA', '#d2122e'] },
  { area: 'Netherlands', team: ['Feyenoord', 'Feyenoord', 'FEY', '#e30613'] },
  { area: 'Scotland', team: ['Celtic', 'Celtic', 'CEL', '#018749'] },
  { area: 'Belgium', team: ['Club Brugge', 'Club Brugge', 'CLB', '#0065b3'] },
  { area: 'Turkey', team: ['Galatasaray', 'Galatasaray', 'GAL', '#a90432'] },
  { area: 'Austria', team: ['Red Bull Salzburg', 'Salzburg', 'RBS', '#d0021b'] },
  { area: 'Croatia', team: ['Dinamo Zagreb', 'Dinamo Zagreb', 'DZG', '#0033a0'] },
  { area: 'Switzerland', team: ['BSC Young Boys', 'Young Boys', 'YB', '#fbd200'] },
  { area: 'Czechia', team: ['Slavia Praha', 'Slavia Praha', 'SLA', '#c8102e'] },
  { area: 'Greece', team: ['Olympiacos', 'Olympiacos', 'OLY', '#d71920'] },
  { area: 'Denmark', team: ['FC København', 'København', 'FCK', '#1e3a8a'] },
  { area: 'Norway', team: ['Bodø/Glimt', 'Bodø/Glimt', 'BOD', '#fcd116'] },
];

const NATIONS: { group: string; team: TeamSeed }[] = [
  { group: 'Group A1', team: ['Spain', 'Spain', 'ESP', '#c60b1e'] },
  { group: 'Group A1', team: ['Portugal', 'Portugal', 'POR', '#006600'] },
  { group: 'Group A1', team: ['Netherlands', 'Netherlands', 'NED', '#f36c21'] },
  { group: 'Group A1', team: ['Scotland', 'Scotland', 'SCO', '#1c2c5b'] },
  { group: 'Group A2', team: ['France', 'France', 'FRA', '#002395'] },
  { group: 'Group A2', team: ['Italy', 'Italy', 'ITA', '#0066cc'] },
  { group: 'Group A2', team: ['Belgium', 'Belgium', 'BEL', '#e30613'] },
  { group: 'Group A2', team: ['Denmark', 'Denmark', 'DEN', '#c8102e'] },
  { group: 'Group A3', team: ['Germany', 'Germany', 'GER', '#1f2937'] },
  { group: 'Group A3', team: ['Croatia', 'Croatia', 'CRO', '#e1261c'] },
  { group: 'Group A3', team: ['Switzerland', 'Switzerland', 'SUI', '#d52b1e'] },
  { group: 'Group A3', team: ['Norway', 'Norway', 'NOR', '#ba0c2f'] },
  { group: 'Group A4', team: ['England', 'England', 'ENG', '#1e3a8a'] },
  { group: 'Group A4', team: ['Brazil', 'Brazil', 'BRA', '#009c3b'] },
  { group: 'Group A4', team: ['Argentina', 'Argentina', 'ARG', '#75aadb'] },
  { group: 'Group A4', team: ['Wales', 'Wales', 'WAL', '#c8102e'] },
];

const FIRST = [
  'Alex', 'Ben', 'Callum', 'Dani', 'Eli', 'Femi', 'Gabe', 'Hugo', 'Isaac', 'Jonah', 'Kai', 'Luca', 'Marco',
  'Nico', 'Omar', 'Pablo', 'Quinn', 'Rafa', 'Sami', 'Theo', 'Umar', 'Victor', 'Wes', 'Xavi', 'Yusuf', 'Zane',
  'Leo', 'Mateo', 'Jude', 'Ruben', 'Emil', 'Jonas', 'Lorenzo', 'Matteo', 'Oscar', 'Jules', 'Iker', 'Joao',
  'Adam', 'Bruno', 'Cesar', 'Diego', 'Erik', 'Felix', 'Goncalo', 'Hamza', 'Ilias', 'Kobe', 'Liam', 'Milan',
];
const LAST = [
  'Adeyemi', 'Barros', 'Carver', 'Duarte', 'Ekwueme', 'Fischer', 'Gallo', 'Hartley', 'Ivanov', 'Jansen',
  'Kovac', 'Lindqvist', 'Mensah', 'Novak', 'Okafor', 'Petit', 'Quaresma', 'Rinaldi', 'Silva', 'Toure', 'Ueda',
  'Vidal', 'Walsh', 'Yilmaz', 'Zielinski', 'Moreau', 'Osei', 'Brandt', 'Castro', 'Doherty', 'Lange', 'Bernard',
  'Esposito', 'Navarro', 'Hoffmann', 'Lefebvre', 'Romero', 'Keller', 'Marchetti', 'Aguirre', 'Dubois', 'Vogel',
  'Andersen', 'Berg', 'Costa', 'Delaney', 'Eriksen', 'Ferreira', 'Garcia', 'Hansen', 'Jovic', 'Kruger',
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

/** Circle-method round robin: returns [home, away] pairs per round. */
export function roundRobin<T>(items: T[]): [T, T][][] {
  const ids = [...items];
  const rounds: [T, T][][] = [];
  for (let r = 0; r < ids.length - 1; r++) {
    const round: [T, T][] = [];
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

function seasonLabel(now: Date): string {
  const start = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${start}/${String(start + 1).slice(2)}`;
}

function ref(t: Team): TeamRef {
  return { id: t.id, name: t.name, shortName: t.shortName, tla: t.tla, crest: t.crest, color: t.color };
}

interface DemoWorld {
  season: string;
  competitions: Competition[];
  data: Map<string, CompetitionData>;
  teams: Map<number, Team>;
  /** Players by club; national teams pick from these by nationality. */
  clubPlayers: Map<number, Player[]>;
  nationSquads: Map<number, Player[]>;
  matches: Match[];
  transfers: Transfer[];
}

export function buildDemoWorld(now = new Date()): DemoWorld {
  const rand = mulberry32(2026);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const comp = (code: string) => COMPETITIONS.find((c) => c.code === code)!;
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const at = (dayOffset: number, hour: number, minute = 0) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    d.setUTCHours(hour, minute);
    return d;
  };

  let matchId = 10_000;
  const scoreFor = () => {
    const r = rand();
    return r < 0.25 ? 0 : r < 0.6 ? 1 : r < 0.85 ? 2 : r < 0.96 ? 3 : 4;
  };
  /** Builds a match; kick-offs in the past are finished, and ones under way are live. */
  const makeMatch = (code: string, home: Team, away: Team, kickoff: Date, matchday: number, stage?: string): Match => {
    const elapsed = (now.getTime() - kickoff.getTime()) / 60_000;
    let status: Match['status'] = 'SCHEDULED';
    let minute: number | undefined;
    if (elapsed >= 115) status = 'FINISHED';
    else if (elapsed >= 0) {
      status = 'LIVE';
      minute = Math.min(90, Math.max(1, Math.round(elapsed > 45 && elapsed < 60 ? 45 : elapsed > 60 ? elapsed - 15 : elapsed)));
    }
    const played = status !== 'SCHEDULED';
    const share = status === 'LIVE' ? (minute ?? 0) / 90 : 1;
    const c = comp(code);
    return {
      id: matchId++,
      competition: { code: c.code, name: c.name },
      utcDate: kickoff.toISOString(),
      status,
      minute,
      matchday,
      stage,
      home: ref(home),
      away: ref(away),
      homeScore: played ? Math.round(scoreFor() * share) : null,
      awayScore: played ? Math.round(scoreFor() * share) : null,
    };
  };

  const teams = new Map<number, Team>();
  const leagueTeams = new Map<string, Team[]>();
  for (const [code, { idBase, nation, teams: seeds }] of Object.entries(LEAGUE_TEAMS)) {
    const c = comp(code);
    const list = seeds.map(([name, shortName, tla, color], i) => {
      const t: Team = { id: idBase + i, name, shortName, tla, color, area: nation, league: { code, name: c.name } };
      teams.set(t.id, t);
      return t;
    });
    leagueTeams.set(code, list);
  }
  const extraClubs = EXTRA_CL.map(({ area, team: [name, shortName, tla, color] }, i) => {
    const t: Team = { id: 501 + i, name, shortName, tla, color, area };
    teams.set(t.id, t);
    return t;
  });
  const nations = NATIONS.map(({ team: [name, shortName, tla, color] }, i) => {
    const t: Team = { id: 901 + i, name, shortName, tla, color, area: name, national: true };
    teams.set(t.id, t);
    return t;
  });

  const matches: Match[] = [];

  // Domestic leagues: weekly rounds, five played, this weekend's round, then two more.
  const PLAYED = 5;
  const kickoffs: [number, number][] = [[11, 30], [14, 0], [14, 0], [14, 0], [16, 30], [19, 0], [13, 0], [15, 15], [17, 30], [19, 45]];
  for (const [code, list] of leagueTeams) {
    const rounds = roundRobin(list).slice(0, PLAYED + 3);
    rounds.forEach((round, r) => {
      round.forEach(([home, away], i) => {
        const [h, m] = kickoffs[i % kickoffs.length];
        const dayOffset = (r - PLAYED) * 7 + (i >= 7 ? 1 : 0);
        matches.push(makeMatch(code, home, away, at(dayOffset, h, m), r + 1));
      });
    });
  }

  // Champions League league phase: 36 clubs, 8 matchdays, two played.
  const clTeams = [...[...leagueTeams.values()].flatMap((l) => l.slice(0, 4)), ...extraClubs];
  const clDays = [-19, -5, 9, 23, 37, 51, 65, 79];
  roundRobin(clTeams)
    .slice(0, 8)
    .forEach((round, r) => {
      round.forEach(([home, away], i) => {
        const tuesday = i < round.length / 2;
        matches.push(
          makeMatch('CL', home, away, at(clDays[r] + (tuesday ? 0 : 1), i % 3 === 0 ? 16 : 19, i % 3 === 0 ? 45 : 0), r + 1, 'League phase'),
        );
      });
    });

  // Nations League: four groups of four, home and away.
  const groupNames = [...new Set(NATIONS.map((n) => n.group))];
  const nlDays = [-24, -21, 12, 15, 47, 50];
  const nlGroups: StandingGroup[] = [];
  for (const group of groupNames) {
    const members = nations.filter((_, i) => NATIONS[i].group === group);
    const firstLeg = roundRobin(members);
    const legs = [...firstLeg, ...firstLeg.map((round) => round.map(([a, b]) => [b, a] as [Team, Team]))];
    const groupMatches = legs.flatMap((round, r) =>
      round.map(([home, away], i) => makeMatch('UNL', home, away, at(nlDays[r], i ? 18 : 16, 45), r + 1, group)),
    );
    matches.push(...groupMatches);
    nlGroups.push({ name: group, rows: computeStandings(members.map(ref), groupMatches) });
  }

  // Squads with stats consistent with the matches played in their competition.
  const clubPlayers = new Map<number, Player[]>();
  let playerId = 1;
  const usedNames = new Set<string>();
  const nationNames = NATIONS.map((n) => n.team[0]);
  const makeSquad = (team: Team, code: string, played: Match[]) => {
    const c = comp(code);
    const conceded = played.map((m) => (m.home.id === team.id ? m.awayScore! : m.homeScore!));
    const cleanSheets = conceded.filter((x) => x === 0).length;
    const squad = SQUAD_SHAPE.map((position, idx) => {
      let name = `${pick(FIRST)} ${pick(LAST)}`;
      // The name pool is finite, so fall back to a middle initial rather than looping forever.
      for (let tries = 0; usedNames.has(name); tries++)
        name = tries < 20 ? `${pick(FIRST)} ${pick(LAST)}` : `${pick(FIRST)} ${pick(FIRST)[0]}. ${pick(LAST)}`;
      usedNames.add(name);
      const starter = idx % 5 !== 1;
      const games = played.length;
      const appearances = starter ? Math.max(0, games - Math.floor(rand() * 2)) : Math.floor(rand() * Math.min(3, games + 1));
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
      // Roughly half the squad is from the club's own country.
      const nationality = rand() < 0.5 && team.area ? team.area : pick(nationNames);
      const player: Player = {
        id: playerId++,
        name,
        teamId: team.id,
        team: ref(team),
        competition: { code: c.code, name: c.name },
        position,
        nationality,
        age: 18 + Math.floor(rand() * 17),
        price: estimatePrice(position, stats, starter ? 1 : 0.6),
        stats,
      };
      return player;
    });
    clubPlayers.set(team.id, squad);
    return squad;
  };
  const finishedFor = (teamId: number, code: string) =>
    matches.filter(
      (m) => m.competition.code === code && m.status === 'FINISHED' && (m.home.id === teamId || m.away.id === teamId),
    );
  for (const [code, list] of leagueTeams) for (const t of list) makeSquad(t, code, finishedFor(t.id, code));
  for (const t of extraClubs) makeSquad(t, 'CL', finishedFor(t.id, 'CL'));

  // National squads: best 23 players of each nationality across all clubs.
  const allClubPlayers = [...clubPlayers.values()].flat();
  const nationSquads = new Map<number, Player[]>();
  for (const n of nations) {
    const pool = allClubPlayers
      .filter((p) => p.nationality === n.name)
      .sort((a, b) => fantasyPoints(b.position, b.stats) - fantasyPoints(a.position, a.stats));
    const squad = (['GK', 'DEF', 'MID', 'FWD'] as Position[]).flatMap((pos) =>
      pool.filter((p) => p.position === pos).slice(0, { GK: 3, DEF: 7, MID: 7, FWD: 6 }[pos]),
    );
    nationSquads.set(n.id, squad);
  }

  const season = seasonLabel(now);
  const data = new Map<string, CompetitionData>();
  for (const [code, list] of leagueTeams) {
    const compMatches = matches.filter((m) => m.competition.code === code);
    data.set(code, {
      competition: comp(code),
      season,
      teams: list,
      players: list.flatMap((t) => clubPlayers.get(t.id)!),
      matches: compMatches,
      standings: [{ rows: computeStandings(list.map(ref), compMatches) }],
    });
  }
  const clMatches = matches.filter((m) => m.competition.code === 'CL');
  data.set('CL', {
    competition: comp('CL'),
    season,
    teams: clTeams,
    // CL stats for clubs outside the big five; league stats for the rest.
    players: clTeams.flatMap((t) => clubPlayers.get(t.id)!),
    matches: clMatches,
    standings: [{ name: 'League phase', rows: computeStandings(clTeams.map(ref), clMatches) }],
  });
  data.set('UNL', {
    competition: comp('UNL'),
    season,
    teams: nations,
    players: nations.flatMap((n) => nationSquads.get(n.id)!),
    matches: matches.filter((m) => m.competition.code === 'UNL'),
    standings: nlGroups,
  });

  // Transfer activity, including moves between leagues.
  const types: TransferType[] = ['permanent', 'permanent', 'loan', 'free', 'rumour'];
  const clubs = [...leagueTeams.values()].flat().concat(extraClubs);
  const transfers: Transfer[] = [];
  for (let i = 0; i < 60; i++) {
    const player = pick(allClubPlayers);
    const from = teams.get(player.teamId)!;
    const to = pick(clubs.filter((t) => t.id !== from.id));
    const type = pick(types);
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - Math.floor(rand() * 90) + (type === 'rumour' ? 30 : 0));
    transfers.push({
      id: `t${i}`,
      playerName: player.name,
      playerId: player.id,
      competitionCode: player.competition.code,
      from: ref(from),
      to: ref(to),
      fee:
        type === 'permanent' ? `£${5 + Math.floor(rand() * 70)}m`
        : type === 'loan' ? 'Loan'
        : type === 'free' ? 'Free'
        : `£${10 + Math.floor(rand() * 60)}m (reported)`,
      date: date.toISOString(),
      type,
    });
  }
  transfers.sort((a, b) => b.date.localeCompare(a.date));

  return { season, competitions: COMPETITIONS, data, teams, clubPlayers, nationSquads, matches, transfers };
}

let world: DemoWorld | null = null;
const getWorld = () => (world ??= buildDemoWorld());

export const demoProvider: DataProvider = {
  id: 'demo',
  competitions: COMPETITIONS,

  async loadCompetition(code) {
    const d = getWorld().data.get(code);
    if (!d) throw new Error(`Unknown competition ${code}`);
    return d;
  },

  async loadMatches(from, to) {
    return getWorld().matches.filter((m) => {
      const t = Date.parse(m.utcDate);
      return t >= from.getTime() && t <= to.getTime();
    });
  },

  async loadTeam(id): Promise<TeamData> {
    const w = getWorld();
    const team = w.teams.get(id);
    if (!team) throw new Error('Team not found');
    const matches = w.matches.filter((m) => m.home.id === id || m.away.id === id);
    const codes = [...new Set(matches.map((m) => m.competition.code))];
    return {
      team,
      competitions: w.competitions.filter((c) => codes.includes(c.code)).map((c) => ({ code: c.code, name: c.name })),
      squad: (team.national ? w.nationSquads.get(id) : w.clubPlayers.get(id)) ?? [],
      matches,
    };
  },

  async loadTransfers() {
    return getWorld().transfers;
  },
};
