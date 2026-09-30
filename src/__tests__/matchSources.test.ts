import { describe, expect, it, vi } from 'vitest';
import {
  findMatchDetails,
  mapOpenLiga,
  mapSportmonks,
  mapStatsBomb,
  openLigaShortcut,
  orientation,
  parseQuery,
  sameTeam,
  sbMinute,
  type OldbMatch,
  type SbEvent,
  type SmFixture,
  type SourceDetails,
} from '../../server/matchSources';
import { mergeExtras, missingParts } from '../data/matchExtras';
import type { MatchDetails } from '../data/types';

describe('matching the same match across providers', () => {
  it('recognises the same team under different names, and tells different teams apart', () => {
    expect(sameTeam('Bayer 04 Leverkusen', 'Bayer Leverkusen')).toBe(true);
    expect(sameTeam('1. FC Köln', 'FC Koln')).toBe(true);
    expect(sameTeam('Man United', 'Manchester United')).toBe(true);
    expect(sameTeam('Spain', 'Spain')).toBe(true);
    expect(sameTeam('Brighton & Hove Albion', 'Brighton and Hove Albion')).toBe(true);
    expect(sameTeam('Manchester United', 'Manchester City')).toBe(false);
    expect(sameTeam('Real Madrid CF', 'Real Sociedad')).toBe(false);
    expect(sameTeam('Borussia Dortmund', 'Borussia Mönchengladbach')).toBe(false);
  });

  it('needs the date and score to agree, and spots home/away listed the other way round', () => {
    const q = { home: 'Spain', away: 'England', kickoff: '2024-07-14T19:00:00Z', competition: 'Euro', homeScore: 2, awayScore: 1 };
    expect(orientation(q, { home: 'Spain', away: 'England', date: '2024-07-14T19:00:00Z', homeScore: 2, awayScore: 1 })).toBe('same');
    expect(orientation(q, { home: 'England', away: 'Spain', date: '2024-07-14T21:00:00Z', homeScore: 1, awayScore: 2 })).toBe('swapped');
    expect(orientation(q, { home: 'Spain', away: 'England', date: '2024-07-14T19:00:00Z', homeScore: 1, awayScore: 1 })).toBeNull();
    expect(orientation(q, { home: 'Spain', away: 'England', date: '2024-07-20T19:00:00Z', homeScore: 2, awayScore: 1 })).toBeNull();
    expect(orientation(q, { home: 'Spain', away: 'France', date: '2024-07-14T19:00:00Z' })).toBeNull();
  });

  it('knows which competitions OpenLigaDB covers', () => {
    expect(openLigaShortcut('Bundesliga')).toBe('bl1');
    expect(openLigaShortcut('2. Bundesliga')).toBe('bl2');
    expect(openLigaShortcut('3. Liga')).toBe('bl3');
    expect(openLigaShortcut('DFB-Pokal')).toBe('dfb');
    expect(openLigaShortcut('Frauen Bundesliga')).toBeNull();
    expect(openLigaShortcut('Premier League')).toBeNull();
  });

  it('validates requests', () => {
    expect(parseQuery('/api/match-details?home=A&away=B')).toMatch(/required/);
    expect(parseQuery('/api/match-details?home=A&away=B&kickoff=nope')).toMatch(/date/);
    expect(parseQuery('/api/match-details?home=A&away=B&kickoff=2024-07-14T19:00:00Z&homeScore=2&awayScore=x')).toMatchObject({
      homeScore: 2,
      awayScore: undefined,
    });
  });
});

