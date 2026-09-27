import type { CompetitionRef } from '../data/types';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';

/** Small linked label showing which league/competition something belongs to. */
export function LeagueTag({ competition, plain = false }: { competition: CompetitionRef | undefined; plain?: boolean }) {
  const { competition: lookup } = useApp();
  if (!competition) return null;
  const c = lookup(competition.code);
  const label = (
    <>
      {c?.flag && <span aria-hidden>{c.flag}</span>} {competition.name}
    </>
  );
  if (plain || !c) return <span className="league-tag">{label}</span>;
  return (
    <a
      className="league-tag"
      href={href.league(competition.code)}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </a>
  );
}
