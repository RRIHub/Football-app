import { demoProvider } from './demoProvider';
import { liveProvider } from './liveProvider';
import type { DataProvider } from './types';

declare const __LIVE_DATA__: boolean;

/** Live data when an API key is configured, otherwise the built-in demo data. */
export const provider: DataProvider =
  typeof __LIVE_DATA__ !== 'undefined' && __LIVE_DATA__ ? liveProvider : demoProvider;

export * from './types';
