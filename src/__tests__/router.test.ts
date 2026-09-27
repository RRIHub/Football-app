import { describe, expect, it } from 'vitest';
import { href, parseHash } from '../state/router';

describe('router', () => {
  it('round-trips league, team and player routes', () => {
    expect(parseHash(href.league('CL'))).toEqual({ page: 'league', code: 'CL' });
    expect(parseHash(href.team(57))).toEqual({ page: 'team', id: 57 });
    expect(parseHash(href.player('PD', 123))).toEqual({ page: 'player', code: 'PD', id: 123 });
  });

  it('falls back sensibly on bad routes', () => {
    expect(parseHash('#/team/abc')).toEqual({ page: 'leagues' });
    expect(parseHash('#/player/PL')).toEqual({ page: 'players' });
    expect(parseHash('#/nope')).toEqual({ page: 'home' });
  });
});
