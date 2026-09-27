import { useState } from 'react';
import { CompetitionSelect } from '../components/CompetitionSelect';
import { FollowButton } from '../components/FollowButton';
import { LeagueTag } from '../components/LeagueTag';
import { MatchCard, MatchesByCompetition } from '../components/MatchCard';
import { NewsList } from '../components/NewsList';
import { Stat } from '../components/Stat';
import { ErrorBox, Loading } from '../components/Status';
import { TeamBadge } from '../components/TeamBadge';
import { NO_TRANSFER_FEED, TransferList } from '../components/TransferList';
import {
  followTeam,
  useApp,
  useCompetition,
  useMatchWindow,
  useNews,
  useTeam,
  useTransfers,
  type FollowedPlayer,
  type FollowedTeam,
} from '../state/AppContext';
import { href } from '../state/router';

export function HomePage() {
  const { followedTeams, followedPlayers } = useApp();
  const matchWindow = useMatchWindow();
  const transfers = useTransfers();
  const newsFor = useNews(followedTeams.items.length ? followedTeams.items : undefined);
  const live = (matchWindow.data ?? []).filter((m) => m.status === 'LIVE');
  const nothingFollowed = !followedTeams.items.length && !followedPlayers.items.length;
  // Keep the picker open after the first tap so several teams can be chosen at once.
  const [onboarding, setOnboarding] = useState(nothingFollowed);
  const today = new Date().toDateString();
  const todays = (matchWindow.data ?? []).filter((m) => new Date(m.utcDate).toDateString() === today);

  const myTransfers = (transfers.data ?? []).filter(
    (t) =>
      (t.playerId !== undefined && followedPlayers.isFollowing(t.playerId)) ||
      followedTeams.isFollowing(t.from.id) ||
      followedTeams.isFollowing(t.to.id),
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
              <MatchCard key={m.id} match={m} showCompetition />
            ))}
          </div>
        </section>
      )}

      {(onboarding || nothingFollowed) && <FollowPrompt onDone={nothingFollowed ? undefined : () => setOnboarding(false)} />}

      {followedTeams.items.length > 0 && (
        <section className="panel">
          <h2>Your teams</h2>
          <div className="card-grid">
            {followedTeams.items.map((t) => (
              <FollowedTeamCard key={t.id} team={t} />
            ))}
          </div>
        </section>
      )}

      {followedPlayers.items.length > 0 && (
        <section className="panel">
          <h2>Your players</h2>
          <div className="card-grid">
            {followedPlayers.items.map((p) => (
              <FollowedPlayerCard key={p.id} player={p} />
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <h2 className="row between">
          {followedTeams.items.length ? 'News for you' : 'Latest news'}
          <a className="muted small" href={href.news}>
            All news ›
          </a>
        </h2>
        {newsFor.error && !newsFor.data ? (
          <ErrorBox message={newsFor.error} onRetry={newsFor.reload} />
        ) : !newsFor.data ? (
          <Loading what="news" />
        ) : (
          <NewsList items={newsFor.data.slice(0, 5)} empty="No recent news about your teams." compact />
        )}
      </section>

      {!nothingFollowed && (
        <section className="panel">
          <h2>Transfer news for you</h2>
          {transfers.loading && !transfers.data ? (
            <Loading what="transfers" />
          ) : (
            <TransferList
              transfers={myTransfers.slice(0, 8)}
              empty={
                transfers.data === null
                  ? NO_TRANSFER_FEED
                  : 'No recent transfer activity involving the teams and players you follow.'
              }
            />
          )}
        </section>
      )}

      <section className="panel">
        <h2>Today's matches</h2>
        {matchWindow.error && !matchWindow.data ? (
          <ErrorBox message={matchWindow.error} onRetry={matchWindow.reload} />
        ) : !matchWindow.data ? (
          <Loading what="matches" />
        ) : (
          <MatchesByCompetition matches={todays} empty="No matches today in the competitions we cover." />
        )}
      </section>
    </>
  );
}

function FollowPrompt({ onDone }: { onDone?: () => void }) {
  const { competitions, followedTeams } = useApp();
  const [code, setCode] = useState(competitions[0]?.code ?? '');
  const comp = useCompetition(code);
  return (
    <section className="panel hero">
      <h2>Make FootIQ yours</h2>
      <p className="muted">
        Follow clubs and national teams to get their results, fixtures, stats and transfer news in one place. Pick a
        competition, then tap the teams you support:
      </p>
      <div className="filters">
        <CompetitionSelect value={code} onChange={setCode} />
      </div>
      {comp.error && !comp.data ? (
        <ErrorBox message={comp.error} onRetry={comp.reload} />
      ) : !comp.data || comp.data.competition.code !== code ? (
        <Loading what="teams" />
      ) : (
        <div className="chip-grid">
          {comp.data.teams.map((t) => (
            <button
              key={t.id}
              className={`chip ${followedTeams.isFollowing(t.id) ? 'on' : ''}`}
              onClick={() => followedTeams.toggle(followTeam(t))}
            >
              <TeamBadge team={t} size={20} /> {t.shortName}
            </button>
          ))}
        </div>
      )}
      {onDone && (
        <button className="btn" onClick={onDone}>
          Done ({followedTeams.items.length} followed)
        </button>
      )}
    </section>
  );
}

function FollowedTeamCard({ team }: { team: FollowedTeam }) {
  const { followedTeams } = useApp();
  const res = useTeam(team.id);
  const games = [...(res.data?.matches ?? [])].sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  const last = games.filter((m) => m.status === 'FINISHED').at(-1);
  const next = games.find((m) => m.status === 'SCHEDULED' || m.status === 'LIVE');
  const league = res.data?.team.league ?? team.league;

  return (
    <article className="card">
      <header className="card-head">
        <div className="row gap">
          <a href={href.team(team.id)}>
            <TeamBadge team={res.data?.team ?? team} size={32} />
          </a>
          <div>
            <a href={href.team(team.id)} className="strong block">
              {team.name}
            </a>
            <div className="small">
              {league ? <LeagueTag competition={league} /> : <span className="muted">{team.national ? 'National team' : ''}</span>}
            </div>
          </div>
        </div>
        <FollowButton compact following onToggle={() => followedTeams.toggle(team)} />
      </header>
      {res.error && !res.data && <p className="muted small">Couldn't load fixtures.</p>}
      {!res.data && !res.error && <Loading what="fixtures" />}
      {last && (
        <>
          <div className="label">Last result</div>
          <MatchCard match={last} showCompetition />
        </>
      )}
      {next && (
        <>
          <div className="label">
            {next.status === 'LIVE' ? 'Playing now' : `Next up · ${new Date(next.utcDate).toLocaleDateString()}`}
          </div>
          <MatchCard match={next} showCompetition />
        </>
      )}
    </article>
  );
}

function FollowedPlayerCard({ player }: { player: FollowedPlayer }) {
  const { followedPlayers } = useApp();
  const comp = useCompetition(player.competition.code);
  const fresh = comp.data?.players.find((p) => p.id === player.id);
  return (
    <a href={href.player(player.competition.code, player.id)} className="card player-card">
      <header className="card-head">
        <div className="row gap">
          <TeamBadge team={fresh?.team ?? player.team} size={28} />
          <div>
            <div className="strong">{player.name}</div>
            <div className="muted small">
              {player.position} · {player.team.shortName}
            </div>
            <div className="small">
              <LeagueTag competition={player.competition} plain />
            </div>
          </div>
        </div>
        <FollowButton compact following onToggle={() => followedPlayers.toggle(player)} />
      </header>
      {fresh ? (
        <div className="stat-row">
          <Stat label="Apps" value={fresh.stats.appearances} />
          <Stat label="Goals" value={fresh.stats.goals} />
          <Stat label="Assists" value={fresh.stats.assists} />
          <Stat label="Price" value={`£${fresh.price}m`} />
        </div>
      ) : (
        comp.loading && <Loading what="stats" />
      )}
    </a>
  );
}
