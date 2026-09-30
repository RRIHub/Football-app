import { useState } from 'react';
import { FollowButton } from '../components/FollowButton';
import { LeagueTag } from '../components/LeagueTag';
import { statusLabel } from '../components/MatchCard';
import { ErrorBox, Loading } from '../components/Status';
import { TeamBadge } from '../components/TeamBadge';
import type { Lineup, LineupPlayer, Match, MatchDetails, MatchEvent, MatchPlayer, TeamStat } from '../data/types';
import { getConfig } from '../config';
import { mergeExtras, missingParts } from '../data/matchExtras';
import { followTeam, useApp, useMatch, useMatchExtras } from '../state/AppContext';
import { href } from '../state/router';

type Tab = 'summary' | 'lineups' | 'stats';

const GOALS: MatchEvent['type'][] = ['goal', 'penalty', 'own-goal'];

const minuteText = (e: { minute: number; extra?: number }) => `${e.minute}${e.extra ? `+${e.extra}` : ''}'`;

function PlayerName({ p, code }: { p: MatchPlayer | undefined; code: string }) {
  if (!p) return <span className="muted">Unknown</span>;
  if (p.id === undefined) return <span>{p.name}</span>;
  return <a href={href.player(p.code ?? code, p.id)}>{p.name}</a>;
}

export function MatchPage({ id }: { id: number }) {
  const res = useMatch(id);
  const base = res.data?.match.id === id ? res.data : undefined;
  // Anything the main provider lacks is looked up in other sources.
  const extras = useMatchExtras(base);
  const [tab, setTab] = useState<Tab>('summary');

  if (res.error && !res.data) return <ErrorBox message={res.error} onRetry={res.reload} />;
  if (!base) return <Loading what="match" />;
  const d = extras.data ? mergeExtras(base, extras.data) : base;
  const code = d.match.competition.code;
  // Still asking other sources for parts that are missing.
  const pending = extras.loading && !extras.data ? missingParts(base) : [];

  return (
    <>
      <MatchHeader d={d} />
      <section className="panel">
        <div className="tabs">
          {(
            [
              ['summary', 'Summary'],
              ['lineups', 'Line-ups'],
              ['stats', 'Stats'],
            ] as const
          ).map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'summary' ? (
          pending.includes('events') ? <Loading what="goals, cards and substitutions" /> : <Timeline d={d} code={code} />
        ) : tab === 'lineups' ? (
          pending.includes('lineups') ? <Loading what="line-ups" /> : <Lineups d={d} code={code} />
        ) : pending.includes('stats') ? (
          <Loading what="match stats" />
        ) : (
          <Stats d={d} />
        )}
        <SourceCredits d={d} />
        {extras.error && !extras.data && (
          <p className="muted small source-credits">
            Couldn't check other sources for this match: {extras.error}{' '}
            <button className="btn ghost small-btn" onClick={extras.reload}>
              Try again
            </button>
          </p>
        )}
      </section>
    </>
  );
}

