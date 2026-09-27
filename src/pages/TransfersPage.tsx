import { useState } from 'react';
import { CompetitionSelect } from '../components/CompetitionSelect';
import { NewsList } from '../components/NewsList';
import { ErrorBox, Loading } from '../components/Status';
import { NO_TRANSFER_FEED, TransferList } from '../components/TransferList';
import { provider, type TransferType } from '../data';
import { useApp, useNews, useTransfers } from '../state/AppContext';
import { href } from '../state/router';

export function TransfersPage() {
  const { followedTeams, followedPlayers } = useApp();
  const res = useTransfers(followedTeams.ids);
  const rumours = useNews(followedTeams.items.length ? followedTeams.items : undefined, 'transfers');
  const [type, setType] = useState<TransferType | 'all'>('all');
  const [code, setCode] = useState('ALL');
  const [mine, setMine] = useState(false);
  const byTeam = Boolean(provider.transfersByTeam);

  const list = (res.data ?? [])
    .filter((t) => type === 'all' || t.type === type)
    .filter((t) => code === 'ALL' || t.competitionCode === code)
    .filter(
      (t) =>
        !mine ||
        (t.playerId !== undefined && followedPlayers.isFollowing(t.playerId)) ||
        followedTeams.isFollowing(t.from.id) ||
        followedTeams.isFollowing(t.to.id),
    );

  return (
    <>
      <section className="panel">
        <h2>Transfer centre</h2>
        {byTeam && <p className="muted small">Confirmed transfers in the last 12 months for the clubs you follow.</p>}
        <div className="filters">
          {(
            [
              ['all', 'All'],
              ['permanent', 'Signed'],
              ['loan', 'Loans'],
              ['free', 'Free'],
              ...(byTeam ? [] : ([['rumour', 'Rumours']] as const)),
            ] as const
          ).map(([key, label]) => (
            <button key={key} className={`pill ${type === key ? 'active' : ''}`} onClick={() => setType(key)}>
              {label}
            </button>
          ))}
          {!byTeam && (
            <>
              <CompetitionSelect value={code} onChange={setCode} allLabel="All leagues" only={['domestic']} />
              <label className="check">
                <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only teams &amp;
                players I follow
              </label>
            </>
          )}
        </div>
        {res.needsTeams ? (
          <p className="muted">
            <a href={href.favourites}>Follow some clubs</a> to see their confirmed transfers.
          </p>
        ) : res.error && res.data === undefined ? (
          <ErrorBox message={res.error} onRetry={res.reload} />
        ) : res.data === undefined ? (
          <Loading what="transfers" />
        ) : (
          <TransferList
            transfers={list}
            empty={res.data === null ? NO_TRANSFER_FEED : 'No transfers match these filters.'}
          />
        )}
      </section>

      <section className="panel">
        <h2>Rumours &amp; transfer news</h2>
        <p className="muted small">Rumours are reports, not confirmed deals. Each links to the original story.</p>
        {rumours.error && !rumours.data ? (
          <ErrorBox message={rumours.error} onRetry={rumours.reload} />
        ) : !rumours.data ? (
          <Loading what="transfer news" />
        ) : (
          <NewsList items={rumours.data.slice(0, 15)} empty="No transfer news right now." compact />
        )}
      </section>
    </>
  );
}
