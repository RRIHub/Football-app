import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveProvider } from '../data/liveProvider';

const ars = { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: 'ars.png' };
const rma = { id: 86, name: 'Real Madrid CF', shortName: 'Real Madrid', tla: 'RMA', crest: 'rma.png' };

const responses: Record<string, unknown> = {
  '/competitions/CL/teams': {
    competition: { name: 'UEFA Champions League', emblem: 'cl.png' },
    season: { startDate: '2026-09-15' },
    teams: [
      { ...ars, clubColors: 'Red / White', area: { name: 'England' }, squad: [{ id: 1, name: 'A Keeper', position: 'Goalkeeper', dateOfBirth: '2000-01-01', nationality: 'England' }] },
      { ...rma, clubColors: 'White / Purple', area: { name: 'Spain' }, squad: [] },
    ],
  },
  '/competitions/CL/matches': {
    matches: [
      { id: 9, utcDate: '2026-09-16T19:00:00Z', status: 'FINISHED', matchday: 1, stage: 'LEAGUE_STAGE', group: null, homeTeam: ars, awayTeam: rma, score: { fullTime: { home: 2, away: 1 } } },
    ],
  },
  '/competitions/CL/scorers?limit=100': {
    scorers: [{ player: { id: 2, name: 'B Striker', nationality: 'Brazil', section: 'Offence' }, team: rma, playedMatches: 1, goals: 1, assists: 0 }],
  },
  '/competitions/CL/standings': {
    standings: [
      { type: 'TOTAL', stage: 'LEAGUE_STAGE', group: null, table: [{ position: 1, team: ars, playedGames: 1, won: 1, draw: 0, lost: 0, points: 3, goalsFor: 2, goalsAgainst: 1 }] },
      { type: 'HOME', stage: 'LEAGUE_STAGE', group: null, table: [] },
    ],
  },
  '/teams/57': {
    ...ars,
    clubColors: 'Red / White',
    area: { name: 'England' },
    runningCompetitions: [
      { code: 'PL', name: 'Premier League', type: 'LEAGUE' },
      { code: 'CL', name: 'UEFA Champions League', type: 'CUP' },
    ],
    squad: [],
  },
  '/teams/57/matches': {
    matches: [
      { id: 9, utcDate: '2026-09-16T19:00:00Z', status: 'FINISHED', matchday: 1, stage: 'LEAGUE_STAGE', competition: { code: 'CL', name: 'UEFA Champions League' }, homeTeam: ars, awayTeam: rma, score: { fullTime: { home: 2, away: 1 } } },
    ],
  },
};

afterEach(() => vi.unstubAllGlobals());

function stubFetch() {
  const fetch = vi.fn(async (url: string) => {
    // The browser calls /api/football-data?path=<football-data path>.
    const u = new URL(url, 'http://x');
    const body = u.pathname === '/api/football-data' ? responses[u.searchParams.get('path')!] : undefined;
    return { ok: Boolean(body), status: body ? 200 : 404, json: async () => body } as Response;
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('live provider', () => {
  it('loads a competition with its table, players and labelled matches', async () => {
    stubFetch();
    const cl = await liveProvider.loadCompetition('CL');
    expect(cl.competition.emblem).toBe('cl.png');
    expect(cl.season).toBe('2026/27');
    expect(cl.standings).toHaveLength(1);
    expect(cl.standings[0].rows[0].team.color).toBe('#d7263d');
    expect(cl.matches[0].competition).toEqual({ code: 'CL', name: 'UEFA Champions League' });
    expect(cl.matches[0].stage).toBe('League stage');
    const striker = cl.players.find((p) => p.id === 2)!;
    expect(striker).toMatchObject({ position: 'FWD', team: { id: 86 }, competition: { code: 'CL' } });
    expect(striker.stats.goals).toBe(1);
  });

  it("shows a club's league and all the competitions it plays in", async () => {
    stubFetch();
    const t = await liveProvider.loadTeam(57);
    expect(t.team.league).toEqual({ code: 'PL', name: 'Premier League' });
    expect(t.team.national).toBe(false);
    expect(t.competitions.map((c) => c.code)).toEqual(['PL', 'CL']);
    expect(t.matches[0].competition.code).toBe('CL');
  });
});
