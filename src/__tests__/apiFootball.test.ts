import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiFootballProvider,
  mapFixture,
  mapLeague,
  mapStatus,
  mapTransferType,
  parseRound,
  unwrap,
} from '../data/apiFootball';

const ars = { id: 42, name: 'Arsenal', code: 'ARS', logo: 'ars.png', country: 'England', national: false };
const che = { id: 49, name: 'Chelsea', code: 'CHE', logo: 'che.png', country: 'England', national: false };
const fixture = (over: Record<string, unknown> = {}) => ({
  fixture: { id: 1, date: '2026-09-27T14:00:00+00:00', status: { short: '2H', elapsed: 67, extra: null } },
  league: { id: 39, name: 'Premier League', round: 'Regular Season - 6' },
  teams: { home: ars, away: che },
  goals: { home: 2, away: 1 },
  score: { penalty: { home: null, away: null } },
  ...over,
});

describe('API-Football mapping', () => {
  it('classifies leagues, cups, continental and international competitions', () => {
    const entry = (id: number, name: string, type: 'League' | 'Cup', country: string) => ({
      league: { id, name, type, logo: `${id}.png` },
      country: { name: country, code: null, flag: null },
      seasons: [{ year: 2025, current: false }, { year: 2026, current: true }],
    });
    expect(mapLeague(entry(41, 'League One', 'League', 'England'))).toMatchObject({
      code: '41', category: 'domestic', format: 'league', featured: true, season: 2026, area: 'England',
    });
    expect(mapLeague(entry(45, 'FA Cup', 'Cup', 'England'))).toMatchObject({ category: 'cup', format: 'knockout' });
    expect(mapLeague(entry(2, 'UEFA Champions League', 'Cup', 'World'))).toMatchObject({ category: 'europe' });
    expect(mapLeague(entry(32, 'World Cup - Qualification Europe', 'Cup', 'World'))).toMatchObject({ category: 'international' });
    expect(mapLeague(entry(4, 'Euro Championship', 'Cup', 'World')).category).toBe('international');
    expect(mapLeague(entry(999, 'Liga 3', 'League', 'Romania')).featured).toBe(false);
    expect(mapLeague(entry(253, 'Major League Soccer', 'League', 'USA'))).toMatchObject({ category: 'domestic', featured: true });
    expect(mapLeague(entry(307, 'Pro League', 'League', 'Saudi-Arabia'))).toMatchObject({ category: 'domestic', featured: true });
    expect(mapLeague(entry(848, 'UEFA Europa Conference League', 'Cup', 'World'))).toMatchObject({ category: 'europe', featured: true });
    expect(mapLeague(entry(3, 'UEFA Europa League', 'Cup', 'World'))).toMatchObject({ category: 'europe', featured: true });
    // International tournaments and friendlies.
    expect(mapLeague(entry(9, 'Copa America', 'Cup', 'World'))).toMatchObject({ category: 'international', featured: true });
    expect(mapLeague(entry(6, 'Africa Cup of Nations', 'Cup', 'World'))).toMatchObject({ category: 'international', featured: true });
    expect(mapLeague(entry(5, 'UEFA Nations League', 'Cup', 'World'))).toMatchObject({ category: 'international', format: 'groups' });
    expect(mapLeague(entry(10, 'Friendlies', 'Cup', 'World'))).toMatchObject({ category: 'international', format: 'knockout', featured: true });
    // Club competitions stay out of the international section.
    expect(mapLeague(entry(667, 'Friendlies Clubs', 'Cup', 'World'))).toMatchObject({ category: 'cup', format: 'knockout' });
    expect(mapLeague(entry(15, 'FIFA Club World Cup', 'Cup', 'World')).category).toBe('europe');
  });

  it('names seasons from their dates', () => {
    const league = (id: number, name: string, country: string, seasons: object[]) =>
      mapLeague({ league: { id, name, type: 'League', logo: '' }, country: { name: country, code: null, flag: null }, seasons } as never);
    expect(league(39, 'Premier League', 'England', [{ year: 2026, current: true, start: '2026-08-15', end: '2027-05-23' }]).seasonLabel).toBe('2026/27');
    expect(league(253, 'Major League Soccer', 'USA', [{ year: 2026, current: true, start: '2026-02-21', end: '2026-12-05' }]).seasonLabel).toBe('2026');
    expect(league(1, 'World Cup', 'World', [{ year: 2026, current: true }]).seasonLabel).toBe('2026');
  });

  it('maps every live and finished status accurately', () => {
    expect(mapStatus('1H')).toBe('LIVE');
    expect(mapStatus('HT')).toBe('LIVE');
    expect(mapStatus('ET')).toBe('LIVE');
    expect(mapStatus('P')).toBe('LIVE');
    expect(mapStatus('FT')).toBe('FINISHED');
    expect(mapStatus('AET')).toBe('FINISHED');
    expect(mapStatus('PEN')).toBe('FINISHED');
    expect(mapStatus('PST')).toBe('POSTPONED');
    expect(mapStatus('NS')).toBe('SCHEDULED');
    expect(mapStatus('TBD')).toBe('SCHEDULED');
  });

  it('shows the minute, half-time, stoppage time and shoot-outs', () => {
    expect(mapFixture(fixture())).toMatchObject({ status: 'LIVE', minute: 67, statusText: undefined, matchday: 6 });
    const ht = mapFixture(fixture({ fixture: { id: 1, date: '2026-09-27T14:00:00Z', status: { short: 'HT', elapsed: 45 } } }));
    expect(ht).toMatchObject({ status: 'LIVE', statusText: 'HT', minute: undefined });
    const added = mapFixture(fixture({ fixture: { id: 1, date: '2026-09-27T14:00:00Z', status: { short: '2H', elapsed: 90, extra: 4 } } }));
    expect(added.statusText).toBe("90+4'");
    const pens = mapFixture(
      fixture({
        fixture: { id: 1, date: '2026-09-27T14:00:00Z', status: { short: 'PEN', elapsed: 120 } },
        goals: { home: 1, away: 1 },
        score: { penalty: { home: 3, away: 4 } },
      }),
    );
    expect(pens).toMatchObject({ status: 'FINISHED', statusText: 'Pens', note: 'Chelsea win 4-3 on penalties' });
  });

  it('keeps kick-off as an exact instant', () => {
    expect(mapFixture(fixture({ fixture: { id: 1, date: '2026-09-27T15:30:00+01:00', status: { short: 'NS', elapsed: null } } })).utcDate).toBe(
      '2026-09-27T14:30:00.000Z',
    );
  });

  it('parses rounds', () => {
    expect(parseRound('Regular Season - 7')).toEqual({ matchday: 7 });
    expect(parseRound('Group A - 2')).toEqual({ matchday: 2, stage: 'Group A' });
    expect(parseRound('Round of 16')).toEqual({ stage: 'Round of 16' });
    expect(parseRound(null)).toEqual({});
  });

  it('reads transfer types and fees', () => {
    expect(mapTransferType('€ 25M')).toEqual({ type: 'permanent', fee: '€25m' });
    expect(mapTransferType('Loan')).toEqual({ type: 'loan', fee: 'Loan' });
    expect(mapTransferType('Back from Loan')).toEqual({ type: 'loan', fee: 'Loan return' });
    expect(mapTransferType('Free')).toEqual({ type: 'free', fee: 'Free' });
    expect(mapTransferType('N/A')).toEqual({ type: 'permanent', fee: undefined });
  });

  it('turns provider errors into exceptions', () => {
    expect(() => unwrap({ errors: { requests: 'You have reached the request limit for the day' }, response: [] })).toThrow(
      /request limit/,
    );
    expect(unwrap({ errors: [], response: [1] })).toEqual([1]);
  });
});

