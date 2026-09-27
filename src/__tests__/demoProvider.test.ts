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
