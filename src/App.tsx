import { useApp } from './state/AppContext';
import { href, useRoute, type Route } from './state/router';
import { HomePage } from './pages/HomePage';
import { ScoresPage } from './pages/ScoresPage';
import { PlayersPage } from './pages/PlayersPage';
import { PlayerPage } from './pages/PlayerPage';
import { TeamsPage } from './pages/TeamsPage';
import { TeamPage } from './pages/TeamPage';
import { BuildTeamPage } from './pages/BuildTeamPage';
import { TransfersPage } from './pages/TransfersPage';

const NAV: { label: string; href: string; match: Route['page'][] }[] = [
  { label: 'My FootIQ', href: href.home, match: ['home'] },
  { label: 'Scores', href: href.scores, match: ['scores'] },
  { label: 'Players', href: href.players, match: ['players', 'player'] },
  { label: 'Teams', href: href.teams, match: ['teams', 'team'] },
  { label: 'Build XI', href: href.build, match: ['build'] },
  { label: 'Transfers', href: href.transfers, match: ['transfers'] },
];

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case 'scores':
      return <ScoresPage />;
    case 'players':
      return <PlayersPage />;
    case 'player':
      return <PlayerPage id={route.id} />;
    case 'teams':
      return <TeamsPage />;
    case 'team':
      return <TeamPage id={route.id} />;
    case 'build':
      return <BuildTeamPage />;
    case 'transfers':
      return <TransfersPage />;
    default:
      return <HomePage />;
  }
}

export function App() {
  const route = useRoute();
  const { data, source } = useApp();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a href={href.home} className="brand">
            Foot<span>IQ</span>
          </a>
          <span className="comp muted">
            {data.competition} · {data.season}
          </span>
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
          Demo mode: sample fixtures and fictional players. Add an API key to see live data (see README).
        </div>
      )}
      <main className="container">
        <Page route={route} />
      </main>
      <footer className="footer muted">
        FootIQ · Updated {new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