describe('StatsBomb Open Data', () => {
  it('converts minutes, counting stoppage time as added time', () => {
    expect(sbMinute(1, 0)).toEqual({ minute: 1 });
    expect(sbMinute(1, 44)).toEqual({ minute: 45 });
    expect(sbMinute(1, 46)).toEqual({ minute: 45, extra: 2 });
    expect(sbMinute(2, 46)).toEqual({ minute: 47 });
    expect(sbMinute(2, 92)).toEqual({ minute: 90, extra: 3 });
    expect(sbMinute(3, 100)).toEqual({ minute: 101 });
    expect(sbMinute(4, 121)).toEqual({ minute: 120, extra: 2 });
  });

  it('builds the summary, line-ups and stats from events', () => {
    const H = { id: 1, name: 'Home' };
    const A = { id: 2, name: 'Away' };
    const p = (id: number, name: string) => ({ id, name });
    const ev = (o: Partial<SbEvent> & { type: { name: string }; team: typeof H }): SbEvent => ({ id: Math.random().toString(), period: 1, minute: 0, ...o });
    const events: SbEvent[] = [
      ev({ type: { name: 'Starting XI' }, team: H, tactics: { formation: 433, lineup: [{ player: p(10, 'Home Keeper Full'), position: p(1, 'Goalkeeper'), jersey_number: 1 }, { player: p(11, 'Home Nine'), position: p(23, 'Center Forward'), jersey_number: 9 }] } }),
      ev({ type: { name: 'Starting XI' }, team: A, tactics: { formation: 4231, lineup: [{ player: p(20, 'Away Keeper'), position: p(1, 'Goalkeeper'), jersey_number: 1 }] } }),
      ev({ id: 'pass1', type: { name: 'Pass' }, team: H, player: p(10, 'Home Keeper Full'), minute: 11, pass: { goal_assist: true }, possession_team: H, duration: 30 }),
      ev({ type: { name: 'Shot' }, team: H, player: p(11, 'Home Nine'), minute: 11, shot: { outcome: { name: 'Goal' }, statsbomb_xg: 0.4, key_pass_id: 'pass1' }, possession_team: H, duration: 10 }),
      ev({ type: { name: 'Own Goal Against' }, team: H, player: p(11, 'Home Nine'), period: 2, minute: 50, possession_team: A, duration: 60 }),
      ev({ type: { name: 'Shot' }, team: A, player: p(20, 'Away Keeper'), period: 2, minute: 60, shot: { outcome: { name: 'Saved' }, type: { name: 'Penalty' }, statsbomb_xg: 0.78 } }),
      ev({ type: { name: 'Foul Committed' }, team: A, player: p(20, 'Away Keeper'), period: 2, minute: 70, foul_committed: { card: { name: 'Second Yellow' } } }),
      ev({ type: { name: 'Substitution' }, team: H, player: p(11, 'Home Nine'), period: 2, minute: 80, substitution: { replacement: p(12, 'Home Sub') } }),
      ev({ type: { name: 'Shot' }, team: H, player: p(12, 'Home Sub'), period: 5, minute: 120, shot: { outcome: { name: 'Goal' }, type: { name: 'Penalty' } } }),
    ];
    const lineups = [
      { team_name: 'Home', lineup: [{ player_id: 10, player_name: 'Home Keeper Full', player_nickname: 'Keeper', jersey_number: 1 }, { player_id: 11, player_name: 'Home Nine', player_nickname: null, jersey_number: 9 }, { player_id: 12, player_name: 'Home Sub', player_nickname: null, jersey_number: 12 }] },
      { team_name: 'Away', lineup: [{ player_id: 20, player_name: 'Away Keeper', player_nickname: null, jersey_number: 1 }] },
    ];
    const match = {
      match_id: 1, match_date: '2024-07-14', kick_off: '19:00:00.000',
      home_team: { home_team_name: 'Home', managers: [{ name: 'Home Manager Full', nickname: 'Boss' }] },
      away_team: { away_team_name: 'Away' }, home_score: 1, away_score: 1,
      stadium: { name: 'Big Stadium' }, referee: { name: 'Ref' },
    };
    const d = mapStatsBomb(match, lineups, events);
    expect(d.events!.map((e) => [e.minute, e.side, e.type, e.player?.name, e.assist?.name])).toEqual([
      [12, 'home', 'goal', 'Home Nine', 'Keeper'],
      [51, 'away', 'own-goal', 'Home Nine', undefined],
      [61, 'away', 'missed-penalty', 'Away Keeper', undefined],
      [71, 'away', 'second-yellow', 'Away Keeper', undefined],
      [81, 'home', 'sub', undefined, undefined],
    ]);
    expect(d.events![4]).toMatchObject({ playerOn: { name: 'Home Sub' }, playerOff: { name: 'Home Nine' } });
    expect(d).toMatchObject({ halfTime: { home: 1, away: 0 }, venue: 'Big Stadium', referee: 'Ref', note: 'Home win 1-0 on penalties' });
    expect(d.lineups![0]).toMatchObject({ side: 'home', formation: '4-3-3', coach: 'Boss', startXI: [{ name: 'Keeper', number: 1, position: 'G', grid: '1:3' }, { name: 'Home Nine', position: 'F' }], substitutes: [{ name: 'Home Sub', number: 12 }] });
    expect(d.lineups![1].formation).toBe('4-2-3-1');
    const stat = (label: string) => d.stats!.find((s) => s.label === label);
    // Shoot-out kicks don't count as shots.
    expect(stat('Shots')).toEqual({ label: 'Shots', home: 1, away: 1 });
    expect(stat('Shots on target')).toEqual({ label: 'Shots on target', home: 1, away: 1 });
    expect(stat('Expected goals (xG)')).toEqual({ label: 'Expected goals (xG)', home: '0.40', away: '0.78' });
    expect(stat('Possession')).toEqual({ label: 'Possession', home: '40%', away: '60%' });
    expect(stat('Red cards')).toEqual({ label: 'Red cards', home: 0, away: 1 });
  });
});

