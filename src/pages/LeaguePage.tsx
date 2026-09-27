import { useMemo, useState } from 'react';
import { FollowButton } from '../components/FollowButton';
import { LeagueTable } from '../components/LeagueTable';
import { MatchList } from '../components/MatchCard';
import { ErrorBox, Loading } from '../components/Status';
import { TeamBadge } from '../components/TeamBadge';
import type { CompetitionData, Player } from '../data/types';
import { followPlayer, followTeam, useApp, useCompetition } from '../state/AppContext';
import { href } from '../state/router';

type Tab = 'table' | 'matches' | 'stats' | 'teams';

export function LeaguePage({ code }: { code: string }) {
  const { competition } = useApp();
  const meta = competition(code);
  const res = useCompetition(meta ? code : null);
  const [tab, setTab] = useState<Tab>(meta?.format === 'knockout' ? 'matches' : 'table');

  if (!meta)
    return (
      <section className="panel">
        <p>We don't cover that competition.</p>
        <a href={href.leagues}>Browse leagues</a>
      </section>
    );

  const data = res.data?.competition.code === code ? res.data : undefined;
  return (
    <>
      <section className="panel profile">
        <div className="row gap">
          {data?.competition.emblem ? (
            <img className="crest" src={data.competition.emblem} alt="" width={56} height={56} />
          ) : (
            <span className="comp-flag big" aria-hidden>
              {meta.flag ?? '⚽'}
            </span>
          )}
          <div className="grow">
            <h1>{meta.name}</h1>
            <div className="muted">
              {meta.area}
              {data && ` · ${data.season}`}
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="tabs">
          {(
            [
              ['table', meta.format === 'groups' ? 'Groups' : 'Table'],
              ['matches', meta.format === 'knockout' ? 'Rounds' : 'Matches'],
              ['stats', 'Top scorers'],
              ['teams', 'Teams'],
            ] as const
          )
            .filter(([key]) => key !== 'table' || meta.format !== 'knockout')
            .map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
        {res.error && !data ? (
          <ErrorBox message={res.error} onRetry={res.reload} />
        ) : !data ? (
          <Loading what={meta.name} />
        ) : tab === 'table' ? (
          <LeagueTable groups={data.standings} />
        ) : tab === 'matches' ? (
          <Matchdays data={data} />
        ) : tab === 'stats' ? (
          <TopScorers players={data.players} code={code} />
        ) : (
          <Teams data={data} />
        )}
      </section>
    </>
  );
}

type MatchView = 'round' | 'all' | 'results' | 'fixtures';

function Matchdays({ data }: { data: CompetitionData }) {
  const [view, setView] = useState<MatchView>('round');
  const sorted = useMemo(() => [...data.matches].sort((a, b) => a.utcDate.localeCompare(b.utcDate)), [data.matches]);
  const rounds = useMemo(() => {
    const byRound = new Map<string, CompetitionData['matches']>();
    for (const m of sorted) {
      const key = m.matchday ? `Matchday ${m.matchday}` : (m.stage ?? 'Matches');
      byRound.set(key, [...(byRound.get(key) ?? []), m]);
    }
    return [...byRound];
  }, [sorted]);
  // Start on the first round that isn't finished yet, or the last one if all are.
  const open = rounds.findIndex(([, ms]) => ms.some((m) => m.status !== 'FINISHED'));
  const [index, setIndex] = useState(open === -1 ? Math.max(0, rounds.length - 1) : open);
  if (!rounds.length) return <p className="muted">No fixtures published yet.</p>;
  const matches = rounds[Math.min(index, rounds.length - 1)][1];

  const results = sorted.filter((m) => m.status === 'FINISHED').reverse();
  const fixtures = sorted.filter((m) => m.status !== 'FINISHED');
  const VIEWS: [MatchView, string][] = [
    ['round', 'By round'],
    ['all', `All matches (${sorted.length})`],
    ['results', `Results (${results.length})`],
    ['fixtures', `Fixtures (${fixtures.length})`],
  ];

  return (
    <>
      <div className="filters">
        {VIEWS.map(([key, text]) => (
          <button key={key} className={`pill ${view === key ? 'active' : ''}`} onClick={() => setView(key)}>
            {text}
          </button>
        ))}
      </div>
      {view === 'round' ? (
        <>
          <div className="round-nav">
            <button className="btn ghost" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} aria-label="Previous">
              ‹
            </button>
            <select className="input round-select" aria-label="Round" value={index} onChange={(e) => setIndex(Number(e.target.value))}>
              {rounds.map(([name], i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </select>
            <button
              className="btn ghost"
              disabled={index >= rounds.length - 1}
              onClick={() => setIndex((i) => i + 1)}
              aria-label="Next"
            >
              ›
            </button>
          </div>
          <MatchList matches={matches} />
        </>
      ) : (
        <MatchList
          matches={view === 'all' ? sorted : view === 'results' ? results : fixtures}
          empty={view === 'results' ? 'No results yet.' : 'No fixtures left.'}
        />
      )}
    </>
  );
}

function TopScorers({ players, code }: { players: Player[]; code: string }) {
  const { followedPlayers } = useApp();
  const [by, setBy] = useState<'goals' | 'assists'>('goals');
  // Only count stats recorded in this competition (a club's league stats don't belong here).
  const own = players.filter((p) => p.competition.code === code);
  const top = own
    .filter((p) => p.stats[by] > 0)
    .sort((a, b) => b.stats[by] - a.stats[by] || a.stats.appearances - b.stats.appearances)
    .slice(0, 20);
  return (
    <>
      <div className="filters">
        <button className={`pill ${by === 'goals' ? 'active' : ''}`} onClick={() => setBy('goals')}>
          Goals
        </button>
        <button className={`pill ${by === 'assists' ? 'active' : ''}`} onClick={() => setBy('assists')}>
          Assists
        </button>
      </div>
      {!own.length ? (
        <p className="muted">Player stats aren't available for this competition.</p>
      ) : !top.length ? (
        <p className="muted">No {by} recorded yet.</p>
      ) : (
        <ol className="leaderboard">
          {top.map((p, i) => (
            <li key={p.id}>
              <span className="rank">{i + 1}</span>
              <TeamBadge team={p.team} size={24} />
              <a href={href.player(code, p.id)} className="grow">
                <span className="strong">{p.name}</span>
                <span className="muted small block">{p.team.name}</span>
              </a>
              <FollowButton
                compact
                following={followedPlayers.isFollowing(p.id)}
                onToggle={() => followedPlayers.toggle(followPlayer(p))}
              />
              <span className="big-num">{p.stats[by]}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function Teams({ data }: { data: CompetitionData }) {
  const { followedTeams } = useApp();
  const teams = [...data.teams].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="team-grid">
      {teams.map((t) => (
        <a key={t.id} href={href.team(t.id)} className="team-tile" style={{ ['--club' as string]: t.color }}>
          <TeamBadge team={t} size={36} />
          <div className="grow">
            <div className="strong">{t.name}</div>
            <div className="muted small">
              {t.league && t.league.code !== data.competition.code ? t.league.name : t.area}
            </div>
          </div>
          <FollowButton
            compact
            following={followedTeams.isFollowing(t.id)}
            onToggle={() => followedTeams.toggle(followTeam(t))}
          />
        </a>
      ))}
    </div>
  );
}
