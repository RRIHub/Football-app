import { useApp } from './state/AppContext';
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

const NAV: { label: string; href: string; match: Route['page'][] }[] = [
  { label: 'My FootIQ', href: href.home, match: ['home'] },
  { label: 'Scores', href: href.scores, match: ['scores'] },
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
    default:
      return <HomePage />;
  }
}

export function App() {
  const route = useRoute();
  const { source } = useApp();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a href={href.home} className="brand">
            Foot<span>IQ</span>
          </a>
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
          Demo mode: fictional players and sample results. Add a free API key to get real players, live scores and
          news (see README).
        </div>
      )}
      <main className="container">
        <Page route={route} />
      </main>
      <footer className="footer muted">
        FootIQ
        {source === 'live' && (
          <>
            {' · '}Data provided by{' '}
            <a href="https://www.football-data.org" target="_blank" rel="noreferrer">
              football-data.org
            </a>
          </>
        )}
      </footer>
    </>
  );
}
