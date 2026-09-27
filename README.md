# FootIQ

Football scores, player stats and a build-your-own-team game for leagues in England, across Europe and beyond, plus the Champions League and international football. Follow your favourite clubs, national teams and players.

## Features

- **My FootIQ**: a personal feed with live matches, today's games, your teams' last result and next fixture in any competition, your players' stats, and transfer news involving them.
- **Scores**: pick a day, then see matches grouped by competition. Filter by live games, "my teams" or a single competition. Live scores refresh automatically (every 20 seconds by default).
- **News**: the latest football news, or only stories about the teams you follow. News also appears in your feed and on team pages.
- **Leagues**: browse domestic leagues, cups, European club competitions and international tournaments. Each has a table (group tables for tournaments, knockout rounds for cups), matches by round, top scorers and assists, and a list of teams.
- **Teams**: club and national team pages show the team's league, every competition it plays in, its league position and form, and results and fixtures labelled by competition. They also show the squad and transfers.
- **Players**: a searchable, sortable stats table for any league, filterable by position and club. Player pages show which league the stats come from.
- **Build XI**: pick 11 players from any league in one of six formations within an £85m budget (max 3 per club). Choose a captain for double points and see your season points.
- **Transfers**: signings, loans, free transfers and rumours, filterable by league and by the teams and players you follow.
- Follows and your XI are saved in the browser (localStorage).

## Getting started

```bash
npm install
npm run dev
```

Without an API key the app runs in **demo mode**, with generated fixtures and fictional players so you can try every feature. Demo mode includes the Premier League, La Liga, Bundesliga, Serie A, Ligue 1, the EFL Cup, the Champions League and the Nations League. Demo players are fictional, and the demo news is written from demo results. Real players, scores and news need the API keys below.

### Live data

FootIQ gets live data from [football-data.org](https://www.football-data.org), a licensed football data API with a free tier:

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

### News

News comes from [The Guardian Open Platform](https://open-platform.theguardian.com), which offers free developer keys:

1. Get a key at https://open-platform.theguardian.com/access/
2. Set `GUARDIAN_API_KEY` in `.env`

As with the football data, the key is added by the proxy and never reaches the browser. The Guardian's terms require that stories are credited and link to the original article, so every story shows "The Guardian" and opens on their site. Keep that credit. Without a key, FootIQ shows demo news.

### Adding another data source

All data flows through the `DataProvider` interface in `src/data/types.ts`. To use a different licensed provider (for example, one that includes transfers or detailed stats), implement its methods (`loadCompetition`, `loadMatches`, `loadTeam`, `loadTransfers`) to return FootIQ's own types, then select it in `src/data/index.ts`. Only use sources whose terms allow this; don't scrape websites.

### Deploying

`npm run build` produces a static site in `dist/`. In live mode, production hosting also needs something to play the proxy's role, e.g. a small serverless function that:
- forwards `/api/*` to `https://api.football-data.org/v4` with the `X-Auth-Token` header, and
- forwards `/news-api/*` to `https://content.guardianapis.com` with an `api-key` query parameter.

Have that function cache responses for a few seconds. Then every visitor shares the same requests instead of each one using up your plan's rate limit.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build (proxy included) |
| `npm test` | Run unit tests |
