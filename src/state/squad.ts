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

/** Players are stored whole so a squad can mix leagues without reloading them all. */
export interface Squad {
  name: string;
  formation: Formation;
  players: Player[];
  captainId: number | null;
}

export const EMPTY_SQUAD: Squad = { name: 'My FootIQ XI', formation: '4-3-3', players: [], captainId: null };

export function isSquad(v: unknown): v is Squad {
  const s = v as Squad;
  return (
    typeof s === 'object' && s !== null && typeof s.name === 'string' && s.formation in FORMATIONS && Array.isArray(s.players)
  );
}

export function spent(squad: Squad): number {
  return Math.round(squad.players.reduce((sum, p) => sum + p.price, 0) * 10) / 10;
}

/** Returns why a player can't be added, or null if they can. */
export function addBlocker(squad: Squad, player: Player): string | null {
  const selected = squad.players;
  if (selected.some((p) => p.id === player.id)) return 'Already in your team';
  const slots = FORMATIONS[squad.formation][player.position];
  if (selected.filter((p) => p.position === player.position).length >= slots)
    return `No ${player.position} slots left in ${squad.formation}`;
  if (selected.filter((p) => p.teamId === player.teamId).length >= MAX_PER_CLUB)
    return `Max ${MAX_PER_CLUB} players per club`;
  if (spent(squad) + player.price > BUDGET + 1e-9) return 'Over budget';
  return null;
}

/** Drops players that no longer fit after a formation change (latest picks go first). */
export function applyFormation(squad: Squad, formation: Formation): Squad {
  const limits = FORMATIONS[formation];
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  const players = squad.players.filter((p) => ++counts[p.position] <= limits[p.position]);
  return {
    ...squad,
    formation,
    players,
    captainId: players.some((p) => p.id === squad.captainId) ? squad.captainId : null,
  };
}

export function projectedPoints(squad: Squad): number {
  return squad.players.reduce((sum, p) => {
    const pts = fantasyPoints(p.position, p.stats);
    return sum + (p.id === squad.captainId ? pts * 2 : pts);
  }, 0);
}
