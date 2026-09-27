import type { Match } from '../data/types';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';
import { LeagueTag } from './LeagueTag';
import { TeamBadge } from './TeamBadge';

function statusLabel(m: Match): string {
  switch (m.status) {
    case 'LIVE':
      return m.statusText ?? (m.minute ? `${m.minute}'` : 'LIVE');
    case 'FINISHED':
      return m.statusText ?? 'FT';
    case 'POSTPONED':
      return m.statusText ?? 'PP';
    default:
      return new Date(m.utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

export function MatchCard({ match, showCompetition = false }: { match: Match; showCompetition?: boolean }) {
  const { followedTeams } = useApp();
  const followed = followedTeams.isFollowing(match.home.id) || followedTeams.isFollowing(match.away.id);
  const showScore = match.status === 'LIVE' || match.status === 'FINISHED';
  const winner =
    match.status === 'FINISHED' && match.homeScore !== null && match.awayScore !== null
      ? Math.sign(match.homeScore - match.awayScore)
      : 0;

  return (
    <div className={`match ${match.status === 'LIVE' ? 'live' : ''} ${followed ? 'followed' : ''} ${winner ? 'decided' : ''}`}>
      <span className={`status ${match.status.toLowerCase()}`}>{statusLabel(match)}</span>
      <div className="sides">
        {showCompetition && (
          <div className="match-comp">
            <LeagueTag competition={match.competition} />
            {match.stage && <span className="muted small"> · {match.stage}</span>}
          </div>
        )}
        <a href={href.team(match.home.id)} className={`side ${winner === 1 ? 'win' : ''}`}>
          <TeamBadge team={match.home} size={22} />
          <span className="side-name">{match.home.shortName}</span>
          <strong className="score">{showScore ? match.homeScore ?? 0 : ''}</strong>
        </a>
        <a href={href.team(match.away.id)} className={`side ${winner === -1 ? 'win' : ''}`}>
          <TeamBadge team={match.away} size={22} />
          <span className="side-name">{match.away.shortName}</span>
          <strong className="score">{showScore ? match.awayScore ?? 0 : ''}</strong>
        </a>
        {match.note && <div className="match-note">{match.note}</div>}
      </div>
    </div>
  );
}

export function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return [...groups];
}

/** Matches grouped by day. */
export function MatchList({
  matches,
  empty = 'No matches.',
  showCompetition = false,
}: {
  matches: Match[];
  empty?: string;
  showCompetition?: boolean;
}) {
  if (!matches.length) return <p className="muted">{empty}</p>;
  return (
    <>
      {groupBy(matches, (m) => dayKey(m.utcDate)).map(([day, ms]) => (
        <section key={day} className="day">
          <h3 className="day-title">{day}</h3>
          <div className="match-grid">
            {ms.map((m) => (
              <MatchCard key={m.id} match={m} showCompetition={showCompetition} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

/**
 * Matches grouped by competition, in the order competitions are listed.
 * Featured competitions, live games and your teams' games start open; the
 * rest are collapsed so a busy day across hundreds of leagues stays readable.
 */
export function MatchesByCompetition({ matches, empty }: { matches: Match[]; empty: string }) {
  const { competitions, competition, followedTeams } = useApp();
  if (!matches.length) return <p className="muted">{empty}</p>;
  const index = new Map(competitions.map((c, i) => [c.code, i]));
  const order = (code: string) => index.get(code) ?? competitions.length;
  const groups = groupBy(matches, (m) => m.competition.code).sort(([a], [b]) => order(a) - order(b));
  const collapseRest = groups.length > 8;
  return (
    <>
      {groups.map(([code, ms]) => {
        const c = competition(code);
        const open =
          !collapseRest ||
          c?.featured ||
          ms.some((m) => m.status === 'LIVE' || followedTeams.isFollowing(m.home.id) || followedTeams.isFollowing(m.away.id));
        const liveCount = ms.filter((m) => m.status === 'LIVE').length;
        return (
          <details key={code} className="comp-group" open={open}>
            <summary className="comp-title">
              <span className="row gap-sm">
                <LeagueTag competition={ms[0].competition} />
                {c && c.area && c.category !== 'europe' && c.category !== 'international' && (
                  <span className="muted small">{c.area}</span>
                )}
              </span>
              <span className="row gap-sm">
                {liveCount > 0 && <span className="live-count">{liveCount} live</span>}
                <span className="muted small">{ms.length}</span>
                <a className="muted small" href={href.league(code)} onClick={(e) => e.stopPropagation()}>
                  Table ›
                </a>
              </span>
            </summary>
            <div className="match-grid">
              {ms.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </details>
        );
      })}
    </>
  );
}