function MatchHeader({ d }: { d: MatchDetails }) {
  const { followedTeams } = useApp();
  const m = d.match;
  const played = m.status === 'LIVE' || m.status === 'FINISHED';
  const kickoff = new Date(m.utcDate);
  const scorers = (teamId: number) => d.events.filter((e) => e.teamId === teamId && GOALS.includes(e.type));

  const side = (team: Match['home'], align: 'home' | 'away') => (
    <div className={`mh-team ${align}`}>
      <a href={href.team(team.id)} className="mh-team-link">
        <TeamBadge team={team} size={56} />
        <span className="mh-team-name">{team.name}</span>
      </a>
      <FollowButton
        compact
        following={followedTeams.isFollowing(team.id)}
        onToggle={() => followedTeams.toggle(followTeam(team))}
      />
      <ul className="mh-scorers">
        {scorers(team.id).map((e, i) => (
          <li key={i}>
            {e.player?.name ?? 'Unknown'} {minuteText(e)}
            {e.type === 'penalty' ? ' (pen)' : e.type === 'own-goal' ? ' (OG)' : ''}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section className="panel match-header">
      <div className="mh-meta">
        <LeagueTag competition={m.competition} />
        {(m.stage || m.matchday) && (
          <span className="muted small">
            {' · '}
            {[m.stage, m.matchday && `Matchday ${m.matchday}`].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
      <div className="mh-main">
        {side(m.home, 'home')}
        <div className="mh-score">
          {played ? (
            <div className="mh-result">
              {m.homeScore ?? 0} <span className="muted">–</span> {m.awayScore ?? 0}
            </div>
          ) : (
            <div className="mh-kickoff">{kickoff.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          )}
          <div className={`mh-status ${m.status.toLowerCase()}`}>
            {m.status === 'SCHEDULED' ? kickoff.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) : m.status === 'FINISHED' && !m.statusText ? 'Full time' : statusLabel(m)}
          </div>
          {d.halfTime && d.halfTime.home !== null && played && (
            <div className="muted small">
              HT {d.halfTime.home}–{d.halfTime.away}
            </div>
          )}
          {m.note && <div className="match-note">{m.note}</div>}
        </div>
        {side(m.away, 'away')}
      </div>
      <div className="mh-facts muted small">
        <span>{kickoff.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        {d.venue && <span>🏟 {d.venue}</span>}
        {d.referee && <span>Referee: {d.referee}</span>}
      </div>
    </section>
  );
}

/* ---------- summary timeline ---------- */

function eventText(e: MatchEvent, code: string) {
  switch (e.type) {
    case 'goal':
      return (
        <>
          <span className="ev-icon" aria-label="Goal">⚽</span>
          <span>
            <strong>
              <PlayerName p={e.player} code={code} />
            </strong>
            {e.assist && (
              <span className="muted small block">
                Assist: <PlayerName p={e.assist} code={code} />
              </span>
            )}
          </span>
        </>
      );
    case 'penalty':
      return (
        <>
          <span className="ev-icon" aria-label="Penalty goal">⚽</span>
          <span>
            <strong>
              <PlayerName p={e.player} code={code} />
            </strong>{' '}
            <span className="muted small">(penalty)</span>
          </span>
        </>
      );
    case 'own-goal':
      return (
        <>
          <span className="ev-icon" aria-label="Own goal">⚽</span>
          <span>
            <strong>
              <PlayerName p={e.player} code={code} />
            </strong>{' '}
            <span className="muted small">(own goal)</span>
          </span>
        </>
      );
    case 'missed-penalty':
      return (
        <>
          <span className="ev-icon" aria-label="Missed penalty">✖</span>
          <span>
            <PlayerName p={e.player} code={code} /> <span className="muted small">(missed penalty)</span>
          </span>
        </>
      );
    case 'yellow':
      return (
        <>
          <span className="card-icon yellow" aria-label="Yellow card" />
          <PlayerName p={e.player} code={code} />
        </>
      );
    case 'second-yellow':
      return (
        <>
          <span className="card-icon second" aria-label="Second yellow card" />
          <span>
            <PlayerName p={e.player} code={code} /> <span className="muted small">(second yellow)</span>
          </span>
        </>
      );
    case 'red':
      return (
        <>
          <span className="card-icon red" aria-label="Red card" />
          <PlayerName p={e.player} code={code} />
        </>
      );
    case 'sub':
      return (
        <>
          <span className="ev-icon" aria-label="Substitution">⇄</span>
          {e.playerOn || e.playerOff ? (
            <span>
              <span className="sub-on">▲</span> <PlayerName p={e.playerOn} code={code} />
              <span className="muted small block">
                <span className="sub-off">▼</span> <PlayerName p={e.playerOff} code={code} />
              </span>
            </span>
          ) : (
            <span>
              <PlayerName p={e.swapped?.[0]} code={code} /> ⇄ <PlayerName p={e.swapped?.[1]} code={code} />
            </span>
          )}
        </>
      );
    case 'var':
      return (
        <>
          <span className="ev-icon" aria-label="VAR">📺</span>
          <span>
            VAR{e.detail ? `: ${e.detail}` : ''} {e.player && <span className="muted small">({e.player.name})</span>}
          </span>
        </>
      );
  }
}

function Unavailable({ what }: { what: string }) {
  const also = getConfig().matchSources;
  return (
    <p className="muted">
      {what} aren't available for this match from the current data provider
      {also.length ? `, and weren't found in ${also.join(', ').replace(/, ([^,]*)$/, ' or $1')}` : ''}. The README explains
      which sources cover which matches.
    </p>
  );
}

const PART_NAMES = { events: 'goals, cards and subs', lineups: 'line-ups', stats: 'stats' } as const;

/** Credit for other sources that filled in this match (StatsBomb's terms require it). */
function SourceCredits({ d }: { d: MatchDetails }) {
  if (!d.sources?.length) return null;
  return (
    <p className="muted small source-credits">
      {d.sources.map((s, i) => (
        <span key={s.name}>
          {i > 0 && ' · '}
          {s.parts.map((p) => PART_NAMES[p]).join(', ').replace(/^./, (c) => c.toUpperCase())} from{' '}
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.name}
          </a>
        </span>
      ))}
    </p>
  );
}

function Timeline({ d, code }: { d: MatchDetails; code: string }) {
  const m = d.match;
  if (m.status === 'SCHEDULED' || m.status === 'POSTPONED')
    return <p className="muted">{m.status === 'POSTPONED' ? 'This match has been postponed.' : "The match hasn't started yet."}</p>;
  if (d.unavailable?.includes('events')) return <Unavailable what="Goalscorers, cards and substitutions" />;
  if (!d.events.length) return <p className="muted">No goals, cards or substitutions yet.</p>;
  const firstHalf = d.events.filter((e) => e.minute <= 45);
  const secondHalf = d.events.filter((e) => e.minute > 45);
  const reachedHT = m.status === 'FINISHED' || (m.minute ?? 0) > 45 || m.statusText === 'HT';
  const row = (e: MatchEvent, i: number) => {
    const home = e.teamId === m.home.id;
    const goal = GOALS.includes(e.type);
    return (
      <li key={i} className={`ev ${home ? 'home' : 'away'} ${goal ? 'goal' : ''}`}>
        <div className="ev-side">{home && eventText(e, code)}</div>
        <div className="ev-minute">{minuteText(e)}</div>
        <div className="ev-side">{!home && eventText(e, code)}</div>
      </li>
    );
  };
  return (
    <ol className="timeline">
      {firstHalf.map(row)}
      {reachedHT && (
        <li className="ev-divider">
          Half time{d.halfTime && d.halfTime.home !== null ? ` · ${d.halfTime.home}–${d.halfTime.away}` : ''}
        </li>
      )}
      {secondHalf.map(row)}
      {m.status === 'FINISHED' && (
        <li className="ev-divider">
          Full time · {m.homeScore}–{m.awayScore}
        </li>
      )}
    </ol>
  );
}

/* ---------- line-ups ---------- */

interface PlayerMarks {
  goals: number;
  assists: number;
  yellow: boolean;
  red: boolean;
  offAt?: string;
  onAt?: string;
}

function marksFor(events: MatchEvent[]): Map<string, PlayerMarks> {
  const marks = new Map<string, PlayerMarks>();
  const key = (p: MatchPlayer) => (p.id !== undefined ? `id:${p.id}` : `name:${p.name}`);
  const get = (p: MatchPlayer) => {
    const k = key(p);
    if (!marks.has(k)) marks.set(k, { goals: 0, assists: 0, yellow: false, red: false });
    return marks.get(k)!;
  };
  for (const e of events) {
    if ((e.type === 'goal' || e.type === 'penalty') && e.player) get(e.player).goals++;
    if (e.type === 'goal' && e.assist) get(e.assist).assists++;
    if (e.type === 'yellow' && e.player) get(e.player).yellow = true;
    if ((e.type === 'red' || e.type === 'second-yellow') && e.player) get(e.player).red = true;
    if (e.type === 'sub') {
      if (e.playerOff) get(e.playerOff).offAt = minuteText(e);
      if (e.playerOn) get(e.playerOn).onAt = minuteText(e);
    }
  }
  return marks;
}

const markKey = (p: MatchPlayer) => (p.id !== undefined ? `id:${p.id}` : `name:${p.name}`);

function Marks({ m }: { m?: PlayerMarks }) {
  if (!m) return null;
  return (
    <span className="marks">
      {Array.from({ length: m.goals }, (_, i) => (
        <span key={i} title="Goal">
          ⚽
        </span>
      ))}
      {m.assists > 0 && <span title="Assist">🅰{m.assists > 1 ? `×${m.assists}` : ''}</span>}
      {m.yellow && !m.red && <span className="card-icon yellow small" title="Yellow card" />}
      {m.red && <span className="card-icon red small" title="Sent off" />}
      {m.offAt && (
        <span className="sub-off" title="Substituted off">
          ▼{m.offAt}
        </span>
      )}
      {m.onAt && (
        <span className="sub-on" title="Came on">
          ▲{m.onAt}
        </span>
      )}
    </span>
  );
}

/** Rows from the goalkeeper forward: by pitch grid when given, otherwise by position. */
function formationRows(xi: LineupPlayer[]): LineupPlayer[][] {
  if (xi.length && xi.every((p) => p.grid)) {
    const rows = new Map<number, LineupPlayer[]>();
    for (const p of xi) {
      const [r] = p.grid!.split(':').map(Number);
      rows.set(r, [...(rows.get(r) ?? []), p]);
    }
    return [...rows.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, ps]) => ps.sort((a, b) => Number(a.grid!.split(':')[1]) - Number(b.grid!.split(':')[1])));
  }
  return (['G', 'D', 'M', 'F'] as const).map((pos) => xi.filter((p) => p.position === pos)).filter((r) => r.length);
}

const shortName = (name: string) => name.split(' ').at(-1) ?? name;

function Pitch({ lineup, marks, team, code }: { lineup: Lineup; marks: Map<string, PlayerMarks>; team: Match['home']; code: string }) {
  // Attack upwards: goalkeeper at the bottom.
  const rows = formationRows(lineup.startXI).reverse();
  return (
    <div className="pitch mini" aria-label={`${team.name} formation ${lineup.formation ?? ''}`}>
      {rows.map((row, i) => (
        <div key={i} className="pitch-row">
          {row.map((p) => (
            <div key={markKey(p)} className="slot">
              <span className="shirt" style={{ background: team.color }}>
                {p.number ?? ''}
              </span>
              {p.id !== undefined ? (
                <a className="slot-name" href={href.player(p.code ?? code, p.id)}>
                  {shortName(p.name)}
                </a>
              ) : (
                <span className="slot-name">{shortName(p.name)}</span>
              )}
              <Marks m={marks.get(markKey(p))} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Lineups({ d, code }: { d: MatchDetails; code: string }) {
  const m = d.match;
  if (d.unavailable?.includes('lineups')) return <Unavailable what="Line-ups" />;
  if (!d.lineups.length)
    return (
      <p className="muted">
        {m.status === 'SCHEDULED' ? 'Line-ups are usually announced about an hour before kick-off.' : 'Line-ups aren’t available for this match.'}
      </p>
    );
  const marks = marksFor(d.events);
  return (
    <div className="lineups">
      {d.lineups.map((l) => {
        const team = l.teamId === m.home.id ? m.home : m.away;
        return (
          <div key={l.teamId} className="lineup">
            <h3 className="row gap-sm">
              <TeamBadge team={team} size={24} /> {team.name}
              {l.formation && <span className="muted small">{l.formation}</span>}
            </h3>
            <Pitch lineup={l} marks={marks} team={team} code={code} />
            <div className="label">Starting XI</div>
            <ul className="lineup-list">
              {l.startXI.map((p) => (
                <li key={markKey(p)}>
                  <span className="num">{p.number ?? ''}</span>
                  <span className="grow">
                    {p.id !== undefined ? <a href={href.player(p.code ?? code, p.id)}>{p.name}</a> : p.name}
                  </span>
                  <Marks m={marks.get(markKey(p))} />
                  {p.position && <span className={`pos ${{ G: 'GK', D: 'DEF', M: 'MID', F: 'FWD' }[p.position]}`}>{p.position}</span>}
                </li>
              ))}
            </ul>
            {l.substitutes.length > 0 && (
              <>
                <div className="label">Substitutes</div>
                <ul className="lineup-list">
                  {l.substitutes.map((p) => (
                    <li key={markKey(p)} className={marks.get(markKey(p))?.onAt ? '' : 'unused'}>
                      <span className="num">{p.number ?? ''}</span>
                      <span className="grow">
                        {p.id !== undefined ? <a href={href.player(p.code ?? code, p.id)}>{p.name}</a> : p.name}
                      </span>
                      <Marks m={marks.get(markKey(p))} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            {l.coach && <p className="muted small">Coach: {l.coach}</p>}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- stats ---------- */

const numeric = (v: TeamStat['home']) => (v === null ? 0 : typeof v === 'number' ? v : Number.parseFloat(v) || 0);

function Stats({ d }: { d: MatchDetails }) {
  const m = d.match;
  if (d.unavailable?.includes('stats')) return <Unavailable what="Team stats" />;
  if (!d.stats.length)
    return <p className="muted">{m.status === 'SCHEDULED' ? 'Stats appear once the match kicks off.' : 'No stats for this match.'}</p>;
  return (
    <div className="stats">
      <div className="stats-teams">
        <span className="row gap-sm home-key">
          <TeamBadge team={m.home} size={20} /> {m.home.shortName}
        </span>
        <span className="row gap-sm away-key">
          {m.away.shortName} <TeamBadge team={m.away} size={20} />
        </span>
      </div>
      {d.stats.map((s) => {
        const h = numeric(s.home);
        const a = numeric(s.away);
        const total = h + a;
        const homeShare = total ? (h / total) * 100 : 50;
        return (
          <div key={s.label} className="stat-line">
            <div className="stat-values">
              <strong className={h > a ? 'lead' : ''}>{s.home ?? '–'}</strong>
              <span className="muted small">{s.label}</span>
              <strong className={a > h ? 'lead' : ''}>{s.away ?? '–'}</strong>
            </div>
            <div className="stat-bar" aria-hidden>
              <div className="home" style={{ width: `${homeShare}%` }} />
              <div className="away" style={{ width: `${100 - homeShare}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
