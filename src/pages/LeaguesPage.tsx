import { useMemo, useState } from 'react';
import type { Competition, CompetitionCategory } from '../data/types';
import { useApp } from '../state/AppContext';
import { href } from '../state/router';

const SECTIONS: [CompetitionCategory, string][] = [
  ['domestic', 'Top leagues'],
  ['cup', 'Domestic cups'],
  ['europe', 'Continental competitions'],
  ['international', 'International'],
];

function CompTile({ c, showArea = true }: { c: Competition; showArea?: boolean }) {
  return (
    <a href={href.league(c.code)} className="team-tile comp-tile">
      {c.emblem ? (
        <img className="crest comp-emblem" src={c.emblem} alt="" width={36} height={36} loading="lazy" />
      ) : (
        <span className="comp-flag" aria-hidden>
          {c.flag ?? '⚽'}
        </span>
      )}
      <div className="grow">
        <div className="strong">{c.name}</div>
        {showArea && <div className="muted small">{c.area}</div>}
      </div>
      <span className="muted" aria-hidden>
        ›
      </span>
    </a>
  );
}

/** Within a country: leagues before cups, then provider order (ids follow the division order). */
function byTier(list: Competition[], all: Competition[]): Competition[] {
  const rank = (c: Competition) => (Number.isFinite(Number(c.code)) ? Number(c.code) : all.indexOf(c));
  return [...list].sort(
    (a, b) => Number(a.category === 'cup') - Number(b.category === 'cup') || rank(a) - rank(b),
  );
}

export function LeaguesPage() {
  const { competitions } = useApp();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  const countries = useMemo(() => {
    const map = new Map<string, Competition[]>();
    for (const c of competitions) map.set(c.area || 'Other', [...(map.get(c.area || 'Other') ?? []), c]);
    return [...map].sort(([a], [b]) => a.localeCompare(b));
  }, [competitions]);

  const matches = q
    ? countries
        .map(([area, list]) => {
          const hit = area.toLowerCase().includes(q) ? list : list.filter((c) => c.name.toLowerCase().includes(q));
          return [area, hit] as const;
        })
        .filter(([, list]) => list.length)
    : countries;

  return (
    <>
      {!q &&
        SECTIONS.map(([cat, title]) => {
          const list = competitions.filter((c) => c.category === cat && c.featured);
          if (!list.length) return null;
          return (
            <section key={cat} className="panel">
              <h2>{title}</h2>
              <div className="team-grid">
                {list.map((c) => (
                  <CompTile key={c.code} c={c} />
                ))}
              </div>
            </section>
          );
        })}

      <section className="panel">
        <h2>All countries</h2>
        <p className="muted small">
          Every league and cup we cover, including second and third divisions.{' '}
          {competitions.length > 20 && `${competitions.length} competitions in ${countries.length} countries.`}
        </p>
        <div className="filters">
          <input
            className="input grow"
            type="search"
            placeholder="Search a country or competition…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {!matches.length && <p className="muted">Nothing matches “{query}”.</p>}
        <div className="country-list">
          {matches.map(([area, list]) => {
            const expanded = Boolean(q) || open === area;
            return (
              <div key={area} className={`country ${expanded ? 'open' : ''}`}>
                <button className="country-head" aria-expanded={expanded} onClick={() => setOpen(expanded && !q ? null : area)}>
                  <span className="strong">{area}</span>
                  <span className="muted small">{list.length}</span>
                </button>
                {expanded && (
                  <div className="team-grid country-comps">
                    {byTier(list, competitions).map((c) => (
                      <CompTile key={c.code} c={c} showArea={false} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
