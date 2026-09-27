import type { NewsItem, NewsProvider } from './types';

// Football news from The Guardian Open Platform (https://open-platform.theguardian.com).
// Requests go through the /news-api proxy, which adds the API key server-side.
// Their terms require crediting The Guardian and linking to the original article.

interface GuardianResult {
  id: string;
  webTitle: string;
  webUrl: string;
  webPublicationDate: string;
  fields?: { trailText?: string; thumbnail?: string };
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

/** trailText is HTML; keep only the text. It's rendered as text, never as HTML. */
export function plainText(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#39|amp|lt|gt|quot|apos|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/\s+/g, ' ')
    .trim();
  return text || undefined;
}

/** Guardian query syntax: quoted names joined with OR. */
export function teamQuery(teams: { name: string }[]): string {
  return teams.map((t) => `"${t.name.replace(/"/g, '')}"`).join(' OR ');
}

export const guardianNews: NewsProvider = {
  id: 'guardian',
  attribution: { label: 'The Guardian', url: 'https://www.theguardian.com/football' },

  async load(teams) {
    const params = new URLSearchParams({
      section: 'football',
      'order-by': 'newest',
      'page-size': '30',
      'show-fields': 'trailText,thumbnail',
    });
    if (teams?.length) params.set('q', teamQuery(teams));
    const res = await fetch(`/news-api/search?${params}`);
    if (!res.ok) throw new Error(`News request failed (${res.status})`);
    const body = (await res.json()) as { response: { results: GuardianResult[] } };
    return body.response.results.map(
      (r): NewsItem => ({
        id: r.id,
        title: r.webTitle,
        summary: plainText(r.fields?.trailText),
        url: r.webUrl,
        source: 'The Guardian',
        publishedAt: r.webPublicationDate,
        image: r.fields?.thumbnail,
      }),
    );
  },
};
