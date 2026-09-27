import { useMemo, useState } from 'react';
import { CompetitionSelect } from '../components/CompetitionSelect';
import { MatchesByCompetition } from '../components/MatchCard';
import { ErrorBox, Loading } from '../components/Status';
import { useApp, useMatchWindow } from '../state/AppContext';
import { usePersistentState } from '../state/storage';

const DAYS_BACK = 3;
const DAYS_AHEAD = 6;

function dayLabel(offset: number, date: Date): string {
  if (offset === 0) return 'Today';
  if (offset === -1) return 'Yesterday';
  if (offset === 1) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
}

export function ScoresPage() {
  const { followedTeams } = useApp();
  const res = useMatchWindow(DAYS_BACK, DAYS_AHEAD);
  const [offset, setOffset] = useState(0);
  const [liveOnly, setLiveOnly] = useState(false);
  const [mine, setMine] = useState(false);
  const [code, setCode] = usePersistentState('footiq.scoresCompetition', 'ALL');

  const hasLive = res.data?.some((m) => m.status === 'LIVE') ?? false;

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_BACK + DAYS_AHEAD + 1 }, (_, i) => {
        const o = i - DAYS_BACK;
        const d = new Date();
        d.setDate(d.getDate() + o);
        return { offset: o, date: d };
      }),
    [],
  );
  const selectedDay = days.find((d) => d.offset === offset)!.date.toDateString();

  const matches = (res.data ?? [])
    .filter((m) => (liveOnly ? m.status === 'LIVE' : new Date(m.utcDate).toDateString() === selectedDay))
    .filter((m) => code === 'ALL' || m.competition.code === code)
    .filter((m) => !mine || followedTeams.isFollowing(m.home.id) || followedTeams.isFollowing(m.away.id))
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  return (
    <section className="panel">
      <h2>Scores &amp; fixtures</h2>
      <div className="day-strip" role="tablist">
        {days.map((d) => (
          <button
            key={d.offset}
            role="tab"
            aria-selected={!liveOnly && offset === d.offset}
            className={`day-pill ${!liveOnly && offset === d.offset ? 'active' : ''}`}
            onClick={() => {
              setOffset(d.offset);
              setLiveOnly(false);
            }}
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
        <CompetitionSelect value={code} onChange={setCode} allLabel="All competitions" />
      </div>
      {res.error && !res.data ? (
        <ErrorBox message={res.error} onRetry={res.reload} />
      ) : !res.data ? (
        <Loading what="matches" />
      ) : (
        <MatchesByCompetition
          matches={matches}
          empty={
            liveOnly
              ? 'No matches in play right now.'
              : mine
                ? 'None of your teams play on this day.'
                : 'No matches on this day.'
          }
        />
      )}
    </section>
  );
}
