import { useState } from 'react';
import { TransferList } from '../components/TransferList';
import type { TransferType } from '../data/types';
import { useApp } from '../state/AppContext';

export function TransfersPage() {
  const { data, followedTeams, followedPlayers } = useApp();
  const [type, setType] = useState<TransferType | 'all'>('all');
  const [mine, setMine] = useState(false);

  const list = data.transfers
    .filter((t) => type === 'all' || t.type === type)
    .filter(
      (t) =>
        !mine ||
        (t.playerId !== undefined && followedPlayers.isFollowing(t.playerId)) ||
        (t.fromTeamId !== undefined && followedTeams.isFollowing(t.fromTeamId)) ||
        (t.toTeamId !== undefined && followedTeams.isFollowing(t.toTeamId)),
    );

  return (
    <section className="panel">
      <h2>Transfer centre</h2>
      <div className="filters wrap">
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
        <label className="check">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only teams &amp; players I
          follow
        </label>
      </div>
      <TransferList
        transfers={list}
        empty={
          data.transfersUnavailable
            ? 'Transfer news is not available from the current data provider. See the README for adding a transfer feed.'
            : 'No transfers match these filters.'
        }
      />
    </section>
  );
}
