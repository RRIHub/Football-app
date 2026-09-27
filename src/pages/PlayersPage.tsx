import { useMemo, useState } from 'react';
import { CompetitionSelect } from '../components/CompetitionSelect';
import { FollowButton } from '../components/FollowButton';
import { ErrorBox, Loading } from '../components/Status';
import { TeamBadge } from '../components/TeamBadge';
import type { Player, Position } from '../data/types';
import { followPlayer, useApp, useCompetition } from '../state/AppContext';
import { href } from '../state/router';
import { usePersistentState } from '../state/storage';

type SortKey = 'goals' | 'assists' | 'appearances' | 'price';

const SORTS: { key: SortKey; label: string; get: (p: Player) => number }[] = [
  { key: 'goals', label: 'Goals', get: (p) => p.stats.goals },
  { key: 'assists', label: 'Assists', get: (p) => p.stats.assists },
  { key: 'appearances', label: 'Apps', get: (p) => p.stats.appearances },
  { key: 'price', label: 'Price', get: (p) => p.price },
];

export function PlayersPage() {
  const { competitions, followedPlayers } = useApp();
  const [code, setCode] = usePersistentState('footiq.playersCompetition', competitions[0]?.code ?? '');
  const res = useCompetition(code);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<Position | 'ALL'>('ALL');
  const [teamId, setTeamId] = useState<number | 'ALL'>('ALL');
  const [sort, setSort] = useState<SortKey>('goals');
  const [onlyFollowed, setOnlyFollowed] = useState(false);

  const data = res.data?.competition.code === code ? res.data : undefined;
  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const getter = SORTS.find((s) => s.key === sort)!.get;
    return data.players
      .filter((p) => position === 'ALL' || p.position === position)
      .filter((p) => teamId === 'ALL' || p.teamId === teamId)
      .filter((p) => !onlyFollowed || followedPlayers.isFollowing(p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.team.name.toLowerCase().includes(q))
      .sort((a, b) => getter(b) - getter(a) || a.name.localeCompare(b.name))
      .slice(0, 100);
  }, [data, query, position, teamId, sort, onlyFollowed, followedPlayers]);

  return (
    <section className="panel">
      <h2>Player stats</h2>
      <div className="filters">
        <CompetitionSelect
          value={code}
          onChange={(c) => {
            setCode(c);
            setTeamId('ALL');
          }}
        />
        <input
          className="input"
          type="search"
          placeholder="Search players or clubs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input" value={position} onChange={(e) => setPosition(e.target.value as Position | 'ALL')}>
          <option value="ALL">All positions</option>
          <option value="GK">Goalkeepers</option>
          <option value="DEF">Defenders</option>
          <option value="MID">Midfielders</option>
          <option value="FWD">Forwards</option>
        </select>
        <select
          className="input"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
        >
          <option value="ALL">All teams</option>
          {[...(data?.teams ?? [])]
            .sort((a, b) => a.shortName.localeCompare(b.shortName))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortName}
              </option>
            ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={onlyFollowed} onChange={(e) => setOnlyFollowed(e.target.checked)} /> Following
        </label>
      </div>

      {res.error && !data ? (
        <ErrorBox message={res.error} onRetry={res.reload} />
      ) : !data ? (
        <Loading what="players" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th />
                <th className="left">Player</th>
                <th className="hide-sm">Pos</th>
                {SORTS.map((s) => (
                  <th key={s.key}>
                    <button className={`th-sort ${sort === s.key ? 'active' : ''}`} onClick={() => setSort(s.key)}>
                      {s.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <FollowButton
                      compact
                      following={followedPlayers.isFollowing(p.id)}
                      onToggle={() => followedPlayers.toggle(followPlayer(p))}
                    />
                  </td>
                  <td className="left">
                    <a href={href.player(code, p.id)} className="row gap-sm">
                      <TeamBadge team={p.team} size={20} />
                      <span>
                        {p.name}
                        <span className="muted small block">
                          {p.team.shortName}
                          <span className="show-sm"> · {p.position}</span>
                        </span>
                      </span>
                    </a>
                  </td>
                  <td className="hide-sm">
                    <span className={`pos ${p.position}`}>{p.position}</span>
                  </td>
                  <td className={sort === 'goals' ? 'strong' : ''}>{p.stats.goals}</td>
                  <td className={sort === 'assists' ? 'strong' : ''}>{p.stats.assists}</td>
                  <td className={sort === 'appearances' ? 'strong' : ''}>{p.stats.appearances}</td>
                  <td className={sort === 'price' ? 'strong' : ''}>£{p.price}m</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="muted">No players match those filters.</p>}
        </div>
      )}
    </section>
  );
}
