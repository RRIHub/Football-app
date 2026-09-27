import type { Transfer } from '../data/types';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';
import { LeagueTag } from './LeagueTag';
import { TeamBadge } from './TeamBadge';

const TYPE_LABEL = { permanent: 'Signed', loan: 'Loan', free: 'Free', rumour: 'Rumour' } as const;

export function TransferList({ transfers, empty }: { transfers: Transfer[]; empty: string }) {
  const { competition } = useApp();
  if (!transfers.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="transfers">
      {transfers.map((t) => {
        const comp = competition(t.competitionCode);
        return (
          <li key={t.id} className="transfer">
            <span className={`tag ${t.type}`}>{TYPE_LABEL[t.type]}</span>
            <div className="transfer-main">
              <span>
                {t.playerId && comp ? (
                  <a href={href.player(comp.code, t.playerId)} className="strong">
                    {t.playerName}
                  </a>
                ) : (
                  <span className="strong">{t.playerName}</span>
                )}
                {comp && (
                  <span className="small">
                    {' '}
                    <LeagueTag competition={comp} />
                  </span>
                )}
              </span>
              <span className="transfer-route muted">
                <a href={href.team(t.from.id)} className="row gap-xs">
                  <TeamBadge team={t.from} size={18} /> {t.from.name}
                </a>
                <span aria-hidden> → </span>
                <a href={href.team(t.to.id)} className="row gap-xs">
                  <TeamBadge team={t.to} size={18} /> {t.to.name}
                </a>
              </span>
            </div>
            <div className="transfer-meta">
              <span className="strong">{t.fee ?? '—'}</span>
              <span className="muted small">{new Date(t.date).toLocaleDateString()}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export const NO_TRANSFER_FEED = 'Transfer news is not available from the current data provider.';
