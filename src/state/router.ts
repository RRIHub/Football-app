import { useEffect, useState } from 'react';

export type Route =
  | { page: 'home' }
  | { page: 'scores' }
  | { page: 'players' }
  | { page: 'teams' }
  | { page: 'team'; id: number }
  | { page: 'player'; id: number }
  | { page: 'build' }
  | { page: 'transfers' };

export function parseHash(hash: string): Route {
  const [page, id] = hash.replace(/^#\/?/, '').split('/');
  const num = Number(id);
  switch (page) {
    case 'scores':
    case 'players':
    case 'teams':
    case 'build':
    case 'transfers':
      return { page };
    case 'team':
    case 'player':
      return Number.isInteger(num) ? { page, id: num } : { page: `${page}s` as 'teams' | 'players' };
    default:
      return { page: 'home' };
  }
}

export const href = {
  home: '#/',
  scores: '#/scores',
  players: '#/players',
  teams: '#/teams',
  build: '#/build',
  transfers: '#/transfers',
  team: (id: number) => `#/team/${id}`,
  player: (id: number) => `#/player/${id}`,
};

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
