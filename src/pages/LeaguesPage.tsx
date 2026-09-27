import type { CompetitionCategory } from '../data/types';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';

const SECTIONS: [CompetitionCategory, string, string][] = [
  ['domestic', 'Leagues', 'Domestic leagues in England and around the world'],
  ['europe', 'European competitions', 'Club competitions across Europe'],
  ['international', 'International', 'National teams'],
];

export function LeaguesPage() {
  const { competitions } = useApp();
  return (
    <>
      {SECTIONS.map(([cat, title, blurb]) => {
        const list = competitions.filter((c) => c.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat} className="panel">
            <h2>{title}</h2>
            <p className="muted small">{blurb}</p>
            <div className="team-grid">
              {list.map((c) => (
                <a key={c.code} href={href.league(c.code)} className="team-tile comp-tile">
                  <span className="comp-flag" aria-hidden>
                    {c.flag ?? '⚽'}
                  </span>
                  <div className="grow">
                    <div className="strong">{c.name}</div>
                    <div className="muted small">{c.area}</div>
                  </div>
                  <span className="muted" aria-hidden>
                    ›
                  </span>
                </a>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
