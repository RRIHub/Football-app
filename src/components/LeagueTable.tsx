import type { StandingGroup } from '../data/types';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';
import { TeamBadge } from './TeamBadge';

export function LeagueTable({ groups, highlight }: { groups: StandingGroup[]; highlight?: number }) {
  const { followedTeams } = useApp();
  if (!groups.length || groups.every((g) => !g.rows.length))
    return <p className="muted">No table available for this competition yet.</p>;
  return (
    <div className={groups.length > 1 ? 'group-grid' : undefined}>
      {groups.map((g, i) => (
        <div key={g.name ?? i} className="table-wrap">
          {g.name && groups.length > 1 && <h3 className="day-title">{g.name}</h3>}
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
              {g.rows.map((r) => {
                const gd = r.goalsFor - r.goalsAgainst;
                const mine = r.team.id === highlight || followedTeams.isFollowing(r.team.id);
                return (
                  <tr key={r.team.id} className={mine ? 'highlight' : undefined}>
                    <td>{r.position}</td>
                    <td className="left">
                      <a href={href.team(r.team.id)} className="row gap-sm">
                        <TeamBadge team={r.team} size={20} /> {r.team.shortName}
                      </a>
                    </td>
                    <td>{r.played}</td>
                    <td className="hide-sm">{r.won}</td>
                    <td className="hide-sm">{r.drawn}</td>
                    <td className="hide-sm">{r.lost}</td>
                    <td>
                      {gd > 0 ? '+' : ''}
                      {gd}
                    </td>
                    <td className="strong">{r.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
