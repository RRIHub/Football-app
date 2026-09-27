import { describe, expect, it } from 'vitest';
import { mapPosition, mapStatus } from '../data/liveProvider';

describe('live provider mapping', () => {
  it('maps detailed and legacy positions', () => {
    expect(mapPosition('Goalkeeper')).toBe('GK');
    expect(mapPosition('Centre-Back')).toBe('DEF');
    expect(mapPosition('Defence')).toBe('DEF');
    expect(mapPosition('Defensive Midfield')).toBe('MID');
    expect(mapPosition('Left Winger')).toBe('FWD');
    expect(mapPosition('Offence')).toBe('FWD');
    expect(mapPosition(null)).toBe('MID');
  });

  it('maps match statuses', () => {
    expect(mapStatus('IN_PLAY')).toBe('LIVE');
    expect(mapStatus('PAUSED')).toBe('LIVE');
    expect(mapStatus('TIMED')).toBe('SCHEDULED');
    expect(mapStatus('AWARDED')).toBe('FINISHED');
    expect(mapStatus('CANCELLED')).toBe('POSTPONED');
  });
});

describe('stage labels', () => {
  it('prettifies football-data stage and group names', async () => {
    const { prettyStage } = await import('../data/liveProvider');
    expect(prettyStage('GROUP_A')).toBe('Group A');
    expect(prettyStage('LAST_16')).toBe('Last 16');
    expect(prettyStage('LEAGUE_STAGE')).toBe('League stage');
    expect(prettyStage(null)).toBeUndefined();
  });
});
