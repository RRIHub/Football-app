import { describe, expect, it } from 'vitest';
import type { Player } from '../data/types';
import { addBlocker, applyFormation, BUDGET, EMPTY_SQUAD, isSquad, type Squad } from '../state/squad';

const make = (id: number, position: Player['position'], teamId: number, price = 5): Player => ({
  id,
  name: `P${id}`,
  teamId,
  team: { id: teamId, name: `T${teamId}`, shortName: `T${teamId}`, tla: 'TTT', color: '#000' },
  competition: { code: 'PL', name: 'Premier League' },
  position,
  nationality: 'England',
  price,
  stats: { appearances: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, minutes: 0 },
});

const squadOf = (players: Player[], extra: Partial<Squad> = {}): Squad => ({ ...EMPTY_SQUAD, players, ...extra });

describe('squad rules', () => {
  it('limits players per position by formation', () => {
    expect(addBlocker(squadOf([make(1, 'GK', 1)]), make(2, 'GK', 2))).toMatch(/No GK slots/);
  });

  it('limits players per club', () => {
    const squad = squadOf([make(1, 'DEF', 1), make(2, 'DEF', 1), make(3, 'MID', 1)]);
    expect(addBlocker(squad, make(4, 'FWD', 1))).toMatch(/Max 3/);
    expect(addBlocker(squad, make(5, 'FWD', 2))).toBeNull();
  });

  it('enforces the budget', () => {
    expect(addBlocker(squadOf([make(1, 'FWD', 1, BUDGET - 5)]), make(2, 'FWD', 2, 5.5))).toBe('Over budget');
  });

  it('drops extra players and the captain when the formation shrinks', () => {
    const squad = squadOf([make(1, 'FWD', 1), make(2, 'FWD', 2), make(3, 'FWD', 3)], { captainId: 3 });
    const next = applyFormation(squad, '4-5-1');
    expect(next.players.map((p) => p.id)).toEqual([1]);
    expect(next.captainId).toBeNull();
  });

  it('rejects squads saved in an older format', () => {
    expect(isSquad({ name: 'x', formation: '4-3-3', playerIds: [1], captainId: null })).toBe(false);
    expect(isSquad(EMPTY_SQUAD)).toBe(true);
  });
});
