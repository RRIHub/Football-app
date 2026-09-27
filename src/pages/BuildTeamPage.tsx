import { useMemo, useState } from 'react';
import { CompetitionSelect } from '../components/CompetitionSelect';
import { LeagueTag } from '../components/LeagueTag';
import { Stat } from '../components/Stat';
import { ErrorBox, Loading } from '../components/Status';
import { TeamBadge } from '../components/TeamBadge';
import { fantasyPoints } from '../data/pricing';
import type { Player, Position } from '../data/types';
import { useApp, useCompetition } from '../state/AppContext';
import { href } from '../state/router';
import {
  addBlocker,
  applyFormation,
  BUDGET,
  EMPTY_SQUAD,
  FORMATIONS,
  isSquad,
  MAX_PER_CLUB,
  projectedPoints,
  spent,
  type Formation,
  type Squad,
} from '../state/squad';
import { useAccountField } from '../auth/accountData';
import { usePersistentState } from '../state/storage';

const ROWS: Position[] = ['FWD', 'MID', 'DEF', 'GK'];
const POSITION_NAME = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' } as const;

export function BuildTeamPage() {
  // Saved with the account, so each person has their own XI on any device.
  const [squad, setSquad] = useAccountField<Squad>('xi', EMPTY_SQUAD, isSquad);
  const [picking, setPicking] = useState<Position | null>(null);

  const money = spent(squad);
  const limits = FORMATIONS[squad.formation];
  const complete = squad.players.length === 11;

  const add = (p: Player) => {
    setSquad((s) => ({ ...s, players: [...s.players, p] }));
    const filled = squad.players.filter((x) => x.position === p.position).length + 1;
    if (filled >= limits[p.position]) setPicking(null);
  };
  const remove = (id: number) =>
    setSquad((s) => ({
      ...s,
      players: s.players.filter((x) => x.id !== id),
      captainId: s.captainId === id ? null : s.captainId,
    }));

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
              onChange={(e) => setSquad((s) => applyFormation(s, e.target.value as Formation))}
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
          <Stat label="Players" value={`${squad.players.length}/11`} />
          <Stat label="Budget left" value={`£${(BUDGET - money).toFixed(1)}m`} />
          <Stat label="Season pts" value={projectedPoints(squad)} />
        </div>
        <div className="budget-bar" aria-hidden>
          <div style={{ width: `${Math.min(100, (money / BUDGET) * 100)}%` }} />
        </div>
        <p className="muted small">
          Pick 11 players from any league within £{BUDGET}m, max {MAX_PER_CLUB} from any club. Tap a player's shirt to
          make them captain (double points). {complete && !squad.captainId && <strong>Choose a captain!</strong>}
        </p>
      </section>

      <div className="builder">
        <section className="pitch" aria-label="Your team">
          {ROWS.map((pos) => (
            <div key={pos} className="pitch-row">
              {Array.from({ length: limits[pos] }).map((_, i) => {
                const p = squad.players.filter((x) => x.position === pos)[i];
                if (!p)
                  return (
                    <button
                      key={i}
                      className={`slot empty ${picking === pos ? 'active' : ''}`}
                      onClick={() => setPicking(pos)}
                    >
                      <span className="shirt">+</span>
                      <span className="slot-name">{pos}</span>
                    </button>
                  );
                const captain = squad.captainId === p.id;
                return (
                  <div key={p.id} className="slot">
                    <button
                      className="shirt"
                      style={{ background: p.team.color }}
                      title="Make captain"
                      onClick={() => setSquad((s) => ({ ...s, captainId: captain ? null : p.id }))}
                    >
                      {captain ? 'C' : p.team.tla}
                    </button>
                    <a className="slot-name" href={href.player(p.competition.code, p.id)}>
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
            <Picker position={picking} squad={squad} onPick={add} onClose={() => setPicking(null)} />
          ) : (
            <>
              <h2>Your XI</h2>
              {squad.players.length === 0 ? (
                <p className="muted">Tap an empty shirt on the pitch to start picking players.</p>
              ) : (
                <ul className="squad-list single">
                  {squad.players.map((p) => (
                    <li key={p.id}>
                      <span className={`pos ${p.position}`}>{p.position}</span>
                      <a href={href.player(p.competition.code, p.id)} className="grow">
                        {p.name} {squad.captainId === p.id && <strong>(C)</strong>}
                        <span className="muted small block">
                          {p.team.shortName} · {p.competition.name}
                        </span>
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

function Picker({
  position,
  squad,
  onPick,
  onClose,
}: {
  position: Position;
  squad: Squad;
  onPick: (p: Player) => void;
  onClose: () => void;
}) {
  const { competitions } = useApp();
  const [code, setCode] = usePersistentState(
    'footiq.pickerCompetition',
    competitions.find((c) => c.category === 'domestic')?.code ?? '',
  );
  const [query, setQuery] = useState('');
  const res = useCompetition(code);
  const data = res.data?.competition.code === code ? res.data : undefined;

  const candidates = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.players
      .filter((p) => p.position === position && !squad.players.some((s) => s.id === p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.team.name.toLowerCase().includes(q))
      .map((p) => ({ p, pts: fantasyPoints(p.position, p.stats) }))
      .sort((a, b) => b.pts - a.pts || a.p.price - b.p.price)
      .slice(0, 60);
  }, [data, position, query, squad.players]);

  return (
    <>
      <div className="row between">
        <h2>Choose a {POSITION_NAME[position].toLowerCase()}</h2>
        <button className="btn ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="filters">
        <CompetitionSelect value={code} onChange={setCode} only={['domestic', 'europe']} />
        <input
          className="input"
          type="search"
          placeholder="Search by player or club…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {res.error && !data ? (
        <ErrorBox message={res.error} onRetry={res.reload} />
      ) : !data ? (
        <Loading what="players" />
      ) : (
        <ul className="pick-list">
          {candidates.map(({ p, pts }) => {
            const blocker = addBlocker(squad, p);
            return (
              <li key={p.id}>
                <button disabled={Boolean(blocker)} onClick={() => onPick(p)} title={blocker ?? 'Add to team'}>
                  <TeamBadge team={p.team} size={22} />
                  <span className="grow left">
                    <span className="strong">{p.name}</span>
                    <span className="muted small block">
                      {blocker ?? `${p.team.shortName} · ${p.stats.goals}G ${p.stats.assists}A`}
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
      )}
      <p className="muted small">
        Showing players from <LeagueTag competition={data?.competition} plain />
      </p>
    </>
  );
}
