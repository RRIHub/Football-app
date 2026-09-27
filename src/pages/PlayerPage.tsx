import { FollowButton } from '../components/FollowButton';
import { LeagueTag } from '../components/LeagueTag';
import { Stat } from '../components/Stat';
import { ErrorBox, Loading } from '../components/Status';
import { TeamBadge } from '../components/TeamBadge';
import { NO_TRANSFER_FEED, TransferList } from '../components/TransferList';
import { fantasyPoints } from '../data/pricing';
import { canLoadPlayer, followPlayer, useApp, useCompetition, usePlayer, useTransfers } from '../state/AppContext';
import { href } from '../state/router';

const POSITION_NAME = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' } as const;

export function PlayerPage({ code, id }: { code: string; id: number }) {
  const { followedPlayers } = useApp();
  const comp = useCompetition(code);
  // Providers with a per-player endpoint give full stats for any squad player.
  const single = usePlayer(code, id);
  const fromComp = comp.data?.competition.code === code ? comp.data.players.find((x) => x.id === id) : undefined;
  const p = single.data ?? fromComp;
  const transfers = useTransfers(p ? [p.teamId] : []);

  const perPlayer = canLoadPlayer();
  const pending = perPlayer ? single.loading && !p : !comp.data || comp.data.competition.code !== code;
  const error = perPlayer ? single.error : comp.error;
  if (error && !p) return <ErrorBox message={error} onRetry={perPlayer ? single.reload : comp.reload} />;
  if (pending) return <Loading what="player" />;

  if (!p)
    return (
      <section className="panel">
        <p>Player not found.</p>
        <a href={href.players}>Back to players</a>
      </section>
    );
  const s = p.stats;
  const perNinety = (n: number) => (s.minutes ? ((n / s.minutes) * 90).toFixed(2) : '—');
  const leaders = comp.data?.competition.code === code ? comp.data.players : [];
  const rankIndex = [...leaders].sort((a, b) => b.stats.goals - a.stats.goals).findIndex((x) => x.id === p.id);
  const rank = s.goals && rankIndex >= 0 ? rankIndex + 1 : 0;
  const history = (transfers.data ?? []).filter((t) => t.playerId === p.id);

  return (
    <>
      <section className="panel profile" style={{ ['--club' as string]: p.team.color }}>
        <div className="row gap">
          <TeamBadge team={p.team} size={56} />
          <div className="grow">
            <h1>{p.name}</h1>
            <div className="muted">
              {POSITION_NAME[p.position]} · <a href={href.team(p.teamId)}>{p.team.name}</a> · {p.nationality}
              {p.age ? ` · ${p.age} yrs` : ''}
            </div>
            <div className="small">
              <LeagueTag competition={p.competition} />
            </div>
          </div>
          <FollowButton
            following={followedPlayers.isFollowing(p.id)}
            onToggle={() => followedPlayers.toggle(followPlayer(p))}
          />
        </div>
      </section>

      <section className="panel">
        <h2>
          Season stats <span className="muted small">· {p.competition.name}</span>
        </h2>
        <div className="stat-row big">
          <Stat label="Appearances" value={s.appearances} />
          <Stat label="Goals" value={s.goals} />
          <Stat label="Assists" value={s.assists} />
          {(p.position === 'GK' || p.position === 'DEF') && <Stat label="Clean sheets" value={s.cleanSheets} />}
          <Stat label="Scoring rank" value={rank ? `#${rank}` : '—'} />
        </div>
        <div className="stat-row">
          <Stat label="Minutes" value={s.minutes || '—'} />
          <Stat label="Goals / 90" value={perNinety(s.goals)} />
          <Stat label="Assists / 90" value={perNinety(s.assists)} />
          <Stat label="Yellow" value={s.yellowCards} />
          <Stat label="Red" value={s.redCards} />
        </div>
      </section>

      <section className="panel">
        <h2>Fantasy</h2>
        <div className="stat-row">
          <Stat label="Price" value={`£${p.price}m`} />
          <Stat label="Season points" value={fantasyPoints(p.position, s)} />
        </div>
        <a className="btn" href={href.build}>
          Add to your XI
        </a>
      </section>

      <section className="panel">
        <h2>Transfer history</h2>
        <TransferList
          transfers={history}
          empty={transfers.data === null ? NO_TRANSFER_FEED : 'No recent transfer activity.'}
        />
      </section>
    </>
  );
}
