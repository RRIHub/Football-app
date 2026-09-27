import { describe, expect, it } from 'vitest';
import { buildDemoWorld, buildMatchDetails } from '../data/demoProvider';
import { mapMatchDetails } from '../data/apiFootball';
import { mapFdMatchDetail, type FdMatchDetail } from '../data/liveProvider';
import type { MatchEvent } from '../data/types';

const GOALS: MatchEvent['type'][] = ['goal', 'penalty', 'own-goal'];

describe('demo match details', () => {
  const w = buildDemoWorld(new Date('2026-09-27T15:00:00Z'));
  const finished = w.matches.filter((m) => m.status === 'FINISHED').slice(0, 400);

  it('always agree with the score, and are the same every time', () => {
    for (const m of finished) {
      const d = buildMatchDetails(w, m.id);
      const goals = (teamId: number) => d.events.filter((e) => e.teamId === teamId && GOALS.includes(e.type)).length;
      expect([goals(m.home.id), goals(m.away.id)]).toEqual([m.homeScore, m.awayScore]);
      expect(d.halfTime!.home! + 0).toBeLessThanOrEqual(m.homeScore!);
      expect(buildMatchDetails(w, m.id)).toEqual(d);
    }
  });

  it('have full line-ups, and events only by players on the pitch at the time', () => {
    for (const m of finished) {
      const d = buildMatchDetails(w, m.id);
      expect(d.lineups).toHaveLength(2);
      for (const l of d.lineups) {
        expect(l.startXI).toHaveLength(11);
        expect(l.startXI.filter((p) => p.position === 'G')).toHaveLength(1);
      }
      const onPitch = new Map(d.lineups.map((l) => [l.teamId, new Set(l.startXI.map((p) => p.id))]));
      const allOnPitch = () => new Set([...onPitch.values()].flatMap((s) => [...s]));
      for (const e of d.events) {
        if (e.type === 'sub') {
          const team = onPitch.get(e.teamId)!;
          expect(team.has(e.playerOff!.id)).toBe(true);
          const bench = d.lineups.find((l) => l.teamId === e.teamId)!.substitutes.map((p) => p.id);
          expect(bench).toContain(e.playerOn!.id);
          team.delete(e.playerOff!.id);
          team.add(e.playerOn!.id);
          continue;
        }
        expect(allOnPitch().has(e.player!.id)).toBe(true);
        if (e.assist) {
          expect(e.assist.id).not.toBe(e.player!.id);
          expect(onPitch.get(e.teamId)!.has(e.assist.id)).toBe(true);
        }
      }
    }
  });

  it('have stats that agree with the events', () => {
    for (const m of finished.slice(0, 100)) {
      const d = buildMatchDetails(w, m.id);
      const stat = (label: string) => d.stats.find((s) => s.label === label)!;
      expect(parseInt(String(stat('Possession').home)) + parseInt(String(stat('Possession').away))).toBe(100);
      expect(Number(stat('Shots on target').home)).toBeGreaterThanOrEqual(m.homeScore!);
      expect(Number(stat('Shots').away)).toBeGreaterThanOrEqual(Number(stat('Shots on target').away));
      const yellows = d.events.filter((e) => e.teamId === m.home.id && e.type === 'yellow').length;
      expect(stat('Yellow cards').home).toBe(yellows);
    }
  });

  it('show nothing before kick-off, and only what has happened in a live match', () => {
    const scheduled = w.matches.find((m) => m.status === 'SCHEDULED')!;
    expect(buildMatchDetails(w, scheduled.id)).toMatchObject({ events: [], lineups: [], stats: [] });
    for (const m of w.matches.filter((x) => x.status === 'LIVE')) {
      const d = buildMatchDetails(w, m.id);
      const limit = m.minute ?? 45;
      expect(d.events.every((e) => e.minute <= limit)).toBe(true);
    }
  });
});

