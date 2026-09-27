import type { Transfer } from '../data/types';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';
import { TeamBadge } from './TeamBadge';

const TYPE_LABEL = { permanent: 'Signed', loan: 'Loan', free: 'Free', rumour: 'Rumour' } as const;

export function TransferList({ transfers, empty }: { transfers: Transfer[]; empty: string }) {
  const { team, player } = useApp();
  if (!transfers.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="transfers">
      {transfers.map((t) => (
        <li key={t.id} className="transfer">
          <span className={`tag ${t.type}`}>{TYPE_LABEL[t.type]}</span>
          <div className="transfer-main">
            {t.playerId && player(t.playerId) ? (
              <a href={href.player(t.playerId)} className="strong">{t.playerName}</a>
            ) : (
              <span className="strong">{t.playerName}</span>
            )}
            <span className="transfer-route muted">
              <TeamBadge team={team(t.fromTeamId)} size={18} /> {t.fromName}
              <span aria-hidden> → </span>
              <TeamBadge team={team(t.toTeamId)} size={18} /> {t.toName}
            </span>
          </div>
          <div className="transfer-meta">
            <span className="strong">{t.fee ?? '—'}</span>
            <span className="muted small">{new Date(t.date).toLocaleDateString()}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