describe('OpenLigaDB', () => {
  it('works out who scored from the running score', () => {
    const m: OldbMatch = {
      matchID: 1,
      matchDateTimeUTC: '2025-08-22T18:30:00Z',
      team1: { teamName: 'FC Bayern München' },
      team2: { teamName: 'RB Leipzig' },
      matchIsFinished: true,
      matchResults: [
        { resultTypeID: 1, pointsTeam1: 1, pointsTeam2: 0 },
        { resultTypeID: 2, pointsTeam1: 2, pointsTeam2: 1 },
      ],
      goals: [
        { scoreTeam1: 2, scoreTeam2: 1, matchMinute: 88, goalGetterName: 'Late Winner', isPenalty: true, isOwnGoal: false },
        { scoreTeam1: 1, scoreTeam2: 0, matchMinute: 20, goalGetterName: 'First', isPenalty: false, isOwnGoal: false },
        { scoreTeam1: 1, scoreTeam2: 1, matchMinute: 60, goalGetterName: 'Unlucky', isPenalty: false, isOwnGoal: true },
      ],
      location: { locationStadium: 'Allianz Arena', locationCity: 'München' },
    };
    const d = mapOpenLiga(m);
    expect(d.events!.map((e) => [e.minute, e.side, e.type, e.player?.name])).toEqual([
      [20, 'home', 'goal', 'First'],
      [60, 'away', 'own-goal', 'Unlucky'],
      [88, 'home', 'penalty', 'Late Winner'],
    ]);
    expect(d).toMatchObject({ halfTime: { home: 1, away: 0 }, venue: 'Allianz Arena, München', source: { name: 'OpenLigaDB' } });
    expect(d.lineups).toBeUndefined();
  });
});

const smFixture: SmFixture = {
  id: 77,
  starting_at: '2026-09-26 14:00:00',
  participants: [
    { id: 1, name: 'Celtic', meta: { location: 'home' } },
    { id: 2, name: 'Rangers', meta: { location: 'away' } },
  ],
  scores: [
    { description: '1ST_HALF', score: { goals: 1, participant: 'home' } },
    { description: '1ST_HALF', score: { goals: 0, participant: 'away' } },
    { description: 'CURRENT', score: { goals: 2, participant: 'home' } },
    { description: 'CURRENT', score: { goals: 1, participant: 'away' } },
  ],
  events: [
    { participant_id: 1, minute: 12, extra_minute: null, player_name: 'Scorer', related_player_name: 'Creator', type: { developer_name: 'GOAL' } },
    { participant_id: 2, minute: 60, extra_minute: null, player_name: 'On', related_player_name: 'Off', type: { developer_name: 'SUBSTITUTION' } },
    { participant_id: 2, minute: 70, extra_minute: null, player_name: 'Spot', related_player_name: null, type: { developer_name: 'PENALTY' } },
    { participant_id: 1, minute: 90, extra_minute: 4, player_name: 'Late', related_player_name: null, type: { developer_name: 'YELLOWCARD' } },
    { participant_id: 1, minute: 120, extra_minute: null, player_name: 'Shootout', related_player_name: null, type: { developer_name: 'PENALTY_SHOOTOUT_GOAL' } },
  ],
  lineups: [
    { team_id: 1, player_name: 'Keeper', jersey_number: 1, position_id: 24, formation_field: '1:1', type_id: 11, type: { developer_name: 'LINEUP' } },
    { team_id: 1, player_name: 'Bench', jersey_number: 20, position_id: 27, formation_field: null, type_id: 12, type: { developer_name: 'BENCH' } },
    { team_id: 2, player_name: 'Away Keeper', jersey_number: 1, position_id: 24, formation_field: '1:1', type_id: 11 },
  ],
  formations: [{ participant_id: 1, formation: '4-3-3', location: 'home' }],
  statistics: [
    { participant_id: 1, location: 'home', data: { value: 58 }, type: { developer_name: 'BALL_POSSESSION' } },
    { participant_id: 2, location: 'away', data: { value: 42 }, type: { developer_name: 'BALL_POSSESSION' } },
    { participant_id: 1, location: 'home', data: { value: 7 }, type: { developer_name: 'SHOTS_ON_TARGET' } },
  ],
  venue: { name: 'Celtic Park', city_name: 'Glasgow' },
};

