import { useMemo, useState } from 'react';
import { TeamBadge } from '../components/TeamBadge';
import { fantasyPoints } from '../data/pricing';
import type { Player, Position } from '../data/types';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';
import {
  addBlocker,
  applyFormation,
  BUDGET,
  EMPTY_SQUAD,
  FORMATIONS,
  MAX_PER_CLUB,
  projectedPoints,
  spent,
  squadPlayers,
  type Formation,
  type Squad,
} from '../state/squad';
import { usePersistentState } from '../state/storage';
import { Stat } from './HomePage';

const ROWS: Position[] = ['FWD', 'MID', 'DEF', 'GK'];
const POSITION_NAME = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' } as const;

export function BuildTeamPage() {
  const { data, team } = useApp();
  const [squad, setSquad] = usePersistentState<Squad>('footiq.squad', EMPTY_SQUAD);
  const [picking, setPicking] = useState<Position | null>(null);
  const [query, setQuery] = useState('');

  const selected = squadPlayers(squad, data.players);
  const money = spent(selected);
  const limits = FORMATIONS[squad.formation];
  const complete = selected.length === 11;

  const candidates = useMemo(() => {
    if (!picking) return [];
    const q = query.trim().toLowerCase();
    return data.players
      .filter((p) => p.position === picking && !squad.playerIds.includes(p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || team(p.teamId)?.shortName.toLowerCase().includes(q))
      .map((p) => ({ p, pts: fantasyPoints(p.position, p.stats) }))
      .sort((a, b) => b.pts - a.pts || a.p.price - b.p.price)
      .slice(0, 60);
  }, [picking, query, data.players, squad.playerIds, team]);

  const add = (p: Player) => {
    setSquad((s) => ({ ...s, playerIds: [...s.playerIds, p.id] }));
    const filled = selected.filter((x) => x.position === p.position).length + 1;
    if (filled >= limits[p.position]) setPicking(null);
  };
  const remove = (id: number) =>
    setSquad((s) => ({ ...s, playerIds: s.playerIds.filter((x) => x !== id), captainId: s.captainId === id ? null : s.captainId }));

  return (
    <>
      <section className="panel">
        <div className="row between wrap gap">
          <input
            className="input title-input"
            value={squad.name}
            maxLength={40}
            aria-label="Team name"
            onChange={(e) => setSquad((s) => ({ ...s, name: e.target.value }))}
          />
          <div className="row gap-sm">
            <select
              className="input"
              aria-label="Formation"
              value={squad.formation}
              onChange={(e) => setSquad((s) => applyFormation(s, data.players, e.target.value as Formation))}
            >
              {Object.keys(FORMATIONS).map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <button className="btn ghost" onClick={() => setSquad({ ...EMPTY_SQUAD, name: squad.name })}>
              Reset
            </button>
          </div>
        </div>
        <div className="stat-row">
          <Stat label="Players" value={`${selected.length}/11`} />
          <Stat label="Budget left" value={`£${(BUDGET - money).toFixed(1)}m`} />
          <Stat label="Season pts" value={projectedPoints(squad, selected)} />
        </div>
        <div className="budget-bar" aria-hidden>
          <div style={{ width: `${Math.min(100, (money / BUDGET) * 100)}%` }} />
        </div>
        <p className="muted small">
          Pick 11 players within £{BUDGET}m, max {MAX_PER_CLUB} from any club. Tap a player to make them captain
          (double points). {complete && !squad.captainId && <strong>Choose a captain!</strong>}
        </p>
      </section>

      <div className="builder">
        <section className="pitch" aria-label="Your team">
          {ROWS.map((pos) => (
            <div key={pos} className="pitch-row">
              {Array.from({ length: limits[pos] }).map((_, i) => {
                const p = selected.filter((x) => x.position === pos)[i];
                if (!p)
                  return (
                    <button
                      key={i}
                      className={`slot empty ${picking === pos ? 'active' : ''}`}
                      onClick={() => {
                        setPicking(pos);
                        setQuery('');
                      }}
                    >
                      <span className="shirt">+</span>
                      <span className="slot-name">{pos}</span>
                    </button>
                  );
                const t = team(p.teamId);
                const captain = squad.captainId === p.id;
                return (
                  <div key={p.id} className="slot">
                    <button
                      className="shirt"
                      style={{ background: t?.color }}
                      title="Make captain"
                      onClick={() => setSquad((s) => ({ ...s, captainId: captain ? null : p.id }))}
                    >
                      {captain ? 'C' : t?.tla}
                    </button>
                    <a className="slot-name" href={href.player(p.id)}>
                      {p.name.split(' ').at(-1)}
                    </a>
                    <span className="slot-price">£{p.price}m</span>
                    <button className="remove" aria-label={`Remove ${p.name}`} onClick={() => remove(p.id)}>
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </section>

        <section className="panel picker">
          {picking ? (
            <>
              <div className="row between">
                <h2>Choose a {POSITION_NAME[picking].toLowerCase()}</h2>
                <button className="btn ghost" onClick={() => setPicking(null)}>
                  Close
                </button>
              </div>
              <input
                className="input"
                type="search"
                placeholder="Search by player or club…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <ul className="pick-list">
                {candidates.map(({ p, pts }) => {
                  const blocker = addBlocker(squad, selected, p);
                  return (
                    <li key={p.id}>
                      <button disabled={Boolean(blocker)} onClick={() => add(p)} title={blocker ?? 'Add to team'}>
                        <TeamBadge team={team(p.teamId)} size={22} />
                        <span className="grow left">
                          <span className="strong">{p.name}</span>
                          <span className="muted small block">
                            {blocker ?? `${team(p.teamId)?.shortName} · ${p.stats.goals}G ${p.stats.assists}A`}
                          </span>
                        </span>
                        <span className="muted small">{pts} pts</span>
                        <span className="strong">£{p.price}m</span>
                      </button>
                    </li>
                  );
                })}
                {!candidates.length && <li className="muted">No players found.</li>}
              </ul>
            </>
          ) : (
            <>
              <h2>Your XI</h2>
              {selected.length === 0 ? (
                <p className="muted">Tap an empty shirt on the pitch to start picking players.</p>
              ) : (
                <ul className="squad-list">
                  {selected.map((p) => (
                    <li key={p.id}>
                      <span className={`pos ${p.position}`}>{p.position}</span>
                      <a href={href.player(p.id)} className="grow">
                        {p.name} {squad.captainId === p.id && <strong>(C)</strong>}
                      </a>
                      <span className="muted small">£{p.price}m</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
