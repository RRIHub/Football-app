export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export type CompetitionCategory = 'domestic' | 'europe' | 'international';

export interface Competition {
  code: string;
  name: string;
  /** Country or region, e.g. "England", "Europe", "World". */
  area: string;
  flag?: string;
  emblem?: string;
  category: CompetitionCategory;
  /** Knockout-style tournaments have group tables instead of one league table. */
  format: 'league' | 'groups';
}

export interface CompetitionRef {
  code: string;
  name: string;
}

export interface TeamRef {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest?: string;
  color: string;
}

export interface Team extends TeamRef {
  national?: boolean;
  /** Country the club plays in, or the nation itself for national teams. */
  area?: string;
  /** The team's main league (domestic league for clubs). */
  league?: CompetitionRef;
}

export interface PlayerStats {
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  minutes: number;
}

export interface Player {
  id: number;
  name: string;
  teamId: number;
  team: TeamRef;
  /** Competition these stats are for (usually the club's league). */
  competition: CompetitionRef;
  position: Position;
  nationality: string;
  age?: number;
  /** Fantasy price in £m, used by the team builder. */
  price: number;
  stats: PlayerStats;
}

export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED';

export interface Match {
  id: number;
  competition: CompetitionRef;
  utcDate: string;
  status: MatchStatus;
  minute?: number;
  matchday?: number;
  /** e.g. "Group A", "League phase", "Round of 16". */
  stage?: string;
  home: TeamRef;
  away: TeamRef;
  homeScore: number | null;
  awayScore: number | null;
}

export interface StandingRow {
  position: number;
  team: TeamRef;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface StandingGroup {
  name?: string;
  rows: StandingRow[];
}

export type TransferType = 'permanent' | 'loan' | 'free' | 'rumour';

export interface Transfer {
  id: string;
  playerName: string;
  playerId?: number;
  competitionCode?: string;
  from: TeamRef;
  to: TeamRef;
  fee?: string;
  date: string;
  type: TransferType;
}

export interface CompetitionData {
  competition: Competition;
  season: string;
  teams: Team[];
  players: Player[];
  matches: Match[];
  standings: StandingGroup[];
}

export interface TeamData {
  team: Team;
  competitions: CompetitionRef[];
  squad: Player[];
  matches: Match[];
}

export interface DataProvider {
  readonly id: 'live' | 'demo';
  readonly competitions: Competition[];
  loadCompetition(code: string): Promise<CompetitionData>;
  /** Matches across every competition between two dates (inclusive). */
  loadMatches(from: Date, to: Date): Promise<Match[]>;
  loadTeam(id: number): Promise<TeamData>;
  /** null when the provider has no transfer feed. */
  loadTransfers(): Promise<Transfer[] | null>;
}
