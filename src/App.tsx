import { useSyncExternalStore } from 'react';
import { useAuth } from './auth/AuthContext';
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
import { MatchPage } from './pages/MatchPage';

const NAV: { label: string; href: string; match: Route['page'][] }[] = [
  { label: 'My FootIQ', href: href.home, match: ['home', 'favourites'] },
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
    case 'favourites':
      return <FavouritesPicker onDone={() => (location.hash = href.home)} />;
    default:
      return <HomePage />;
  }
}

export function App() {
  const route = useRoute();
  const { source } = useApp();
  const { user, signOut, finishOnboarding } = useAuth();
  const problems = useSyncExternalStore(dataHealth.subscribe, dataHealth.get);
  const dataError = problems.filter((p) => p.kind === 'data').map((p) => p.message).join(' ');
  const accountError = problems.filter((p) => p.kind === 'account').map((p) => p.message).join(' ');
  const attribution = dataAttribution();

  // New accounts pick their favourite clubs and players first.
  if (user && !user.onboarded)
    return (
      <main className="container onboarding">
        <h1 className="brand">
          Foot<span>IQ</span>
        </h1>
        <FavouritesPicker welcomeName={user.name} onDone={finishOnboarding} />
      </main>
    );

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
            <span className="avatar" title={user?.email} aria-hidden>
              {user?.name.charAt(0).toUpperCase()}
            </span>
            <button className="btn ghost small-btn" onClick={signOut}>
              Sign out
            </button>
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
      {accountError && (
        <div className="error-banner" role="alert">
          <strong>Your changes aren't being saved.</strong> {accountError}
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