describe('Sportmonks', () => {
  it('maps events (substitution direction included), line-ups, formations, stats and half-time', () => {
    const d = mapSportmonks(smFixture);
    expect(d.events!.map((e) => [e.minute, e.extra, e.side, e.type])).toEqual([
      [12, undefined, 'home', 'goal'],
      [60, undefined, 'away', 'sub'],
      [70, undefined, 'away', 'penalty'],
      [90, 4, 'home', 'yellow'],
    ]);
    expect(d.events![0]).toMatchObject({ player: { name: 'Scorer' }, assist: { name: 'Creator' } });
    expect(d.events![1]).toMatchObject({ playerOn: { name: 'On' }, playerOff: { name: 'Off' } });
    expect(d.lineups![0]).toMatchObject({ side: 'home', formation: '4-3-3', startXI: [{ name: 'Keeper', position: 'G', grid: '1:1' }], substitutes: [{ name: 'Bench', position: 'F' }] });
    expect(d.lineups![1].startXI[0].name).toBe('Away Keeper');
    expect(d.stats).toEqual([
      { label: 'Possession', home: '58%', away: '42%' },
      { label: 'Shots on target', home: 7, away: null },
    ]);
    expect(d).toMatchObject({ halfTime: { home: 1, away: 0 }, venue: 'Celtic Park, Glasgow' });
  });
});

describe('finding a match in each source', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('uses Sportmonks when a token is set, paging through the day', async () => {
    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = new URL(String(url));
      if (u.host === 'raw.githubusercontent.com') return json([]);
      if (u.host === 'api.openligadb.de') return json([]);
      expect(new Headers(init?.headers).get('Authorization')).toBe('sm-token');
      if (u.pathname.includes('/fixtures/date/'))
        return u.searchParams.get('page') === '1'
          ? json({ data: [{ ...smFixture, id: 1, participants: [{ id: 5, name: 'Other', meta: { location: 'home' } }, { id: 6, name: 'Team', meta: { location: 'away' } }] }], pagination: { has_more: true } })
          : json({ data: [smFixture], pagination: { has_more: false } });
      if (u.pathname.endsWith('/fixtures/77')) return json({ data: smFixture });
      return json({}, 404);
    });
    const found = await findMatchDetails(
      { home: 'Celtic FC', away: 'Rangers FC', kickoff: '2026-09-26T14:00:00Z', competition: 'Premiership', homeScore: 2, awayScore: 1 },
      { SPORTMONKS_API_TOKEN: 'sm-token' },
      fetch as typeof globalThis.fetch,
    );
    expect(found.map((f) => f.source.name)).toEqual(['Sportmonks']);
    expect(found[0].lineups).toHaveLength(2);
  });

  it('uses OpenLigaDB for German football, the right way round', async () => {
    const fetch = vi.fn(async (url: string | URL | Request) => {
      const u = new URL(String(url));
      if (u.host === 'api.openligadb.de') {
        expect(u.pathname).toBe('/getmatchdata/bl1/2026');
        return json([
          {
            matchID: 9,
            matchDateTimeUTC: '2026-09-26T13:30:00Z',
            team1: { teamName: 'Borussia Dortmund' },
            team2: { teamName: 'FC Bayern München' },
            matchIsFinished: true,
            matchResults: [{ resultTypeID: 2, pointsTeam1: 0, pointsTeam2: 1 }],
            goals: [{ scoreTeam1: 0, scoreTeam2: 1, matchMinute: 5, goalGetterName: 'Kane', isPenalty: false, isOwnGoal: false }],
          },
        ]);
      }
      return json([]);
    });
    // Our provider lists this fixture the other way round.
    const found = await findMatchDetails(
      { home: 'Bayern München', away: 'Borussia Dortmund', kickoff: '2026-09-26T13:30:00Z', competition: 'Bundesliga', homeScore: 1, awayScore: 0 },
      {},
      fetch as typeof globalThis.fetch,
    );
    expect(found.map((f) => f.source.name)).toEqual(['OpenLigaDB']);
    expect(found[0].events![0]).toMatchObject({ side: 'home', player: { name: 'Kane' } });
  });

  it('finds nothing rather than the wrong match', async () => {
    const fetch = vi.fn(async () => json([]));
    const found = await findMatchDetails({ home: 'A', away: 'B', kickoff: '2026-09-26T13:30:00Z', competition: 'Bundesliga' }, {}, fetch as typeof globalThis.fetch);
    expect(found).toEqual([]);
  });
});

