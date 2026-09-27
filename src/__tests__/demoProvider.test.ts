import { describe, expect, it } from 'vitest';
import { buildDemoWorld } from '../data/demoProvider';
import { BUDGET } from '../state/squad';
import type { Player } from '../data/types';

const world = buildDemoWorld(new Date('2026-09-27T15:00:00Z'));

describe('demo world', () => {
  it('covers leagues, a cup, a European competition and international matches', () => {
    const cats = new Set(world.competitions.map((c) => c.category));
    expect(cats).toEqual(new Set(['domestic', 'cup', 'europe', 'international']));
    for (const c of world.competitions) expect(world.data.get(c.code)?.matches.length).toBeGreaterThan(0);
  });

  it('labels every match with its competition', () => {
    const codes = new Set(world.competitions.map((c) => c.code));
    expect(world.matches.every((m) => codes.has(m.competition.code))).toBe(true);
  });

  it('gives every club its league', () => {
    for (const c of world.competitions.filter((c) => c.category === 'domestic')) {
      const d = world.data.get(c.code)!;
      expect(d.teams.every((t) => t.league?.code === c.code)).toBe(true);
      expect(d.standings[0].rows).toHaveLength(d.teams.length);
    }
  });

  it('includes lower divisions with their own tables and squads', () => {
    const elc = world.data.get('ELC')!;
    const l1 = world.data.get('EL1')!;
    expect(elc.teams).toHaveLength(24);
    expect(l1.teams).toHaveLength(24);
    expect(l1.standings[0].rows).toHaveLength(24);
    expect(l1.players.length).toBe(24 * 15);
    expect(l1.teams.every((t) => t.league?.name === 'League One')).toBe(true);
  });

  it('shows half-time rather than a frozen minute during the break', () => {
    const ht = buildDemoWorld(new Date('2026-09-27T14:52:00Z')).matches.filter((m) => m.statusText === 'HT');
    expect(ht.length).toBeGreaterThan(0);
    expect(ht.every((m) => m.status === 'LIVE' && m.minute === undefined)).toBe(true);
  });

  it('plays Champions League clubs from several leagues', () => {
    const cl = world.data.get('CL')!;
    expect(cl.teams).toHaveLength(36);
    const leagues = new Set(cl.teams.map((t) => t.league?.code ?? t.area));
    expect(leagues.size).toBeGreaterThan(5);
  });

  it('has national-team groups with squads drawn from clubs', () => {
    const unl = world.data.get('UNL')!;
    expect(unl.standings.length).toBe(4);
    expect(unl.teams.every((t) => t.national)).toBe(true);
    const england = unl.teams.find((t) => t.name === 'England')!;
    const squad = world.nationSquads.get(england.id)!;
    expect(squad.length).toBeGreaterThan(11);
    expect(squad.every((p) => p.nationality === 'England')).toBe(true);
  });

  it('computes standings from finished matches only', () => {
    const pl = world.data.get('PL')!;
    const finished = pl.matches.filter((m) => m.status === 'FINISHED').length;
    const played = pl.standings[0].rows.reduce((n, r) => n + r.played, 0);
    expect(played).toBe(finished * 2);
  });

  it('makes a full XI affordable', () => {
    const players = world.data.get('PL')!.players;
    const cheapest = (pos: Player['position'], n: number) =>
      players.filter((p) => p.position === pos).map((p) => p.price).sort((a, b) => a - b).slice(0, n);
    const total = [...cheapest('GK', 1), ...cheapest('DEF', 4), ...cheapest('MID', 3), ...cheapest('FWD', 3)].reduce(
      (a, b) => a + b,
    );
    expect(total).toBeLessThan(BUDGET);
  });
});

describe('demo transfers', () => {
  it('never dates a transfer or rumour in the future', () => {
    const now = new Date('2026-09-27T15:00:00Z');
    const w = buildDemoWorld(now);
    expect(w.transfers.every((t) => Date.parse(t.date) <= now.getTime())).toBe(true);
  });
});

describe('demo international football', () => {
  const now = new Date('2026-09-27T15:00:00Z');
  const w = buildDemoWorld(now);
  const confOf = (id: number) => w.teams.get(id)!;

  it('covers the World Cup, Euros, Copa América, AFCON, Nations League and friendlies', () => {
    for (const code of ['WC', 'EC', 'CA', 'AFCON', 'UNL', 'FRI']) {
      const c = w.competitions.find((x) => x.code === code)!;
      expect(c.category).toBe('international');
      expect(w.data.get(code)!.matches.length).toBeGreaterThan(0);
    }
  });

  it('plays a finished World Cup from groups through to a single final', () => {
    const wc = w.data.get('WC')!;
    expect(wc.standings).toHaveLength(8);
    expect(wc.matches.every((m) => m.status === 'FINISHED')).toBe(true);
    const stages = ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'].map(
      (s) => wc.matches.filter((m) => m.stage === s).length,
    );
    expect(stages).toEqual([8, 4, 2, 1]);
    // Every knockout team topped or finished second in its group.
    const qualified = new Set(wc.standings.flatMap((g) => g.rows.slice(0, 2).map((r) => r.team.id)));
    for (const m of wc.matches.filter((m) => m.stage === 'Round of 16')) {
      expect(qualified.has(m.home.id) && qualified.has(m.away.id)).toBe(true);
    }
  });

  it('only shows group fixtures for tournaments that have not started', () => {
    for (const code of ['EC', 'CA', 'AFCON']) {
      const t = w.data.get(code)!;
      expect(t.matches.every((m) => m.status === 'SCHEDULED' && m.stage?.startsWith('Group'))).toBe(true);
      expect(t.standings.every((g) => g.rows.length === 4 && g.rows.every((r) => r.played === 0))).toBe(true);
    }
  });

  it('keeps each tournament to its own confederation', () => {
    const names = (code: string) => w.data.get(code)!.teams.map((t) => t.name);
    expect(names('UNL')).not.toContain('Brazil');
    expect(names('UNL')).toContain('England');
    expect(names('AFCON')).toEqual(expect.arrayContaining(['Morocco', 'Senegal', 'Nigeria']));
    expect(names('AFCON')).not.toContain('France');
    expect(names('CA')).toEqual(expect.arrayContaining(['Brazil', 'Argentina', 'Mexico']));
    expect(names('EC')).not.toContain('Brazil');
    expect(w.data.get('WC')!.teams.every((t) => confOf(t.id).national)).toBe(true);
  });

  it('plays friendlies in international windows without a table', () => {
    const fri = w.data.get('FRI')!;
    expect(fri.competition.format).toBe('knockout');
    expect(fri.standings).toEqual([]);
    expect(new Set(fri.matches.map((m) => m.stage))).toEqual(new Set(['September window', 'October window']));
    // Nations League sides are busy with their own fixtures.
    const nl = new Set(w.data.get('UNL')!.teams.map((t) => t.id));
    expect(fri.matches.every((m) => !nl.has(m.home.id) && !nl.has(m.away.id))).toBe(true);
  });

  it('picks national squads from players of that nationality', () => {
    const morocco = w.data.get('AFCON')!.teams.find((t) => t.name === 'Morocco')!;
    const squad = w.nationSquads.get(morocco.id)!;
    expect(squad.length).toBeGreaterThan(11);
    expect(squad.every((p) => p.nationality === 'Morocco')).toBe(true);
  });
});
