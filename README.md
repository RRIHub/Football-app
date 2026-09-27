# FootIQ

Football scores, player stats, news and transfers for leagues and cups around the world, including second and third divisions, plus the Champions League and international football. There's also a build-your-own-team game. Sign in and follow your favourite clubs, national teams and players.

## Features

- **Accounts**: create an account or sign in. New accounts pick their favourite clubs (search any club, or browse by league), then favourite players from those clubs' squads. Change them anytime with **Edit favourites**.
- **My FootIQ**: a personal feed with live matches, today's games, your teams' last result and next fixture in any competition, your players' stats, and transfer news involving them.
- **Scores**: pick any date (from the day strip, the arrows or a calendar), then see matches grouped by competition. Filter by live games, "my teams", internationals or a single competition, and use **Expand all** to open every competition. Live scores refresh automatically (every 20 seconds by default).
- **Match pages**: tap any match for the score, half-time score, scorers, venue and referee, plus three tabs. **Summary** is a timeline of goals (with assists, penalties and own goals), cards and substitutions. **Line-ups** shows each formation on a pitch, the starting XI, substitutes and coach, with goals, assists, cards and substitutions marked. **Stats** compares possession, xG, shots, corners, fouls, saves, passes and more. Live matches refresh as they're played.
- **News**: the latest football news, or only stories about the teams you follow. News also appears in your feed and on team pages.
- **Leagues**: browse featured competitions, or every country's leagues and cups, including lower divisions. Each has a table (group tables for tournaments, knockout rounds for cups), matches (by round, or every match, result or fixture of the season), top scorers and assists, and a list of teams.
- **Teams**: club and national team pages show the team's league, every competition it plays in, its league position and form, and results and fixtures labelled by competition (the latest six, or every match of the season). They also show the squad and transfers.
- **Players**: a searchable, sortable stats table for any league, filterable by position and club. Player pages show which league the stats come from.
- **Build XI**: pick 11 players from any league in one of six formations within an £85m budget (max 3 per club). Choose a captain for double points and see your season points.
- **Transfers**: confirmed signings, loans and free transfers for your clubs. Rumours come from news stories, each linked to its source.
- Accounts work on any device, and favourites and your XI are saved to the account (see [Accounts](#accounts)).

## Getting started

```bash
npm install
npm run dev
```

Without an API key the app runs in **demo mode**, with generated fixtures and fictional players so you can try every feature. Demo mode includes the Premier League, Championship, League One, League Two, La Liga, LaLiga 2, Bundesliga, Serie A, Ligue 1, Ligue 2, MLS (with Eastern and Western Conference tables), the Saudi Pro League, the EFL Cup, and the Champions League, Europa League and Conference League. For international football it has the World Cup, Euros, Copa América, Africa Cup of Nations, Nations League and friendlies, with 54 national teams. The demo tournaments are labelled "Demo edition" because their results are invented. Every demo league has a full home-and-away season. Demo players are fictional, and the demo news is written from demo results. Real players, scores and news need the API keys below.

### Where the data comes from

All scores, stats and transfers come from licensed football data APIs, so they're only as accurate as the provider's feed. FootIQ doesn't copy data from other websites (FotMob, OneFootball, LiveScore and the like); their terms don't allow it. Set up one of these providers:

| | API-Football (recommended) | football-data.org |
| --- | --- | --- |
| Coverage | 1,000+ leagues and cups in every country, including second and third divisions | 12 top competitions (free tier) |
| Live scores | Yes, with minute, half-time, extra time and penalties | Yes |
| Squads & player stats | Full squads, per-player stats | Squads, top scorers |
| Transfers | Confirmed transfers per club | Not available |
| Match details (scorers, assists, cards, subs, line-ups, team stats) | Yes | Score, half-time, venue and referee on the free plan; the rest needs a paid plan with "deep data" |
| Europa League, Conference League | Yes | Europa League on paid plans only |
| MLS, Saudi Pro League | Yes | No |
| League One, League Two, LaLiga 2, Ligue 2 | Yes | No (Championship and Ligue 1 are free) |
| International | World Cup, Euros, Copa América, Africa Cup of Nations, Nations League, friendlies, and World Cup qualifiers in every region | World Cup and Euros only |
| Price | Free tier for testing; paid plans for real traffic | Free tier |

If both keys are set, FootIQ uses API-Football.

### Live data: API-Football

1. Register at https://dashboard.api-football.com/register and copy your key
2. `cp .env.example .env` and set `API_FOOTBALL_KEY`
3. Set `API_FOOTBALL_REQUESTS_PER_MINUTE` to your plan's limit
4. `npm run dev`

The key is added server-side by `/api/api-football` and never reaches the browser. The free plan has a small daily request allowance, which is enough to try the app but not to run it for other people. Check their pricing page for plans.

The Leagues page features the English, Spanish, German, Italian and French top two divisions (plus League One and League Two), MLS, the Saudi Pro League, the Champions League, Europa League and Conference League. Every other league is in the country browser. Seasons are named from their real dates, so calendar-year leagues like MLS show "2026" rather than "2026/27".

International football appears in its own section on the Leagues page and under an **Internationals** filter on the Scores page. National teams can be followed like clubs (search for the country, or pick them from a tournament).

Kick-off times use each visitor's own time zone, and "today" means their local day. Live scores show the minute, stoppage time (e.g. 90+4'), half-time, extra time and penalty shoot-outs.

Every country's leagues and cups load from one request (cached for a day), so the Leagues page can list them all. A competition's table, fixtures, teams and top scorers/assists load the first time you open it. A player's full stats load when you open their page. A team page loads the team's whole season, in every competition it plays in.

### Live data: football-data.org

FootIQ can also use [football-data.org](https://www.football-data.org), a licensed football data API with a free tier:

1. Register for a free key at https://www.football-data.org/client/register
2. `cp .env.example .env` and set `FOOTBALL_DATA_API_KEY`
3. `npm run dev`

The key stays server-side: `/api/football-data` adds it to each request, so it never reaches the browser.

The free tier covers the Premier League, Championship, La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, Primeira Liga, Brasileirão, the Champions League, the European Championship and the World Cup. To show fewer competitions, or more on a paid plan, set `FOOTBALL_DATA_COMPETITIONS` to a comma-separated list of codes (e.g. `PL,PD,CL,WC`).

Cups such as the FA Cup (`FAC`) and the Europa League (`EL`) need a paid plan; add their codes to `FOOTBALL_DATA_COMPETITIONS` if yours includes them.

Data loads only when it's needed. The Scores page gets every competition in one request, and each league's details load the first time you open them. Results are cached, and requests are queued to stay within the free tier's 10 requests/minute.

While matches are live, scores refresh every `LIVE_REFRESH_SECONDS` (default 20, minimum 5). Every refresh is one request, so on the free tier's 10 requests/minute, 20 seconds leaves room for everything else. A paid plan with a higher limit can refresh more often.

Free-tier limitations:
- Stats cover goals, assists and appearances (from the top-scorers list). Minutes, cards and clean sheets need a paid plan.
- Transfers aren't included. The Transfers page shows a notice in live mode.
- International football is limited to the World Cup and the European Championship, so there are no international matches between those tournaments. For Copa América, the Africa Cup of Nations, the Nations League, qualifiers and friendlies, use API-Football: set `API_FOOTBALL_KEY` and redeploy, and FootIQ switches to it automatically.

The provider asks for a credit, so the footer says "Data provided by football-data.org" in live mode. Keep it.

### News and rumours

News comes from [The Guardian Open Platform](https://open-platform.theguardian.com), which offers free developer keys:

1. Get a key at https://open-platform.theguardian.com/access/
2. Set `GUARDIAN_API_KEY` in `.env`

As with the football data, the key is added server-side by `/api/news` and never reaches the browser. The Guardian's terms require that stories are credited and link to the original article, so every story shows "The Guardian" and opens on their site. Keep that credit. Without a key, FootIQ shows demo news.

Transfer rumours on the Transfers page are Guardian stories about transfers. They are reports, not confirmed deals, and each one links to the original article. No licensed data feed covers rumours, so they come from news.

### Accounts

Accounts are stored on the server, so people can sign in with the same email and password on any device. Their favourite clubs, favourite players and Build XI team are saved to the account and follow them.

- **Staying signed in:** signing in sets a secure, HttpOnly session cookie that lasts 30 days and renews on every visit. People stay signed in until they sign out or don't visit for 30 days.
- **Passwords** are hashed with scrypt on the server and never stored as typed. Sessions are stored only as a SHA-256 of the cookie token.
- **Protection:** 10 failed sign-ins for an email within 15 minutes pause further attempts. Cross-site requests to the account API are refused.
- **Saving:** changes to favourites or the XI save to the account about half a second later. If saving fails, a red banner says so.

The account API is one route, `/api/account` (code in `server/accounts.ts`). It needs storage:

| Where | Storage |
| --- | --- |
| Vercel | Redis via **Upstash** (see [Deploying to Vercel](#deploying-to-vercel)) |
| `npm run dev` / `npm run preview` | A local file, `.footiq-dev-db.json` (git-ignored) |

If a Vercel deployment has no Redis connected, accounts can't be stored on the server. The login screen then says that accounts only work in this browser, and the app falls back to saving them in the browser. If someone used a browser-only account before, their favourites are copied into their server account the first time they sign in with the same email on that browser.

### Adding another data source

All data flows through the `DataProvider` interface in `src/data/types.ts`. To use a different licensed provider (for example, one that includes transfers or detailed stats), implement its methods (`listCompetitions`, `loadCompetition`, `loadMatches`, `loadTeam`, `searchTeams`, `loadTransfers`, optionally `loadPlayer`) to return FootIQ's own types, then select it in `src/data/index.ts`. Only use sources whose terms allow this; don't scrape websites.

### How the server side works

The browser never calls a data provider directly. It calls FootIQ's own server routes, which add the API keys from the server's environment:

| Route | Does |
| --- | --- |
| `/api/config` | Tells the browser which sources have keys (flags only, never the keys) and the refresh settings |
| `/api/football-data?path=…` | Forwards to football-data.org with `FOOTBALL_DATA_API_KEY` |
| `/api/api-football?path=…` | Forwards to API-Football with `API_FOOTBALL_KEY` |
| `/api/news?path=…` | Forwards to The Guardian with `GUARDIAN_API_KEY` |

The handlers live in `server/handlers.ts`. The files in `api/` expose them as Vercel serverless functions, and `vite.config.ts` serves the same handlers for `npm run dev` and `npm run preview`, so local development runs the production code.

- **Safety:** only `GET` requests to each provider's known endpoints are forwarded, so the keys can't be used for anything else. A key sent from the browser is ignored.
- **Caching:** successful responses are cached by the CDN for a short time (15 seconds for live scores, longer for tables and squads). Visitors share one upstream request instead of each using up your plan's rate limit.
- **Which data source:** the app asks `/api/config` at startup. Changing keys only needs a redeploy, not a code change. With no football key set, it runs in demo mode and says so in a banner.
- **Errors are shown, not hidden:** if live data fails (bad key, plan limit, provider down), the app shows a red banner and an error in each affected section, with the reason from the server. It never switches to demo data. If `/api/config` itself can't be reached, the app stops at an error screen explaining that the server functions aren't responding.

### Deploying to Vercel

1. Import the repository in Vercel. The Vite preset works as is: build command `npm run build`, output directory `dist`. The `api/` folder is deployed as serverless functions automatically.
2. In **Project → Settings → Environment Variables**, add `FOOTBALL_DATA_API_KEY` (and `GUARDIAN_API_KEY` for news). Tick the environments you deploy to, including **Production**.
3. For accounts, open **Project → Storage** (or the Vercel Marketplace), add **Upstash for Redis** and connect it to this project. Vercel adds its connection variables (`KV_REST_API_URL` and `KV_REST_API_TOKEN`) for you. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` work too, if you set up Upstash yourself.
4. **Redeploy.** Vercel only gives environment variables to deployments made after they were added.
5. Check it: open `https://<your-app>/api/config`. It should show `"dataSource":"football-data"` and `"accounts":"server"`. If `dataSource` is `"demo"` or `accounts` is `"device"`, the variables aren't reaching that deployment; check their names and environments, then redeploy.

Other hosts work too, as long as they run the handlers in `server/handlers.ts` at the same `/api/*` routes.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build (with the /api routes) |
| `npm test` | Run unit tests |
