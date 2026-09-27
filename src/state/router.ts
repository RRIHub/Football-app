import { useEffect, useState } from 'react';

export type Route =
  | { page: 'home' }
  | { page: 'scores' }
  | { page: 'leagues' }
  | { page: 'league'; code: string }
  | { page: 'team'; id: number }
  | { page: 'players' }
  | { page: 'player'; code: string; id: number }
  | { page: 'build' }
  | { page: 'transfers' }
  | { page: 'news' }
  | { page: 'favourites' };

export function parseHash(hash: string): Route {
  const [page, a, b] = hash.replace(/^#\/?/, '').split('/');
  switch (page) {
    case 'scores':
    case 'leagues':
    case 'players':
    case 'build':
    case 'transfers':
    case 'news':
    case 'favourites':
      return { page };
    case 'league':
      return a ? { page, code: decodeURIComponent(a) } : { page: 'leagues' };
    case 'team':
      return Number.isInteger(Number(a)) && a ? { page, id: Number(a) } : { page: 'leagues' };
    case 'player':
      return a && Number.isInteger(Number(b)) && b ? { page, code: decodeURIComponent(a), id: Number(b) } : { page: 'players' };
    default:
      return { page: 'home' };
  }
}

export const href = {
  home: '#/',
  scores: '#/scores',
  leagues: '#/leagues',
  players: '#/players',
  build: '#/build',
  transfers: '#/transfers',
  news: '#/news',
  favourites: '#/favourites',
  league: (code: string) => `#/league/${encodeURIComponent(code)}`,
  team: (id: number) => `#/team/${id}`,
  player: (code: string, id: number) => `#/player/${encodeURIComponent(code)}/${id}`,
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
