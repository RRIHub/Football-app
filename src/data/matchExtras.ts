// Fills in match details the main provider doesn't have (goals and assists,
// cards, subs, line-ups, stats) from other sources via /api/match-details:
// Sportmonks, OpenLigaDB and StatsBomb Open Data.

import type { SourceDetails } from '../../server/matchSources';
import type { Lineup, MatchDetails, MatchEvent } from './types';

type Part = 'events' | 'lineups' | 'stats';

const played = (d: MatchDetails) => d.match.status === 'FINISHED' || d.match.status === 'LIVE';

/** Parts of a played match that are missing: not supplied, or empty. */
export function missingParts(d: MatchDetails): Part[] {
  if (!played(d)) return [];
  const goals = (d.match.homeScore ?? 0) + (d.match.awayScore ?? 0);
  const missing: Part[] = [];
  if (d.unavailable?.includes('events') || (goals > 0 && !d.events.some((e) => ['goal', 'penalty', 'own-goal'].includes(e.type))))
    missing.push('events');
  if (d.unavailable?.includes('lineups') || !d.lineups.length) missing.push('lineups');
  if (d.unavailable?.includes('stats') || !d.stats.length) missing.push('stats');
  return missing;
}

export async function fetchExtras(d: MatchDetails): Promise<SourceDetails[]> {
  const m = d.match;
  const params = new URLSearchParams({
    home: m.home.name,
    away: m.away.name,
    kickoff: m.utcDate,
    competition: m.competition.name,
  });
  // A final score lets the server make sure it's found the same match.
  if (m.status === 'FINISHED' && m.homeScore !== null && m.awayScore !== null) {
    params.set('homeScore', String(m.homeScore));
    params.set('awayScore', String(m.awayScore));
  }
  const res = await fetch(`/api/match-details?${params}`);
  const body = (await res.json().catch(() => ({}))) as { sources?: SourceDetails[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? `Match details request failed (${res.status}).`);
  return body.sources ?? [];
}

/**
 * Takes each missing part from the first source that has it (sources arrive
 * best first). Other providers' player ids don't match ours, so their players
 * are names only.
 */
export function mergeExtras(d: MatchDetails, sources: SourceDetails[]): MatchDetails {
  const missing = missingParts(d);
  if (!missing.length || !sources.length) return d;
  const teamId = (side: 'home' | 'away') => (side === 'home' ? d.match.home.id : d.match.away.id);
  const used = new Map<string, { name: string; url: string; parts: Part[] }>();
  const credit = (s: SourceDetails, part: Part) => {
    const entry = used.get(s.source.name) ?? { ...s.source, parts: [] };
    entry.parts.push(part);
    used.set(s.source.name, entry);
  };
  const next: MatchDetails = { ...d, match: { ...d.match } };

  if (missing.includes('events')) {
    const s = sources.find((x) => x.events?.length);
    if (s) {
      next.events = s.events!.map(({ side, ...e }): MatchEvent => ({ ...e, teamId: teamId(side) }));
      credit(s, 'events');
    }
  }
  if (missing.includes('lineups')) {
    const s = sources.find((x) => x.lineups?.length);
    if (s) {
      next.lineups = s.lineups!.map(({ side, ...l }): Lineup => ({ ...l, teamId: teamId(side) }));
      credit(s, 'lineups');
    }
  }
  if (missing.includes('stats')) {
    const s = sources.find((x) => x.stats?.length);
    if (s) {
      next.stats = s.stats!;
      credit(s, 'stats');
    }
  }
  // Facts the main provider left blank.
  if (!next.halfTime || next.halfTime.home === null) next.halfTime = sources.find((s) => s.halfTime)?.halfTime ?? next.halfTime;
  next.venue ??= sources.find((s) => s.venue)?.venue;
  next.referee ??= sources.find((s) => s.referee)?.referee;
  next.match.note ??= sources.find((s) => s.note)?.note;

  next.unavailable = d.unavailable?.filter((p) => ![...used.values()].some((u) => u.parts.includes(p)));
  if (!next.unavailable?.length) next.unavailable = undefined;
  next.sources = [...used.values()];
  return next;
}
