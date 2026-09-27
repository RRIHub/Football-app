import { FollowButton } from '../components/FollowButton';
import { MatchList } from '../components/MatchCard';
import { TeamBadge } from '../components/TeamBadge';
import { TransferList } from '../components/TransferList';
import type { Position } from '../data/types';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';
import { ordinal, Stat } from './HomePage';

const GROUPS: [Position, string][] = [
  ['GK', 'Goalkeepers'],
  ['DEF', 'Defenders'],
  ['MID', 'Midfielders'],
  ['FWD', 'Forwards'],
];

export function TeamPage({ id }: { id: number }) {
  const { data, team, followedTeams, followedPlayers } = useApp();
  const t = team(id);
  if (!t)
    return (
      <section className="panel">
        <p>Team not found.</p>
        <a href={href.teams}>Back to teams</a>
      </section>
    );
  const row = data.standings.find((s) => s.teamId === id);
  const games = data.matches
    .filter((m) => m.homeTeamId === id || m.awayTeamId === id)
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  const results = games.filter((m) => m.status === 'FINISHED').slice(-5).reverse();
  const fixtures = games.filter((m) => m.status === 'SCHEDULED' || m.status === 'LIVE').slice(0, 5);
  const form = results
    .map((m) => {
      const us = m.homeTeamId === id ? m.homeScore! : m.awayScore!;
      const them = m.homeTeamId === id ? m.awayScore! : m.homeScore!;
      return us > them ? 'W' : us === them ? 'D' : 'L';
    })
    .reverse();
  const squad = data.players.filter((p) => p.teamId === id);
  const transfers = data.transfers.filter((tr) => tr.fromTeamId === id || tr.toTeamId === id);

  return (
    <>
      <section className="panel profile" style={{ ['--club' as string]: t.color }}>
        <div className="row gap">
          <TeamBadge team={t} size={64} />
          <div className="grow">
            <h1>{t.name}</h1>
            {row && (
              <div className="muted">
                {ordinal(row.position)} in {data.competition}
              </div>
            )}
          </div>
          <FollowButton following={followedTeams.isFollowing(id)} onToggle={() => followedTeams.toggle(id)} />
        </div>
        {row && (
          <div className="stat-row">
            <Stat label="Played" value={row.played} />
            <Stat label="Won" value={row.won} />
            <Stat label="Drawn" value={row.drawn} />
            <Stat label="Lost" value={row.lost} />
            <Stat label="Points" value={row.points} />
          </div>
        )}
        {form.length > 0 && (
          <div className="form">
            <span className="muted small">Form</span>
            {form.map((f, i) => (
              <span key={i} className={`form-pill ${f}`}>
                {f}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="two-col">
        <section className="panel">
          <h2>Recent results</h2>
          <MatchList matches={results} empty="No results yet." />
        </section>
        <section className="panel">
          <h2>Upcoming fixtures</h2>
          <MatchList matches={fixtures} empty="No upcoming fixtures." />
        </section>
      </div>

      <section className="panel">
        <h2>Squad</h2>
        {squad.length === 0 && <p className="muted">Squad information isn't available.</p>}
        {GROUPS.map(([pos, label]) => {
          const group = squad.filter((p) => p.position === pos);
          if (!group.length) return null;
          return (
            <div key={pos} className="squad-group">
              <div className="label">{label}</div>
              <ul className="squad-list">
                {group.map((p) => (
                  <li key={p.id}>
                    <a href={href.player(p.id)}>{p.name}</a>
                    <span className="muted small">
                      {p.stats.goals}G · {p.stats.assists}A
                    </span>
                    <FollowButton
                      compact
                      following={followedPlayers.isFollowing(p.id)}
                      onToggle={() => followedPlayers.toggle(p.id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="panel">
        <h2>Transfers</h2>
        <TransferList
          transfers={transfers}
          empty={
            data.transfersUnavailable
              ? 'Transfer news is not available from the current data provider.'
              : 'No recent transfer activity.'
          }
        />
      </section>
    </>
  );
}
