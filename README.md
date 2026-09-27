# FootIQ

Football scores, player stats, news and transfers for leagues and cups around the world, including second and third divisions, plus the Champions League and international football. There's also a build-your-own-team game. Sign in and follow your favourite clubs, national teams and players.

## Features

- **Accounts**: create an account or sign in. New accounts pick their favourite clubs (search any club, or browse by league), then favourite players from those clubs' squads. Change them anytime with **Edit favourites**.
- **My FootIQ**: a personal feed with live matches, today's games, your teams' last result and next fixture in any competition, your players' stats, and transfer news involving them.
- **Scores**: pick a day, then see matches grouped by competition. Filter by live games, "my teams" or a single competition. Live scores refresh automatically (every 20 seconds by default).
- **News**: the latest football news, or only stories about the teams you follow. News also appears in your feed and on team pages.
- **Leagues**: browse featured competitions, or every country's leagues and cups, including lower divisions. Each has a table (group tables for tournaments, knockout rounds for cups), matches by round, top scorers and assists, and a list of teams.
- **Teams**: club and national team pages show the team's league, every competition it plays in, its league position and form, and results and fixtures labelled by competition. They also show the squad and transfers.
- **Players**: a searchable, sortable stats table for any league, filterable by position and club. Player pages show which league the stats come from.
- **Build XI**: pick 11 players from any league in one of six formations within an £85m budget (max 3 per club). Choose a captain for double points and see your season points.
- **Transfers**: confirmed signings, loans and free transfers for your clubs. Rumours come from news stories, each linked to its source.
- Accounts, favourites and your XI are saved in this browser (see [Accounts](#accounts)).

## Getting started

```bash
npm install
npm run dev
```

Without an API key the app runs in **demo mode**, with generated fixtures and fictional players so you can try every feature. Demo mode includes the Premier League, Championship, League One, La Liga, Bundesliga, Serie A, Ligue 1, the EFL Cup, the Champions League and the Nations League. Demo players are fictional, and the demo news is written from demo results. Real players, scores and news need the API keys below.

### Where the data comes from

All scores, stats and transfers come from licensed football data APIs, so they're only as accurate as the provider's feed. FootIQ doesn't copy data from other websites (FotMob, OneFootball, LiveScore and the like); their terms don't allow it. Set up one of these providers:

| | API-Football (recommended) | football-data.org |
| --- | --- | --- |
| Coverage | 1,000+ leagues and cups in every country, including second and third divisions | 12 top competitions (free tier) |
| Live scores | Yes, with minute, half-time, extra time and penalties | Yes |
| Squads & player stats | Full squads, per-player stats | Squads, top scorers |
| Transfers | Confirmed transfers per club | Not available |
| Price | Free tier for testing; paid plans for real traffic | Free tier |

If both keys are set, FootIQ uses API-Football.

### Live data: API-Football

1. Register at https://dashboard.api-football.com/register and copy your key
2. `cp .env.example .env` and set `API_FOOTBALL_KEY`
3. Set `API_FOOTBALL_REQUESTS_PER_MINUTE` to your plan's limit
4. `npm run dev`

The key is added by the proxy (`/af-api/*`) and never reaches the browser. The free plan has a small daily request allowance, which is enough to try the app but not to run it for other people. Check their pricing page for plans.

Kick-off times use each visitor's own time zone, and "today" means their local day. Live scores show the minute, stoppage time (e.g. 90+4'), half-time, extra time and penalty shoot-outs.

Every country's leagues and cups load from one request (cached for a day), so the Leagues page can list them all. A competition's table, fixtures, teams and top scorers/assists load the first time you open it. A player's full stats load when you open their page.

### Live data: football-data.org

FootIQ can also use [football-data.org](https://www.football-data.org), a licensed football data API with a free tier:

1. Register for a free key at https://www.football-data.org/client/register
2. `cp .env.example .env` and set `FOOTBALL_DATA_API_KEY`
3. `npm run dev`

The key stays server-side. Vite proxies `/api/*` to football-data.org and adds the key there, so it never reaches the browser.

The free tier covers the Premier League, Championship, La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, Primeira Liga, Brasileirão, the Champions League, the European Championship and the World Cup. To show fewer competitions, or more on a paid plan, set `FOOTBALL_DATA_COMPETITIONS` to a comma-separated list of codes (e.g. `PL,PD,CL,WC`).

Cups such as the FA Cup (`FAC`) and the Europa League (`EL`) need a paid plan; add their codes to `FOOTBALL_DATA_COMPETITIONS` if yours includes them.

Data loads only when it's needed. The Scores page gets every competition in one request, and each league's details load the first time you open them. Results are cached, and requests are queued to stay within the free tier's 10 requests/minute.

While matches are live, scores refresh every `LIVE_REFRESH_SECONDS` (default 20, minimum 5). Every refresh is one request, so on the free tier's 10 requests/minute, 20 seconds leaves room for everything else. A paid plan with a higher limit can refresh more often.

Free-tier limitations:
- Stats cover goals, assists and appearances (from the top-scorers list). Minutes, cards and clean sheets need a paid plan.
- Transfers aren't included. The Transfers page shows a notice in live mode.
- International football is limited to the World Cup and the European Championship. Nations League, qualifiers and friendlies need a paid plan.

The provider asks for a credit, so the footer says "Data provided by football-data.org" in live mode. Keep it.

### News and rumours

News comes from [The Guardian Open Platform](https://open-platform.theguardian.com), which offers free developer keys:

1. Get a key at https://open-platform.theguardian.com/access/
2. Set `GUARDIAN_API_KEY` in `.env`

As with the football data, the key is added by the proxy and never reaches the browser. The Guardian's terms require that stories are credited and link to the original article, so every story shows "The Guardian" and opens on their site. Keep that credit. Without a key, FootIQ shows demo news.

Transfer rumours on the Transfers page are Guardian stories about transfers. They are reports, not confirmed deals, and each one links to the original article. No licensed data feed covers rumours, so they come from news.

### Accounts

Accounts are stored on the device: names, emails and favourites live in the browser's localStorage. Passwords are salted and hashed (PBKDF2-SHA256) and never stored as typed. So accounts don't follow you between devices or browsers, and clearing site data removes them.

To offer real accounts that sync across devices, replace `src/auth/accounts.ts` with a hosted auth service (e.g. Supabase, Firebase Auth or Auth0) and store favourites in its database. `AuthContext` and the rest of the app don't need to change.

### Adding another data source

All data flows through the `DataProvider` interface in `src/data/types.ts`. To use a different licensed provider (for example, one that includes transfers or detailed stats), implement its methods (`listCompetitions`, `loadCompetition`, `loadMatches`, `loadTeam`, `searchTeams`, `loadTransfers`, optionally `loadPlayer`) to return FootIQ's own types, then select it in `src/data/index.ts`. Only use sources whose terms allow this; don't scrape websites.

### Deploying

`npm run build` produces a static site in `dist/`. In live mode, production hosting also needs something to play the proxy's role, e.g. a small serverless function that:
- forwards `/af-api/*` to `https://v3.football.api-sports.io` with the `x-apisports-key` header (or `/api/*` to `https://api.football-data.org/v4` with `X-Auth-Token`), and
- forwards `/news-api/*` to `https://content.guardianapis.com` with an `api-key` query parameter.

Have that function cache responses for a few seconds. Then every visitor shares the same requests instead of each one using up your plan's rate limit.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build (proxy included) |
| `npm test` | Run unit tests |
