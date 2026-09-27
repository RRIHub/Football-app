import type { NewsItem } from '../data/types';
import { newsAttribution } from '../state/AppContext';

export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.round((now - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NewsList({ items, empty, compact = false }: { items: NewsItem[]; empty: string; compact?: boolean }) {
  const attribution = newsAttribution();
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <>
      <ul className={`news ${compact ? 'compact' : ''}`}>
        {items.map((n) => {
          const external = /^https?:/.test(n.url);
          return (
            <li key={n.id}>
              <a
                className="news-item"
                href={n.url}
                {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
              >
                {n.image && !compact && <img src={n.image} alt="" loading="lazy" />}
                <div className="grow">
                  <div className="news-title">{n.title}</div>
                  {n.summary && !compact && <p className="news-summary muted">{n.summary}</p>}
                  <div className="muted small">
                    {n.source} · {timeAgo(n.publishedAt)}
                    {external && ' ↗'}
                  </div>
                </div>
              </a>
            </li>
          );
        })}
      </ul>
      {attribution && (
        <p className="muted small attribution">
          News from{' '}
          <a href={attribution.url} target="_blank" rel="noreferrer">
            {attribution.label}
          </a>
        </p>
      )}
    </>
  );
}
