import type { Player, Position } from '../data/types';
import { fantasyPoints } from '../data/pricing';

export const FORMATIONS = {
  '4-4-2': { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  '3-4-3': { GK: 1, DEF: 3, MID: 4, FWD: 3 },
  '4-5-1': { GK: 1, DEF: 4, MID: 5, FWD: 1 },
  '5-3-2': { GK: 1, DEF: 5, MID: 3, FWD: 2 },
} as const satisfies Record<string, Record<Position, number>>;

export type Formation = keyof typeof FORMATIONS;

export const BUDGET = 85;
export const MAX_PER_CLUB = 3;

export interface Squad {
  name: string;
  formation: Formation;
  playerIds: number[];
  captainId: number | null;
}

export const EMPTY_SQUAD: Squad = { name: 'My FootIQ XI', formation: '4-3-3', playerIds: [], captainId: null };

export function squadPlayers(squad: Squad, players: Player[]): Player[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  return squad.playerIds.map((id) => byId.get(id)).filter((p): p is Player => Boolean(p));
}

export function spent(selected: Player[]): number {
  return Math.round(selected.reduce((sum, p) => sum + p.price, 0) * 10) / 10;
}

/** Returns why a player can't be added, or null if they can. */
export function addBlocker(squad: Squad, selected: Player[], player: Player): string | null {
  if (squad.playerIds.includes(player.id)) return 'Already in your team';
  const slots = FORMATIONS[squad.formation][player.position];
  if (selected.filter((p) => p.position === player.position).length >= slots)
    return `No ${player.position} slots left in ${squad.formation}`;
  if (selected.filter((p) => p.teamId === player.teamId).length >= MAX_PER_CLUB)
    return `Max ${MAX_PER_CLUB} players per club`;
  if (spent(selected) + player.price > BUDGET + 1e-9) return 'Over budget';
  return null;
}

/** Drops players that no longer fit after a formation change (latest picks go first). */
export function applyFormation(squad: Squad, players: Player[], formation: Formation): Squad {
  const limits = FORMATIONS[formation];
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  const kept = squadPlayers(squad, players).filter((p) => ++counts[p.position] <= limits[p.position]);
  const playerIds = kept.map((p) => p.id);
  return {
    ...squad,
    formation,
    playerIds,
    captainId: squad.captainId !== null && playerIds.includes(squad.captainId) ? squad.captainId : null,
  };
}

export function projectedPoints(squad: Squad, selected: Player[]): number {
  return selected.reduce((sum, p) => {
    const pts = fantasyPoints(p.position, p.stats);
    return sum + (p.id === squad.captainId ? pts * 2 : pts);
  }, 0);
}
