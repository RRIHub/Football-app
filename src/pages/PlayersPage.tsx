import { useMemo, useState } from 'react';
import { FollowButton } from '../components/FollowButton';
import { TeamBadge } from '../components/TeamBadge';
import type { Player, Position } from '../data/types';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';

type SortKey = 'goals' | 'assists' | 'appearances' | 'price' | 'name';

const SORTS: { key: SortKey; label: string; get: (p: Player) => number | string }[] = [
  { key: 'goals', label: 'Goals', get: (p) => p.stats.goals },
  { key: 'assists', label: 'Assists', get: (p) => p.stats.assists },
  { key: 'appearances', label: 'Apps', get: (p) => p.stats.appearances },
  { key: 'price', label: 'Price', get: (p) => p.price },
  { key: 'name', label: 'Name', get: (p) => p.name },
];

export function PlayersPage() {
  const { data, team, followedPlayers } = useApp();
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<Position | 'ALL'>('ALL');
  const [teamId, setTeamId] = useState<number | 'ALL'>('ALL');
  const [sort, setSort] = useState<SortKey>('goals');
  const [onlyFollowed, setOnlyFollowed] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const getter = SORTS.find((s) => s.key === sort)!.get;
    return data.players
      .filter((p) => position === 'ALL' || p.position === position)
      .filter((p) => teamId === 'ALL' || p.teamId === teamId)
      .filter((p) => !onlyFollowed || followedPlayers.isFollowing(p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const av = getter(a);
        const bv = getter(b);
        return typeof av === 'string' ? av.localeCompare(bv as string) : (bv as number) - av || a.name.localeCompare(b.name);
      })
      .slice(0, 100);
  }, [data.players, query, position, teamId, sort, onlyFollowed, followedPlayers]);

  return (
    <section className="panel">
      <h2>Player stats</h2>
      <div className="filters wrap">
        <input
          className="input"
          type="search"
          placeholder="Search players…"
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
          {[...data.teams]
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

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th />
              <th className="left">Player</th>
              <th className="hide-sm">Pos</th>
              {SORTS.filter((s) => s.key !== 'name').map((s) => (
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
                    onToggle={() => followedPlayers.toggle(p.id)}
                  />
                </td>
                <td className="left">
                  <a href={href.player(p.id)} className="row gap-sm">
                    <TeamBadge team={team(p.teamId)} size={20} />
                    <span>
                      {p.name}
                      <span className="muted small show-sm"> · {p.position}</span>
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
    </section>
  );
}
