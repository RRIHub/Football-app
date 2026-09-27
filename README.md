# FootIQ

Football scores, player stats and a build-your-own-team game, with the ability to follow your favourite clubs and players.

## Features

- **My FootIQ**: a personal feed with live matches, your teams' last result and next fixture, your players' stats, and transfer news involving them.
- **Scores**: live, results, fixtures and "my teams" filters, plus the league table.
- **Players**: a searchable, sortable stats table (goals, assists, appearances, price) with position and club filters.
- **Teams**: club pages with record, form guide, results, fixtures, squad and transfers.
- **Build XI**: pick 11 players in any of six formations within an £85m budget (max 3 per club), choose a captain for double points, and see your season points.
- **Transfers**: signings, loans, free transfers and rumours, with a "only teams & players I follow" filter.
- Follows and your XI are saved in the browser (localStorage).

## Getting started

```bash
npm install
npm run dev
```

Without an API key the app runs in **demo mode**, with generated fixtures and fictional players so you can try every feature.

### Live data

FootIQ gets live data from [football-data.org](https://www.football-data.org), a licensed football data API with a free tier:

1. Register for a free key at https://www.football-data.org/client/register
2. `cp .env.example .env` and set `FOOTBALL_DATA_API_KEY`
3. `npm run dev`

The key stays server-side. Vite proxies `/api/*` to football-data.org and adds the key there, so it never reaches the browser. The free tier allows 10 requests/minute. FootIQ makes 4 on load, then polls fixtures once a minute while a match is live.

Free-tier limitations:
- Stats cover goals, assists and appearances (from the top-scorers list). Minutes, cards and clean sheets need a paid plan.
- Transfers aren't included. The Transfers page shows a notice in live mode.

The provider asks for a credit, so the footer says "Data provided by football-data.org" in live mode. Keep it.

### Adding another data source

All data flows through the `DataProvider` interface in `src/data/types.ts`. To use a different licensed provider (for example, one that includes transfers or detailed stats), implement `load()` and `loadMatches()` to return FootIQ's own types, then select it in `src/data/index.ts`. Only use sources whose terms allow this; don't scrape websites.

### Deploying

`npm run build` produces a static site in `dist/`. In live mode, production hosting also needs something to play the proxy's role, e.g. a small serverless function that forwards `/api/*` to `https://api.football-data.org/v4` and adds the `X-Auth-Token` header.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build (proxy included) |
| `npm test` | Run unit tests |
