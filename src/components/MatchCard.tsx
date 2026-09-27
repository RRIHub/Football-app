import type { Match } from '../data/types';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';
import { TeamBadge } from './TeamBadge';

function statusLabel(m: Match): string {
  switch (m.status) {
    case 'LIVE':
      return m.minute ? `${m.minute}'` : 'LIVE';
    case 'FINISHED':
      return 'FT';
    case 'POSTPONED':
      return 'PP';
    default:
      return new Date(m.utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

export function MatchCard({ match }: { match: Match }) {
  const { team, followedTeams } = useApp();
  const home = team(match.homeTeamId);
  const away = team(match.awayTeamId);
  const followed = followedTeams.isFollowing(match.homeTeamId) || followedTeams.isFollowing(match.awayTeamId);
  const showScore = match.status === 'LIVE' || match.status === 'FINISHED';
  const winner =
    match.status === 'FINISHED' && match.homeScore !== null && match.awayScore !== null
      ? Math.sign(match.homeScore - match.awayScore)
      : 0;

  return (
    <div className={`match ${match.status === 'LIVE' ? 'live' : ''} ${followed ? 'followed' : ''}`}>
      <span className={`status ${match.status.toLowerCase()}`}>{statusLabel(match)}</span>
      <div className="sides">
        <a href={href.team(match.homeTeamId)} className={`side ${winner === 1 ? 'win' : ''}`}>
          <TeamBadge team={home} size={22} />
          <span className="side-name">{home?.shortName ?? 'TBC'}</span>
          <strong className="score">{showScore ? match.homeScore ?? 0 : ''}</strong>
        </a>
        <a href={href.team(match.awayTeamId)} className={`side ${winner === -1 ? 'win' : ''}`}>
          <TeamBadge team={away} size={22} />
          <span className="side-name">{away?.shortName ?? 'TBC'}</span>
          <strong className="score">{showScore ? match.awayScore ?? 0 : ''}</strong>
        </a>
      </div>
    </div>
  );
}

export function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

export function MatchList({ matches, empty = 'No matches.' }: { matches: Match[]; empty?: string }) {
  if (!matches.length) return <p className="muted">{empty}</p>;
  const groups = new Map<string, Match[]>();
  for (const m of matches) {
    const key = dayKey(m.utcDate);
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return (
    <>
      {[...groups].map(([day, ms]) => (
        <section key={day} className="day">
          <h3 className="day-title">{day}</h3>
          <div className="match-grid">
            {ms.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
