import { useState } from 'react';
import { MatchList } from '../components/MatchCard';
import { TeamBadge } from '../components/TeamBadge';
import type { Match } from '../data/types';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';

type Filter = 'all' | 'live' | 'results' | 'fixtures' | 'mine';

export function ScoresPage() {
  const { data, followedTeams } = useApp();
  const hasLive = data.matches.some((m) => m.status === 'LIVE');
  const [filter, setFilter] = useState<Filter>(hasLive ? 'live' : 'results');
  const [tab, setTab] = useState<'matches' | 'table'>('matches');

  const now = Date.now();
  const byDate = (dir: 1 | -1) => (a: Match, b: Match) => dir * a.utcDate.localeCompare(b.utcDate);
  const matches = (() => {
    switch (filter) {
      case 'live':
        return data.matches.filter((m) => m.status === 'LIVE');
      case 'results':
        return data.matches.filter((m) => m.status === 'FINISHED').sort(byDate(-1)).slice(0, 30);
      case 'fixtures':
        return data.matches
          .filter((m) => m.status === 'SCHEDULED' || (m.status === 'POSTPONED' && Date.parse(m.utcDate) > now))
          .sort(byDate(1))
          .slice(0, 30);
      case 'mine':
        return data.matches
          .filter((m) => followedTeams.isFollowing(m.homeTeamId) || followedTeams.isFollowing(m.awayTeamId))
          .sort(byDate(1));
      default:
        return [...data.matches].sort(byDate(1));
    }
  })();

  return (
    <section className="panel">
      <div className="tabs">
        <button className={tab === 'matches' ? 'active' : ''} onClick={() => setTab('matches')}>
          Scores &amp; fixtures
        </button>
        <button className={tab === 'table' ? 'active' : ''} onClick={() => setTab('table')}>
          Table
        </button>
      </div>

      {tab === 'matches' ? (
        <>
          <div className="filters">
            {(
              [
                ['live', 'Live'],
                ['results', 'Results'],
                ['fixtures', 'Fixtures'],
                ['mine', 'My teams'],
                ['all', 'All'],
              ] as const
            ).map(([key, label]) => (
              <button key={key} className={`pill ${filter === key ? 'active' : ''}`} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
          <MatchList
            matches={matches}
            empty={
              filter === 'live'
                ? 'No matches in play right now.'
                : filter === 'mine'
                  ? 'Follow some teams to see their matches here.'
                  : 'No matches.'
            }
          />
        </>
      ) : (
        <LeagueTable />
      )}
    </section>
  );
}

export function LeagueTable({ highlight }: { highlight?: number }) {
  const { data, team, followedTeams } = useApp();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th className="left">Team</th>
            <th>P</th>
            <th className="hide-sm">W</th>
            <th className="hide-sm">D</th>
            <th className="hide-sm">L</th>
            <th>GD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {data.standings.map((r) => {
            const t = team(r.teamId);
            const mine = r.teamId === highlight || followedTeams.isFollowing(r.teamId);
            return (
              <tr key={r.teamId} className={mine ? 'highlight' : undefined}>
                <td>{r.position}</td>
                <td className="left">
                  <a href={href.team(r.teamId)} className="row gap-sm">
                    <TeamBadge team={t} size={20} /> {t?.shortName}
                  </a>
                </td>
                <td>{r.played}</td>
                <td className="hide-sm">{r.won}</td>
                <td className="hide-sm">{r.drawn}</td>
                <td className="hide-sm">{r.lost}</td>
                <td>{r.goalsFor - r.goalsAgainst > 0 ? '+' : ''}{r.goalsFor - r.goalsAgainst}</td>
                <td className="strong">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
