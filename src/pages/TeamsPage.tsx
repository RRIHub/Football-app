import { FollowButton } from '../components/FollowButton';
import { TeamBadge } from '../components/TeamBadge';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';

export function TeamsPage() {
  const { data, followedTeams } = useApp();
  const teams = [...data.teams].sort(
    (a, b) =>
      Number(followedTeams.isFollowing(b.id)) - Number(followedTeams.isFollowing(a.id)) ||
      a.name.localeCompare(b.name),
  );
  return (
    <section className="panel">
      <h2>Teams</h2>
      <div className="team-grid">
        {teams.map((t) => {
          const row = data.standings.find((s) => s.teamId === t.id);
          return (
            <a key={t.id} href={href.team(t.id)} className="team-tile" style={{ ['--club' as string]: t.color }}>
              <TeamBadge team={t} size={40} />
              <div className="grow">
                <div className="strong">{t.name}</div>
                {row && (
                  <div className="muted small">
                    {row.position}. · {row.points} pts
                  </div>
                )}
              </div>
              <FollowButton
                compact
                following={followedTeams.isFollowing(t.id)}
                onToggle={() => followedTeams.toggle(t.id)}
              />
            </a>
          );
        })}
      </div>
    </section>
  );
}
