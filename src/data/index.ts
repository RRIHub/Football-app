import { getConfig, type RuntimeConfig } from '../config';
import { apiFootballProvider } from './apiFootball';
import { demoNews, demoProvider } from './demoProvider';
import { guardianNews } from './guardianNews';
import { liveProvider } from './liveProvider';
import type { DataProvider, NewsProvider } from './types';

/** The provider the server has a key for: API-Football, then football-data.org, else demo data. */
export function selectProvider(config: RuntimeConfig = getConfig()): DataProvider {
  switch (config.dataSource) {
    case 'api-football':
      return apiFootballProvider;
    case 'football-data':
      return liveProvider;
    default:
      return demoProvider;
  }
}

export function selectNews(config: RuntimeConfig = getConfig()): NewsProvider {
  return config.news ? guardianNews : demoNews;
}

// The rest of the app imports these; they follow the config loaded at startup.
const active = () => selectProvider();

export const provider: DataProvider = {
  get id() {
    return active().id;
  },
  get attribution() {
    return active().attribution;
  },
  get transfersByTeam() {
    return active().transfersByTeam;
  },
  get loadPlayer() {
    const p = active();
    return p.loadPlayer?.bind(p);
  },
  listCompetitions: () => active().listCompetitions(),
  loadCompetition: (code) => active().loadCompetition(code),
  loadMatches: (from, to) => active().loadMatches(from, to),
  loadTeam: (id) => active().loadTeam(id),
  searchTeams: (q) => active().searchTeams(q),
  loadTransfers: (ids) => active().loadTransfers(ids),
  loadMatch: (id) => active().loadMatch(id),
};

export const news: NewsProvider = {
  get id() {
    return selectNews().id;
  },
  get attribution() {
    return selectNews().attribution;
  },
  load: (teams, topic) => selectNews().load(teams, topic),
};

export * from './types';
