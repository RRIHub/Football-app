import { FollowButton } from '../components/FollowButton';
import { MatchCard, MatchList } from '../components/MatchCard';
import { TeamBadge } from '../components/TeamBadge';
import { TransferList } from '../components/TransferList';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';

export function HomePage() {
  const { data, team, player, followedTeams, followedPlayers } = useApp();
  const live = data.matches.filter((m) => m.status === 'LIVE');
  const myTeams = followedTeams.ids.map(team).filter((t) => t !== undefined);
  const myPlayers = followedPlayers.ids.map(player).filter((p) => p !== undefined);
  const nothingFollowed = !myTeams.length && !myPlayers.length;

  const myTransfers = data.transfers.filter(
    (t) =>
      (t.playerId !== undefined && followedPlayers.isFollowing(t.playerId)) ||
      (t.fromTeamId !== undefined && followedTeams.isFollowing(t.fromTeamId)) ||
      (t.toTeamId !== undefined && followedTeams.isFollowing(t.toTeamId)),
  );

  return (
    <>
      {live.length > 0 && (
        <section className="panel">
          <h2>
            <span className="pulse" /> Live now
          </h2>
          <div className="match-grid">
            {live.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      {nothingFollowed && (
        <section className="panel hero">
          <h2>Make FootIQ yours</h2>
          <p className="muted">
            Follow your teams and favourite players to get their results, fixtures, stats and transfer news in one
            place. Tap a club to follow it:
          </p>
          <div className="chip-grid">
            {data.teams.map((t) => (
              <button key={t.id} className="chip" onClick={() => followedTeams.toggle(t.id)}>
                <TeamBadge team={t} size={20} /> {t.shortName}
              </button>
            ))}
          </div>
        </section>
      )}

      {myTeams.length > 0 && (
        <section className="panel">
          <h2>Your teams</h2>
          <div className="card-grid">
            {myTeams.map((t) => {
              const games = data.matches
                .filter((m) => m.homeTeamId === t.id || m.awayTeamId === t.id)
                .sort((a, b) => a.utcDate.localeCompare(b.utcDate));
              const last = games.filter((m) => m.status === 'FINISHED').at(-1);
              const next = games.find((m) => m.status === 'SCHEDULED' || m.status === 'LIVE');
              const row = data.standings.find((s) => s.teamId === t.id);
              return (
                <article key={t.id} className="card">
                  <header className="card-head">
                    <a href={href.team(t.id)} className="row gap">
                      <TeamBadge team={t} size={32} />
                      <div>
                        <div className="strong">{t.name}</div>
                        {row && (
                          <div className="muted small">
                            {ordinal(row.position)} · {row.points} pts
                          </div>
                        )}
                      </div>
                    </a>
                    <FollowButton compact following onToggle={() => followedTeams.toggle(t.id)} />
                  </header>
                  {last && (
                    <>
                      <div className="label">Last result</div>
                      <MatchCard match={last} />
                    </>
                  )}
                  {next && (
                    <>
                      <div className="label">{next.status === 'LIVE' ? 'Playing now' : 'Next up'}</div>
                      {next.status !== 'LIVE' && <div className="muted small">{new Date(next.utcDate).toLocaleDateString()}</div>}
                      <MatchCard match={next} />
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {myPlayers.length > 0 && (
        <section className="panel">
          <h2>Your players</h2>
          <div className="card-grid">
            {myPlayers.map((p) => (
              <a key={p.id} href={href.player(p.id)} className="card player-card">
                <header className="card-head">
                  <div className="row gap">
                    <TeamBadge team={team(p.teamId)} size={28} />
                    <div>
                      <div className="strong">{p.name}</div>
                      <div className="muted small">
                        {p.position} · {team(p.teamId)?.shortName}
                      </div>
                    </div>
                  </div>
                  <FollowButton compact following onToggle={() => followedPlayers.toggle(p.id)} />
                </header>
                <div className="stat-row">
                  <Stat label="Apps" value={p.stats.appearances} />
                  <Stat label="Goals" value={p.stats.goals} />
                  <Stat label="Assists" value={p.stats.assists} />
                  <Stat label="Price" value={`£${p.price}m`} />
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {!nothingFollowed && (
        <section className="panel">
          <h2>Transfer news for you</h2>
          <TransferList
            transfers={myTransfers.slice(0, 8)}
            empty={
              data.transfersUnavailable
                ? 'Transfer news is not available from the current data provider.'
                : 'No recent transfer activity involving the teams and players you follow.'
            }
          />
        </section>
      )}

      {nothingFollowed && (
        <section className="panel">
          <h2>Latest results</h2>
          <MatchList
            matches={data.matches
              .filter((m) => m.status === 'FINISHED')
              .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
              .slice(0, 10)}
          />
        </section>
      )}
    </>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
