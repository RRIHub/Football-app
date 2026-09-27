import { FollowButton } from '../components/FollowButton';
import { TeamBadge } from '../components/TeamBadge';
import { TransferList } from '../components/TransferList';
import { fantasyPoints } from '../data/pricing';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';
import { Stat } from './HomePage';

const POSITION_NAME = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' } as const;

export function PlayerPage({ id }: { id: number }) {
  const { data, player, team, followedPlayers } = useApp();
  const p = player(id);
  if (!p)
    return (
      <section className="panel">
        <p>Player not found.</p>
        <a href={href.players}>Back to players</a>
      </section>
    );
  const t = team(p.teamId);
  const s = p.stats;
  const perNinety = (n: number) => (s.minutes ? ((n / s.minutes) * 90).toFixed(2) : '—');
  const transfers = data.transfers.filter((tr) => tr.playerId === p.id);
  const rank = [...data.players].sort((a, b) => b.stats.goals - a.stats.goals).findIndex((x) => x.id === p.id) + 1;

  return (
    <>
      <section className="panel profile" style={{ ['--club' as string]: t?.color }}>
        <div className="row gap">
          <TeamBadge team={t} size={56} />
          <div className="grow">
            <h1>{p.name}</h1>
            <div className="muted">
              {POSITION_NAME[p.position]} · <a href={href.team(p.teamId)}>{t?.name}</a> · {p.nationality}
              {p.age ? ` · ${p.age} yrs` : ''}
            </div>
          </div>
          <FollowButton following={followedPlayers.isFollowing(p.id)} onToggle={() => followedPlayers.toggle(p.id)} />
        </div>
      </section>

      <section className="panel">
        <h2>Season stats</h2>
        <div className="stat-row big">
          <Stat label="Appearances" value={s.appearances} />
          <Stat label="Goals" value={s.goals} />
          <Stat label="Assists" value={s.assists} />
          {(p.position === 'GK' || p.position === 'DEF') && <Stat label="Clean sheets" value={s.cleanSheets} />}
          <Stat label="Goal ranking" value={s.goals ? `#${rank}` : '—'} />
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
