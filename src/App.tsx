import { useSyncExternalStore } from 'react';
import { dataHealth } from './data/http';
import { dataAttribution, useApp } from './state/AppContext';
import { href, useRoute, type Route } from './state/router';
import { HomePage } from './pages/HomePage';
import { ScoresPage } from './pages/ScoresPage';
import { LeaguesPage } from './pages/LeaguesPage';
import { LeaguePage } from './pages/LeaguePage';
import { TeamPage } from './pages/TeamPage';
import { PlayersPage } from './pages/PlayersPage';
import { PlayerPage } from './pages/PlayerPage';
import { BuildTeamPage } from './pages/BuildTeamPage';
import { TransfersPage } from './pages/TransfersPage';
import { NewsPage } from './pages/NewsPage';
import { FavouritesPicker } from './pages/FavouritesPicker';
import { ProfilePage } from './pages/ProfilePage';
import { countryByCode } from './profile/countries';
import { useProfile } from './profile/ProfileContext';
import { MatchPage } from './pages/MatchPage';

const NAV: { label: string; href: string; match: Route['page'][] }[] = [
  { label: 'My FootIQ', href: href.home, match: ['home', 'favourites', 'profile'] },
  { label: 'Scores', href: href.scores, match: ['scores', 'match'] },
  { label: 'News', href: href.news, match: ['news'] },
  { label: 'Leagues', href: href.leagues, match: ['leagues', 'league', 'team'] },
  { label: 'Players', href: href.players, match: ['players', 'player'] },
  { label: 'Build XI', href: href.build, match: ['build'] },
  { label: 'Transfers', href: href.transfers, match: ['transfers'] },
];

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case 'scores':
      return <ScoresPage />;
    case 'leagues':
      return <LeaguesPage />;
    case 'league':
      return <LeaguePage key={route.code} code={route.code} />;
    case 'team':
      return <TeamPage key={route.id} id={route.id} />;
    case 'players':
      return <PlayersPage />;
    case 'player':
      return <PlayerPage key={`${route.code}/${route.id}`} code={route.code} id={route.id} />;
    case 'build':
      return <BuildTeamPage />;
    case 'transfers':
      return <TransfersPage />;
    case 'news':
      return <NewsPage />;
    case 'match':
      return <MatchPage key={route.id} id={route.id} />;
    case 'profile':
      return <ProfilePage />;
    case 'favourites':
      return <FavouritesPicker onDone={() => (location.hash = href.home)} />;
    default:
      return <HomePage />;
  }
}

export function App() {
  const route = useRoute();
  const { source } = useApp();
  const { profile } = useProfile();
  const problems = useSyncExternalStore(dataHealth.subscribe, dataHealth.get);
  const dataError = problems.map((p) => p.message).join(' ');
  const attribution = dataAttribution();
  const nation = countryByCode(profile?.nationality);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a href={href.home} className="brand">
            Foot<span>IQ</span>
          </a>
          <div className="user-menu">
            <a href={href.favourites} className="muted small">
              Edit favourites
            </a>
            <a href={href.profile} className="user-chip" title="Your profile">
              <span className="avatar" aria-hidden>
                {profile?.username.charAt(0).toUpperCase()}
              </span>
              <span className="user-name">
                @{profile?.username}
                {nation && <span aria-hidden> {nation.flag}</span>}
              </span>
            </a>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className={n.match.includes(route.page) ? 'active' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
      </header>
      {source === 'demo' && (
        <div className="demo-banner">
          Demo mode: no football data key is set on the server, so these are fictional players and sample results.
          Set FOOTBALL_DATA_API_KEY or API_FOOTBALL_KEY and redeploy (see README).
        </div>
      )}
      {dataError && (
        <div className="error-banner" role="alert">
          <strong>Live data isn't loading.</strong> {dataError}
        </div>
      )}

      <main className="container">
        <Page route={route} />
      </main>
      <footer className="footer muted">
        FootIQ
        {attribution && (
          <>
            {' · '}Data provided by{' '}
            <a href={attribution.url} target="_blank" rel="noreferrer">
              {attribution.label}
            </a>
          </>
        )}
      </footer>
    </>
  );
}
