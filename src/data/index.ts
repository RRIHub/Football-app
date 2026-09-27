import { apiFootballProvider } from './apiFootball';
import { demoNews, demoProvider } from './demoProvider';
import { guardianNews } from './guardianNews';
import { liveProvider } from './liveProvider';
import type { DataProvider, NewsProvider } from './types';

declare const __DATA_SOURCE__: 'api-football' | 'football-data' | 'demo';
declare const __LIVE_NEWS__: boolean;

const source = typeof __DATA_SOURCE__ === 'string' ? __DATA_SOURCE__ : 'demo';

/** API-Football if configured, then football-data.org, otherwise built-in demo data. */
export const provider: DataProvider =
  source === 'api-football' ? apiFootballProvider : source === 'football-data' ? liveProvider : demoProvider;

/** Guardian news when a Guardian key is configured, otherwise demo stories. */
export const news: NewsProvider = typeof __LIVE_NEWS__ !== 'undefined' && __LIVE_NEWS__ ? guardianNews : demoNews;

export * from './types';
