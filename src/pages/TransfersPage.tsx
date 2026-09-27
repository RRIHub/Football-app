import { useState } from 'react';
import { CompetitionSelect } from '../components/CompetitionSelect';
import { ErrorBox, Loading } from '../components/Status';
import { NO_TRANSFER_FEED, TransferList } from '../components/TransferList';
import type { TransferType } from '../data/types';
import { useApp, useTransfers } from '../state/AppContext';

export function TransfersPage() {
  const { followedTeams, followedPlayers } = useApp();
  const res = useTransfers();
  const [type, setType] = useState<TransferType | 'all'>('all');
  const [code, setCode] = useState('ALL');
  const [mine, setMine] = useState(false);

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
    <section className="panel">
      <h2>Transfer centre</h2>
      <div className="filters">
        {(
          [
            ['all', 'All'],
            ['permanent', 'Signed'],
            ['loan', 'Loans'],
            ['free', 'Free'],
            ['rumour', 'Rumours'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} className={`pill ${type === key ? 'active' : ''}`} onClick={() => setType(key)}>
            {label}
          </button>
        ))}
        <CompetitionSelect value={code} onChange={setCode} allLabel="All leagues" only={['domestic']} />
        <label className="check">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only teams &amp; players I
          follow
        </label>
      </div>
      {res.error && res.data === undefined ? (
        <ErrorBox message={res.error} onRetry={res.reload} />
      ) : res.data === undefined ? (
        <Loading what="transfers" />
      ) : (
        <TransferList
          transfers={list}
          empty={
            res.data === null
              ? `${NO_TRANSFER_FEED} See the README for adding a transfer feed.`
              : 'No transfers match these filters.'
          }
        />
      )}
    </section>
  );
}
