import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDemoNews, buildDemoWorld } from '../data/demoProvider';
import { guardianNews, plainText, teamQuery } from '../data/guardianNews';

afterEach(() => vi.unstubAllGlobals());

describe('guardian news', () => {
  it('strips HTML from summaries', () => {
    expect(plainText('<p>Arsenal &amp; <strong>Spurs</strong> draw</p>')).toBe('Arsenal & Spurs draw');
    expect(plainText('')).toBeUndefined();
  });

  it('builds an OR query of team names', () => {
    expect(teamQuery([{ name: 'Arsenal' }, { name: 'Real "Madrid"' }])).toBe('"Arsenal" OR "Real Madrid"');
  });

  it('maps results and filters by team through the proxy', async () => {
    const fetch = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({
        response: {
          results: [
            {
              id: 'football/2026/sep/27/x',
              webTitle: 'Arsenal win again',
              webUrl: 'https://www.theguardian.com/football/2026/sep/27/x',
              webPublicationDate: '2026-09-27T12:00:00Z',
              fields: { trailText: '<p>Report</p>', thumbnail: 'https://img/x.jpg' },
            },
          ],
        },
      }),
    }));
    vi.stubGlobal('fetch', fetch);
    const items = await guardianNews.load([{ id: 1, name: 'Arsenal' }]);
    const url = new URL(fetch.mock.calls[0][0], 'http://x');
    expect(url.pathname).toBe('/news-api/search');
    expect(url.searchParams.get('section')).toBe('football');
    expect(url.searchParams.get('q')).toBe('"Arsenal"');
    expect(url.searchParams.has('api-key')).toBe(false);
    expect(items[0]).toMatchObject({ title: 'Arsenal win again', summary: 'Report', source: 'The Guardian' });
  });
});

describe('demo cup and news', () => {
  const now = new Date('2026-09-27T15:00:00Z');
  const world = buildDemoWorld(now);

  it('plays a knockout cup where winners go through to the next round', () => {
    const cup = world.data.get('EFL')!;
    expect(cup.competition.format).toBe('knockout');
    const third = cup.matches.filter((m) => m.stage === 'Third round');
    const fourth = cup.matches.filter((m) => m.stage === 'Fourth round');
    expect(third).toHaveLength(16);
    expect(fourth).toHaveLength(8);
    expect(third.every((m) => m.status === 'FINISHED')).toBe(true);
    for (const m of third.filter((m) => m.homeScore === m.awayScore)) expect(m.note).toMatch(/on penalties/);
    const winners = new Set(
      third.map((m) =>
        m.homeScore !== m.awayScore
          ? (m.homeScore! > m.awayScore! ? m.home : m.away).id
          : (m.note!.startsWith(`${m.home.shortName} win`) ? m.home : m.away).id,
      ),
    );
    expect(new Set(fourth.flatMap((m) => [m.home.id, m.away.id]))).toEqual(winners);
  });

  it('writes news from results and transfers, newest first, tagged with teams', () => {
    const items = buildDemoNews(world, now);
    expect(items.length).toBeGreaterThan(20);
    expect(items.every((n) => n.teamIds?.length)).toBe(true);
    const dates = items.map((n) => n.publishedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(items.some((n) => /beat|thrash|draw|penalties/.test(n.title))).toBe(true);
    expect(items.some((n) => /knock out .* on penalties/.test(n.title))).toBe(true);
    expect(items.some((n) => /sign|loan|monitoring/.test(n.title))).toBe(true);
  });
});
