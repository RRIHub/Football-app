import { useMemo, useState } from 'react';
import { dateForOffset, offsetFromInput, toInputValue } from '../state/dates';
import { CompetitionSelect } from '../components/CompetitionSelect';
import { MatchesByCompetition } from '../components/MatchCard';
import { ErrorBox, Loading } from '../components/Status';
import { useApp, useMatchesOnDay } from '../state/AppContext';
import { usePersistentState } from '../state/storage';

/** Days shown either side of the selected day in the strip. */
const STRIP_SPAN = 3;

function dayLabel(offset: number, date: Date): string {
  if (offset === 0) return 'Today';
  if (offset === -1) return 'Yesterday';
  if (offset === 1) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
}

export function ScoresPage() {
  const { followedTeams, competition } = useApp();
  const [offset, setOffset] = useState(0);
  const [liveOnly, setLiveOnly] = useState(false);
  const [mine, setMine] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [intl, setIntl] = useState(false);
  const [code, setCode] = usePersistentState('footiq.scoresCompetition', 'ALL');
  // Live games are always today's.
  const res = useMatchesOnDay(liveOnly ? 0 : offset);
  const hasLive = res.data?.some((m) => m.status === 'LIVE') ?? false;

  // Any day can be shown; the strip follows the selected one.
  const days = useMemo(
    () =>
      Array.from({ length: STRIP_SPAN * 2 + 1 }, (_, i) => {
        const o = offset - STRIP_SPAN + i;
        return { offset: o, date: dateForOffset(o) };
      }),
    [offset],
  );
  const goTo = (o: number) => {
    setOffset(o);
    setLiveOnly(false);
  };

  const matches = (res.data ?? [])
    .filter((m) => !liveOnly || m.status === 'LIVE')
    .filter((m) => code === 'ALL' || m.competition.code === code)
    .filter((m) => !intl || competition(m.competition.code)?.category === 'international')
    .filter((m) => !mine || followedTeams.isFollowing(m.home.id) || followedTeams.isFollowing(m.away.id))
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  return (
    <section className="panel">
      <h2>Scores &amp; fixtures</h2>
      <p className="muted small tz-note">
        Kick-off times in your time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
      </p>
      <div className="date-nav">
        <button className="btn ghost" aria-label="Previous day" onClick={() => goTo(offset - 1)}>
          ‹
        </button>
        <input
          className="input"
          type="date"
          aria-label="Choose a date"
          value={toInputValue(dateForOffset(offset))}
          onChange={(e) => {
            const o = offsetFromInput(e.target.value);
            if (o !== null) goTo(o);
          }}
        />
        <button className="btn ghost" aria-label="Next day" onClick={() => goTo(offset + 1)}>
          ›
        </button>
        {offset !== 0 && (
          <button className="btn ghost" onClick={() => goTo(0)}>
            Today
          </button>
        )}
      </div>
      <div className="day-strip" role="tablist">
        {days.map((d) => (
          <button
            key={d.offset}
            role="tab"
            aria-selected={!liveOnly && offset === d.offset}
            className={`day-pill ${!liveOnly && offset === d.offset ? 'active' : ''}`}
            onClick={() => goTo(d.offset)}
          >
            {dayLabel(d.offset, d.date)}
          </button>
        ))}
      </div>
      <div className="filters">
        <button className={`pill live-pill ${liveOnly ? 'active' : ''}`} onClick={() => setLiveOnly((v) => !v)}>
          {hasLive && <span className="pulse small-pulse" />} Live
        </button>
        <button className={`pill ${mine ? 'active' : ''}`} onClick={() => setMine((v) => !v)}>
          My teams
        </button>
        <button className={`pill ${intl ? 'active' : ''}`} onClick={() => setIntl((v) => !v)}>
          Internationals
        </button>
        <CompetitionSelect value={code} onChange={setCode} allLabel="All competitions" />
        <button className="pill" onClick={() => setExpandAll((v) => !v)} aria-pressed={expandAll}>
          {expandAll ? 'Collapse' : 'Expand all'}
        </button>
      </div>
      {res.error && !res.data ? (
        <ErrorBox message={res.error} onRetry={res.reload} />
      ) : !res.data ? (
        <Loading what="matches" />
      ) : (
        <MatchesByCompetition
          key={String(expandAll)}
          expandAll={expandAll}
          matches={matches}
          empty={
            liveOnly
              ? 'No matches in play right now.'
              : mine
                ? 'None of your teams play on this day.'
                : intl
                  ? 'No international matches on this day.'
                  : 'No matches on this day.'
          }
        />
      )}
    </section>
  );
}