describe('API-Football provider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists transfers for followed teams, newest first, without duplicates', async () => {
    const recent = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    const older = new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10);
    const ancient = '2019-07-01';
    const body = {
      errors: [],
      response: [
        {
          player: { id: 7, name: 'A Player' },
          transfers: [
            { date: recent, type: '€ 30M', teams: { in: ars, out: che } },
            { date: older, type: 'Loan', teams: { in: che, out: ars } },
            { date: ancient, type: 'Free', teams: { in: ars, out: che } },
          ],
        },
      ],
    };
    const fetch = vi.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => body }) as Response);
    vi.stubGlobal('fetch', fetch);
    // Both clubs report the same moves; each should appear once.
    const list = (await apiFootballProvider.loadTransfers([42, 49]))!;
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      `/api/api-football?path=${encodeURIComponent('/transfers?team=42')}`,
      `/api/api-football?path=${encodeURIComponent('/transfers?team=49')}`,
    ]);
    expect(list.map((t) => [t.type, t.fee, t.to.name])).toEqual([
      ['permanent', '€30m', 'Arsenal'],
      ['loan', 'Loan', 'Chelsea'],
    ]);
  });
});

describe('API-Football team pages', () => {
  afterEach(() => vi.unstubAllGlobals());

  it("load the whole season's matches in every competition", async () => {
    const f = (id: number, league: number, name: string, date: string, short = 'FT') =>
      fixture({
        fixture: { id, date, status: { short, elapsed: short === 'FT' ? 90 : null } },
        league: { id: league, name, round: 'Regular Season - 1' },
      });
    const league = (id: number, name: string, type: 'League' | 'Cup') => ({
      league: { id, name, type, logo: '' },
      country: { name: 'England', code: 'GB', flag: null },
      seasons: [{ year: 2026, current: true, start: '2026-08-15', end: '2027-05-23' }],
    });
    const byPath: Record<string, unknown> = {
      '/teams?id=42': [{ team: ars }],
      '/players/squads?team=42': [],
      '/leagues?current=true': [league(39, 'Premier League', 'League'), league(48, 'League Cup', 'Cup')],
    };
    const fetch = vi.fn(async (url: string) => {
      const path = new URL(url, 'http://x').searchParams.get('path')!;
      const p = new URL(path, 'http://x');
      let response: unknown = byPath[p.pathname + p.search.replace(/&timezone=[^&]*/, '')];
      if (p.pathname === '/fixtures' && p.searchParams.get('last')) response = [f(1, 39, 'Premier League', '2026-09-20T14:00:00Z')];
      if (p.pathname === '/fixtures' && p.searchParams.get('next')) response = [f(2, 39, 'Premier League', '2026-10-04T14:00:00Z', 'NS')];
      if (p.pathname === '/fixtures' && p.searchParams.get('season') === '2026')
        response = [
          f(3, 48, 'League Cup', '2026-08-27T18:45:00Z'),
          f(1, 39, 'Premier League', '2026-09-20T14:00:00Z'),
          f(4, 39, 'Premier League', '2027-05-23T15:00:00Z', 'NS'),
        ];
      return { ok: true, status: 200, json: async () => ({ errors: [], response: response ?? [] }) } as Response;
    });
    vi.stubGlobal('fetch', fetch);
    const team = await apiFootballProvider.loadTeam(42);
    expect(team.matches.map((m) => m.id)).toEqual([3, 1, 2, 4]);
    expect(team.team.league).toEqual({ code: '39', name: 'Premier League' });
    expect(team.competitions.map((c) => c.name).sort()).toEqual(['League Cup', 'Premier League']);
  });
});
