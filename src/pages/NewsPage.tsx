import { useState } from 'react';
import { NewsList } from '../components/NewsList';
import { ErrorBox, Loading } from '../components/Status';
import { useApp, useNews } from '../state/AppContext';

const PAGE = 20;

export function NewsPage() {
  const { followedTeams } = useApp();
  const [mine, setMine] = useState(followedTeams.items.length > 0);
  const res = useNews(mine ? followedTeams.items : undefined);
  const [shown, setShown] = useState(PAGE);

  return (
    <section className="panel">
      <h2>News</h2>
      <div className="filters">
        <button
          className={`pill ${!mine ? 'active' : ''}`}
          onClick={() => {
            setMine(false);
            setShown(PAGE);
          }}
        >
          Latest
        </button>
        <button
          className={`pill ${mine ? 'active' : ''}`}
          onClick={() => {
            setMine(true);
            setShown(PAGE);
          }}
        >
          My teams
        </button>
      </div>
      {mine && !followedTeams.items.length ? (
        <p className="muted">Follow some teams to get news about them here.</p>
      ) : res.error && !res.data ? (
        <ErrorBox message={res.error} onRetry={res.reload} />
      ) : !res.data ? (
        <Loading what="news" />
      ) : (
        <>
          <NewsList items={res.data.slice(0, shown)} empty="No news right now." />
          {res.data.length > shown && (
            <button className="btn ghost more" onClick={() => setShown((n) => n + PAGE)}>
              Show more
            </button>
          )}
        </>
      )}
    </section>
  );
}
