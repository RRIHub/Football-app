import type { PlayerStats, Position } from './types';

const BASE: Record<Position, number> = { GK: 4.5, DEF: 4.5, MID: 5.0, FWD: 5.5 };

/**
 * Fantasy price in £m derived from output. `minutesShare` (0..1) nudges
 * regular starters above squad players. Rounded to the nearest £0.5m.
 */
export function estimatePrice(position: Position, stats: PlayerStats, minutesShare = 1): number {
  const perApp = stats.appearances ? (stats.goals * 1.0 + stats.assists * 0.6) / stats.appearances : 0;
  const defensive = position === 'GK' || position === 'DEF' ? stats.cleanSheets * 0.3 : 0;
  const raw = BASE[position] + perApp * 6 + defensive + minutesShare * 1.0;
  return Math.min(15, Math.round(raw * 2) / 2);
}

/** Simple fantasy points model used for projections in the team builder. */
export function fantasyPoints(position: Position, stats: PlayerStats): number {
  const goalPts = { GK: 10, DEF: 6, MID: 5, FWD: 4 }[position];
  const csPts = { GK: 4, DEF: 4, MID: 1, FWD: 0 }[position];
  return (
    stats.appearances * 2 +
    stats.goals * goalPts +
    stats.assists * 3 +
    stats.cleanSheets * csPts -
    stats.yellowCards -
    stats.redCards * 3
  );
}