describe('API-Football match details', () => {
  const team = (id: number, name: string) => ({ id, name, logo: '', code: null });
  const p = (id: number, name: string, pos: string, grid: string) => ({ player: { id, name, number: id, pos, grid } });
  const fixture = {
    fixture: { id: 99, date: '2026-09-27T14:00:00+00:00', status: { short: 'FT', elapsed: 90 }, referee: 'A Ref', venue: { name: 'Ground', city: 'Town' } },
    league: { id: 39, name: 'Premier League', round: 'Regular Season - 6' },
    teams: { home: team(1, 'Home FC'), away: team(2, 'Away FC') },
    goals: { home: 2, away: 1 },
    score: { halftime: { home: 1, away: 0 }, penalty: { home: null, away: null } },
    lineups: [
      { team: { id: 2 }, coach: { name: 'Away Coach' }, formation: '4-4-2', startXI: [p(20, 'Away Keeper', 'G', '1:1'), p(21, 'Away Striker', 'F', '4:1')], substitutes: [p(30, 'Away Sub', 'F', '')] },
      { team: { id: 1 }, coach: { name: 'Home Coach' }, formation: '4-3-3', startXI: [p(1, 'Home Keeper', 'G', '1:1'), p(9, 'Home Nine', 'F', '4:2'), p(7, 'Home Seven', 'F', '4:1')], substitutes: [p(12, 'Home Sub', 'F', '')] },
    ],
    events: [
      { time: { elapsed: 90, extra: 3 }, team: { id: 1 }, player: { id: 12, name: 'Home Sub' }, assist: { id: null, name: null }, type: 'Goal', detail: 'Penalty' },
      { time: { elapsed: 12 }, team: { id: 1 }, player: { id: 9, name: 'Home Nine' }, assist: { id: 7, name: 'Home Seven' }, type: 'Goal', detail: 'Normal Goal' },
      { time: { elapsed: 60 }, team: { id: 1 }, player: { id: 12, name: 'Home Sub' }, assist: { id: 9, name: 'Home Nine' }, type: 'subst', detail: 'Substitution 1' },
      // Direction reversed in the feed: the player already on the pitch is `player` here.
      { time: { elapsed: 70 }, team: { id: 2 }, player: { id: 21, name: 'Away Striker' }, assist: { id: 30, name: 'Away Sub' }, type: 'subst', detail: 'Substitution 1' },
      { time: { elapsed: 80 }, team: { id: 2 }, player: { id: 30, name: 'Away Sub' }, assist: { id: null, name: null }, type: 'Goal', detail: 'Normal Goal' },
      { time: { elapsed: 85 }, team: { id: 2 }, player: { id: 20, name: 'Away Keeper' }, assist: { id: null, name: null }, type: 'Card', detail: 'Yellow Card' },
    ],
    statistics: [
      { team: { id: 2 }, statistics: [{ type: 'Ball Possession', value: '45%' }, { type: 'Shots on Goal', value: 2 }] },
      { team: { id: 1 }, statistics: [{ type: 'Ball Possession', value: '55%' }, { type: 'Shots on Goal', value: 6 }] },
    ],
  };

  it('maps goals with assists, cards, substitutions, line-ups and stats', () => {
    const d = mapMatchDetails(fixture as never);
    expect(d).toMatchObject({ venue: 'Ground, Town', referee: 'A Ref', halfTime: { home: 1, away: 0 } });
    expect(d.events.map((e) => [e.minute, e.type])).toEqual([
      [12, 'goal'], [60, 'sub'], [70, 'sub'], [80, 'goal'], [85, 'yellow'], [90, 'penalty'],
    ]);
    expect(d.events[0]).toMatchObject({ player: { name: 'Home Nine' }, assist: { name: 'Home Seven' } });
    expect(d.events[5]).toMatchObject({ extra: 3, player: { name: 'Home Sub' } });
    // Substitution direction comes from who was on the pitch, whichever way round the feed has it.
    expect(d.events[1]).toMatchObject({ playerOn: { name: 'Home Sub' }, playerOff: { name: 'Home Nine' } });
    expect(d.events[2]).toMatchObject({ playerOn: { name: 'Away Sub' }, playerOff: { name: 'Away Striker' } });
    expect(d.lineups.map((l) => [l.teamId, l.formation, l.coach])).toEqual([[1, '4-3-3', 'Home Coach'], [2, '4-4-2', 'Away Coach']]);
    expect(d.lineups[0].startXI[1]).toMatchObject({ name: 'Home Nine', position: 'F', grid: '4:2', code: '39' });
    expect(d.stats).toEqual([
      { label: 'Possession', home: '55%', away: '45%' },
      { label: 'Shots on target', home: 6, away: 2 },
    ]);
  });
});

