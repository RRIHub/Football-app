import { demoNews, demoProvider } from './demoProvider';
import { guardianNews } from './guardianNews';
import { liveProvider } from './liveProvider';
import type { DataProvider, NewsProvider } from './types';

declare const __LIVE_DATA__: boolean;
declare const __LIVE_NEWS__: boolean;

/** Live data when an API key is configured, otherwise the built-in demo data. */
export const provider: DataProvider =
  typeof __LIVE_DATA__ !== 'undefined' && __LIVE_DATA__ ? liveProvider : demoProvider;

/** Guardian news when a Guardian key is configured, otherwise demo stories. */
export const news: NewsProvider = typeof __LIVE_NEWS__ !== 'undefined' && __LIVE_NEWS__ ? guardianNews : demoNews;

export * from './types';
