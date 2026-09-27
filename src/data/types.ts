export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest?: string;
  color: string;
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
  utcDate: string;
  status: MatchStatus;
  minute?: number;
  matchday?: number;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
}

export interface StandingRow {
  position: number;
  teamId: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export type TransferType = 'permanent' | 'loan' | 'free' | 'rumour';

export interface Transfer {
  id: string;
  playerName: string;
  playerId?: number;
  fromTeamId?: number;
  fromName: string;
  toTeamId?: number;
  toName: string;
  fee?: string;
  date: string;
  type: TransferType;
}

export interface FootballData {
  competition: string;
  season: string;
  teams: Team[];
  players: Player[];
  matches: Match[];
  standings: StandingRow[];
  transfers: Transfer[];
  /** True when the current provider can't supply transfers. */
  transfersUnavailable?: boolean;
  fetchedAt: string;
}

export interface DataProvider {
  readonly id: 'live' | 'demo';
  load(): Promise<FootballData>;
  /** Refresh just the fixtures/results (used for live polling). */
  loadMatches(): Promise<Match[]>;
}
