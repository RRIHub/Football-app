export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export type CompetitionCategory = 'domestic' | 'cup' | 'europe' | 'international';

export interface Competition {
  code: string;
  name: string;
  /** Country or region, e.g. "England", "Europe", "World". */
  area: string;
  flag?: string;
  emblem?: string;
  category: CompetitionCategory;
  /** One table, several group tables, or knockout rounds with no table. */
  format: 'league' | 'groups' | 'knockout';
  /** Shown in quick pickers; everything else is reached through the country browser. */
  featured?: boolean;
  /** Season start year, for providers that need it in requests. */
  season?: number;
  /** Display name of the current season, e.g. "2026/27" or "2026". */
  seasonLabel?: string;
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
  /** Overrides the status label, e.g. "HT", "ET", "Pens", "AET". */
  statusText?: string;
  matchday?: number;
  /** e.g. "Group A", "League phase", "Round of 16". */
  stage?: string;
  home: TeamRef;
  away: TeamRef;
  homeScore: number | null;
  awayScore: number | null;
  /** Extra result detail, e.g. "Arsenal win 4-3 on penalties". */
  note?: string;
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
  readonly id: 'api-football' | 'football-data' | 'demo';
  /** Human-readable credit for the footer. */
  readonly attribution?: { label: string; url: string };
  listCompetitions(): Promise<Competition[]>;
  loadCompetition(code: string): Promise<CompetitionData>;
  /** Matches across every competition between two dates (inclusive). */
  loadMatches(from: Date, to: Date): Promise<Match[]>;
  loadTeam(id: number): Promise<TeamData>;
  /** Clubs and national teams whose name matches the query. */
  searchTeams(query: string): Promise<Team[]>;
  /**
   * Confirmed transfers, for the given teams if the provider needs them
   * (some feeds only list transfers per team). null when there's no feed.
   */
  loadTransfers(teamIds: number[]): Promise<Transfer[] | null>;
  /** True if loadTransfers needs team ids to return anything. */
  readonly transfersByTeam?: boolean;
  /** Full stats for one player, when the competition's data doesn't include them. */
  loadPlayer?(code: string, id: number): Promise<Player | undefined>;
}

export interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  /** Link to the original article (or an in-app route for demo stories). */
  url: string;
  source: string;
  publishedAt: string;
  image?: string;
  /** Teams the story is about, when the provider knows. */
  teamIds?: number[];
}

export interface NewsProvider {
  readonly id: 'guardian' | 'demo';
  /** Credit shown with the news, as required by the provider. */
  readonly attribution?: { label: string; url: string };
  /**
   * Latest football news, optionally only stories mentioning any of `teams`,
   * or only transfer stories (which is where rumours come from).
   */
  load(teams?: { id: number; name: string }[], topic?: 'transfers'): Promise<NewsItem[]>;
}
