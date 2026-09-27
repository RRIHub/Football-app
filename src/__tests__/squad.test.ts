import { describe, expect, it } from 'vitest';
import { buildDemoData } from '../data/demoProvider';
import type { Player } from '../data/types';
import { addBlocker, applyFormation, BUDGET, EMPTY_SQUAD, squadPlayers, type Squad } from '../state/squad';

const make = (id: number, position: Player['position'], teamId: number, price = 5): Player => ({
  id,
  name: `P${id}`,
  teamId,
  position,
  nationality: 'England',
  price,
  stats: { appearances: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, minutes: 0 },
});

describe('squad rules', () => {
  it('limits players per position by formation', () => {
    const players = [make(1, 'GK', 1), make(2, 'GK', 2)];
    const squad: Squad = { ...EMPTY_SQUAD, playerIds: [1] };
    expect(addBlocker(squad, squadPlayers(squad, players), players[1])).toMatch(/No GK slots/);
  });

  it('limits players per club', () => {
    const players = [make(1, 'DEF', 1), make(2, 'DEF', 1), make(3, 'MID', 1), make(4, 'FWD', 1)];
    const squad: Squad = { ...EMPTY_SQUAD, playerIds: [1, 2, 3] };
    expect(addBlocker(squad, squadPlayers(squad, players), players[3])).toMatch(/Max 3/);
  });

  it('enforces the budget', () => {
    const players = [make(1, 'FWD', 1, BUDGET - 5), make(2, 'FWD', 2, 5.5)];
    const squad: Squad = { ...EMPTY_SQUAD, playerIds: [1] };
    expect(addBlocker(squad, squadPlayers(squad, players), players[1])).toBe('Over budget');
  });

  it('drops extra players and the captain when the formation shrinks', () => {
    const players = [make(1, 'FWD', 1), make(2, 'FWD', 2), make(3, 'FWD', 3)];
    const squad: Squad = { ...EMPTY_SQUAD, formation: '4-3-3', playerIds: [1, 2, 3], captainId: 3 };
    const next = applyFormation(squad, players, '4-5-1');
    expect(next.playerIds).toEqual([1]);
    expect(next.captainId).toBeNull();
  });
});

describe('demo data', () => {
  const data = buildDemoData(new Date('2026-09-27T12:00:00Z'));

  it('is internally consistent', () => {
    const teamIds = new Set(data.teams.map((t) => t.id));
    expect(data.players.every((p) => teamIds.has(p.teamId))).toBe(true);
    expect(data.matches.every((m) => teamIds.has(m.homeTeamId) && teamIds.has(m.awayTeamId))).toBe(true);
    expect(data.standings).toHaveLength(data.teams.length);
    expect(data.standings.every((r) => r.played === 5)).toBe(true);
  });

  it('includes live, finished and upcoming matches', () => {
    const statuses = new Set(data.matches.map((m) => m.status));
    expect(statuses).toEqual(new Set(['LIVE', 'FINISHED', 'SCHEDULED', 'POSTPONED']));
  });

  it('makes a full XI affordable', () => {
    const cheapest = (pos: Player['position'], n: number) =>
      data.players.filter((p) => p.position === pos).map((p) => p.price).sort((a, b) => a - b).slice(0, n);
    const total = [...cheapest('GK', 1), ...cheapest('DEF', 4), ...cheapest('MID', 3), ...cheapest('FWD', 3)].reduce(
      (a, b) => a + b,
    );
    expect(total).toBeLessThan(BUDGET);
  });
});
