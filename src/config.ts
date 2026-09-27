// Settings from the server (/api/config). Loaded once before the app renders,
// so a key added in the host's environment takes effect without a rebuild.

import type { PublicConfig } from '../server/handlers';

export type RuntimeConfig = PublicConfig;

/** Used only by tests and until the server's config has loaded. */
const DEFAULTS: RuntimeConfig = {
  dataSource: 'demo',
  news: false,
  competitions: '',
  liveRefreshSeconds: 20,
  apiFootballRequestsPerMinute: 10,
};

let current: RuntimeConfig = DEFAULTS;

export function getConfig(): RuntimeConfig {
  return current;
}

export function setConfig(config: RuntimeConfig) {
  current = config;
}

/**
 * Fetches the server's config. Fails loudly rather than falling back to demo
 * data, so a broken deployment is obvious instead of quietly showing fake scores.
 */
export async function fetchConfig(fetchImpl: typeof fetch = fetch): Promise<RuntimeConfig> {
  let res: Response;
  try {
    res = await fetchImpl('/api/config', { cache: 'no-store' });
  } catch {
    throw new Error("Couldn't reach the FootIQ server. Check your connection and try again.");
  }
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('application/json'))
    throw new Error(
      `The FootIQ server isn't responding correctly (/api/config returned ${res.status}${type.includes('json') ? '' : ', not JSON'}). ` +
        'If this is a Vercel deployment, check that the functions in /api were deployed.',
    );
  const body = (await res.json()) as Partial<RuntimeConfig>;
  if (!body.dataSource || !['api-football', 'football-data', 'demo'].includes(body.dataSource))
    throw new Error('The FootIQ server sent an invalid config.');
  return { ...DEFAULTS, ...body } as RuntimeConfig;
}