describe('merging other sources into a match', () => {
  const base: MatchDetails = {
    match: {
      id: 1,
      competition: { code: 'EC', name: 'European Championship' },
      utcDate: '2024-07-14T19:00:00Z',
      status: 'FINISHED',
      home: { id: 760, name: 'Spain', shortName: 'Spain', tla: 'ESP', color: '#c00' },
      away: { id: 770, name: 'England', shortName: 'England', tla: 'ENG', color: '#00c' },
      homeScore: 2,
      awayScore: 1,
    },
    venue: 'Olympiastadion',
    events: [],
    lineups: [],
    stats: [],
    unavailable: ['events', 'lineups', 'stats'],
  };
  const sb: SourceDetails = {
    source: { name: 'StatsBomb Open Data', url: 'https://github.com/statsbomb/open-data' },
    events: [{ minute: 47, side: 'home', type: 'goal', player: { name: 'Nico Williams' }, assist: { name: 'Lamine Yamal' } }],
    lineups: [{ side: 'away', formation: '4-2-3-1', startXI: [{ name: 'Jordan Pickford' }], substitutes: [] }],
    stats: [{ label: 'Shots', home: 16, away: 9 }],
    halfTime: { home: 0, away: 0 },
    venue: 'Olympiastadion Berlin',
    referee: 'François Letexier',
  };

  it('fills only what is missing, maps sides to our teams, and credits the source', () => {
    expect(missingParts(base)).toEqual(['events', 'lineups', 'stats']);
    const d = mergeExtras(base, [sb]);
    expect(d.events[0]).toMatchObject({ teamId: 760, player: { name: 'Nico Williams' } });
    expect(d.lineups[0]).toMatchObject({ teamId: 770, formation: '4-2-3-1' });
    expect(d.stats).toEqual(sb.stats);
    expect(d).toMatchObject({ halfTime: { home: 0, away: 0 }, referee: 'François Letexier', venue: 'Olympiastadion' });
    expect(d.unavailable).toBeUndefined();
    expect(d.sources).toEqual([{ name: 'StatsBomb Open Data', url: 'https://github.com/statsbomb/open-data', parts: ['events', 'lineups', 'stats'] }]);
  });

  it("takes each part from the best source that has it and leaves the provider's own data alone", () => {
    const withStats: MatchDetails = { ...base, stats: [{ label: 'Shots', home: 1, away: 1 }], unavailable: ['events', 'lineups'] };
    const goalsOnly: SourceDetails = { source: { name: 'OpenLigaDB', url: 'x' }, events: [{ minute: 5, side: 'away', type: 'goal', player: { name: 'X' } }] };
    const d = mergeExtras(withStats, [goalsOnly, sb]);
    expect(d.events[0].player?.name).toBe('X');
    expect(d.lineups).toHaveLength(1);
    expect(d.stats).toEqual([{ label: 'Shots', home: 1, away: 1 }]);
    expect(d.sources!.map((s) => [s.name, s.parts])).toEqual([
      ['OpenLigaDB', ['events']],
      ['StatsBomb Open Data', ['lineups']],
    ]);
  });

  it("doesn't look anywhere for matches that haven't been played", () => {
    expect(missingParts({ ...base, match: { ...base.match, status: 'SCHEDULED', homeScore: null, awayScore: null } })).toEqual([]);
  });
});
