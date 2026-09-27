import { useState } from 'react';
import { FollowButton } from '../components/FollowButton';
import { LeagueTag } from '../components/LeagueTag';
import { MatchList } from '../components/MatchCard';
import { NewsList } from '../components/NewsList';
import { ordinal, Stat } from '../components/Stat';
import { ErrorBox, Loading } from '../components/Status';
import { TeamBadge } from '../components/TeamBadge';
import { NO_TRANSFER_FEED, TransferList } from '../components/TransferList';
import type { Position } from '../data/types';
import { followPlayer, followTeam, useApp, useCompetition, useNews, useTeam, useTransfers } from '../state/AppContext';
import { href } from '../state/router';

const GROUPS: [Position, string][] = [
  ['GK', 'Goalkeepers'],
  ['DEF', 'Defenders'],
  ['MID', 'Midfielders'],
  ['FWD', 'Forwards'],
];

export function TeamPage({ id }: { id: number }) {
  const { followedTeams, followedPlayers } = useApp();
  const res = useTeam(id);
  const transfers = useTransfers([id]);
  const league = res.data?.team.league;
  const leagueData = useCompetition(league?.code);
  const teamNews = useNews(res.data ? [res.data.team] : []);
  const [showAllResults, setShowAllResults] = useState(false);
  const [showAllFixtures, setShowAllFixtures] = useState(false);

  if (res.error && !res.data) return <ErrorBox message={res.error} onRetry={res.reload} />;
  if (!res.data || res.data.team.id !== id) return <Loading what="team" />;

  const { team, competitions, squad } = res.data;
  const row = leagueData.data?.standings.flatMap((g) => g.rows).find((r) => r.team.id === id);
  const games = [...res.data.matches].sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  const finished = games.filter((m) => m.status === 'FINISHED');
  const allResults = [...finished].reverse();
  const allFixtures = games.filter((m) => m.status === 'SCHEDULED' || m.status === 'LIVE' || m.status === 'POSTPONED');
  const results = showAllResults ? allResults : allResults.slice(0, 6);
  const fixtures = showAllFixtures ? allFixtures : allFixtures.slice(0, 6);
  const form = finished.slice(-5).map((m) => {
    const us = m.home.id === id ? m.homeScore! : m.awayScore!;
    const them = m.home.id === id ? m.awayScore! : m.homeScore!;
    return { result: us > them ? 'W' : us === them ? 'D' : 'L', comp: m.competition.name };
  });
  const teamTransfers = (transfers.data ?? []).filter((t) => t.from.id === id || t.to.id === id);

  return (
    <>
      <section className="panel profile" style={{ ['--club' as string]: team.color }}>
        <div className="row gap">
          <TeamBadge team={team} size={64} />
          <div className="grow">
            <h1>{team.name}</h1>
            <div className="muted">
              {team.national ? 'National team' : team.area}
              {league && (
                <>
                  {' · '}
                  <LeagueTag competition={league} />
                </>
              )}
            </div>
          </div>
          <FollowButton
            following={followedTeams.isFollowing(id)}
            onToggle={() => followedTeams.toggle(followTeam(team))}
          />
        </div>
        {competitions.length > 0 && (
          <div className="comp-chips">
            <span className="muted small">Competing in</span>
            {competitions.map((c) => (
              <LeagueTag key={c.code} competition={c} />
            ))}
          </div>
        )}
        {row && league && (
          <div className="stat-row">
            <Stat label={league.name} value={ordinal(row.position)} />
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
              <span key={i} className={`form-pill ${f.result}`} title={f.comp}>
                {f.result}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="two-col">
        <section className="panel">
          <h2>Recent results</h2>
          <MatchList matches={results} empty="No results yet." showCompetition />
          {allResults.length > 6 && (
            <button className="btn ghost more" onClick={() => setShowAllResults((v) => !v)}>
              {showAllResults ? 'Show fewer' : `Show all ${allResults.length} results`}
            </button>
          )}
        </section>
        <section className="panel">
          <h2>Upcoming fixtures</h2>
          <MatchList matches={fixtures} empty="No upcoming fixtures." showCompetition />
          {allFixtures.length > 6 && (
            <button className="btn ghost more" onClick={() => setShowAllFixtures((v) => !v)}>
              {showAllFixtures ? 'Show fewer' : `Show all ${allFixtures.length} fixtures`}
            </button>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>Latest news</h2>
        {teamNews.error && !teamNews.data ? (
          <ErrorBox message={teamNews.error} onRetry={teamNews.reload} />
        ) : !teamNews.data ? (
          <Loading what="news" />
        ) : (
          <NewsList items={teamNews.data.slice(0, 6)} empty={`No recent news about ${team.name}.`} compact />
        )}
      </section>

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
                    <a href={href.player(p.competition.code, p.id)}>
                      {p.name}
                      {team.national && <span className="muted small"> · {p.team.shortName}</span>}
                    </a>
                    <span className="muted small">
                      {p.stats.goals}G · {p.stats.assists}A
                    </span>
                    <FollowButton
                      compact
                      following={followedPlayers.isFollowing(p.id)}
                      onToggle={() => followedPlayers.toggle(followPlayer(p))}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {!team.national && (
        <section className="panel">
          <h2>Transfers</h2>
          <TransferList
            transfers={teamTransfers}
            empty={transfers.data === null ? NO_TRANSFER_FEED : 'No recent transfer activity.'}
          />
        </section>
      )}
    </>
  );
}