describe('football-data.org match details', () => {
  const base = {
    id: 5,
    utcDate: '2026-09-27T14:00:00Z',
    status: 'FINISHED',
    matchday: 6,
    competition: { code: 'PL', name: 'Premier League' },
    homeTeam: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: null },
    awayTeam: { id: 61, name: 'Chelsea FC', shortName: 'Chelsea', tla: 'CHE', crest: null },
    score: { fullTime: { home: 2, away: 1 }, halfTime: { home: 1, away: 1 } },
    venue: 'Emirates Stadium',
    referees: [{ name: 'Assistant', type: 'ASSISTANT_REFEREE_N1' }, { name: 'Main Ref', type: 'REFEREE' }],
  } as FdMatchDetail;

  it('says what the free plan leaves out', () => {
    const d = mapFdMatchDetail(base);
    expect(d).toMatchObject({ venue: 'Emirates Stadium', referee: 'Main Ref', halfTime: { home: 1, away: 1 } });
    expect(d.unavailable).toEqual(['events', 'lineups', 'stats']);
  });

  it('uses deep data when the plan includes it', () => {
    const d = mapFdMatchDetail({
      ...base,
      goals: [
        { minute: 30, team: { id: 57 }, type: 'REGULAR', scorer: { id: 1, name: 'Scorer' }, assist: { id: 2, name: 'Helper' } },
        { minute: 50, injuryTime: null, team: { id: 61 }, type: 'PENALTY', scorer: { id: 3, name: 'Pen Taker' }, assist: null },
      ],
      bookings: [{ minute: 40, team: { id: 61 }, player: { id: 4, name: 'Booked' }, card: 'YELLOW_RED' }],
      substitutions: [{ minute: 70, team: { id: 57 }, playerOut: { id: 1, name: 'Scorer' }, playerIn: { id: 5, name: 'Fresh' } }],
      homeTeam: { ...base.homeTeam, formation: '4-3-3', coach: { name: 'Coach' }, lineup: [{ id: 1, name: 'Scorer', position: 'Centre-Forward', shirtNumber: 9 }], bench: [], statistics: { ball_possession: 58, shots_on_goal: 5 } },
      awayTeam: { ...base.awayTeam, lineup: [{ id: 3, name: 'Pen Taker', position: 'Goalkeeper', shirtNumber: 1 }], bench: [], statistics: { ball_possession: 42, shots_on_goal: 2 } },
    });
    expect(d.unavailable).toBeUndefined();
    expect(d.events.map((e) => e.type)).toEqual(['goal', 'second-yellow', 'penalty', 'sub']);
    expect(d.events[0]).toMatchObject({ player: { name: 'Scorer' }, assist: { name: 'Helper' } });
    expect(d.events[3]).toMatchObject({ playerOn: { name: 'Fresh' }, playerOff: { name: 'Scorer' } });
    expect(d.lineups[0]).toMatchObject({ formation: '4-3-3', coach: 'Coach', startXI: [{ name: 'Scorer', number: 9, position: 'F' }] });
    expect(d.stats).toEqual([
      { label: 'Possession', home: '58%', away: '42%' },
      { label: 'Shots on target', home: 5, away: 2 },
    ]);
  });
});
