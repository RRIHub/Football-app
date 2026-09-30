// Vercel serverless function: extra match details (goals, assists, cards,
// subs, line-ups, stats) from Sportmonks, OpenLigaDB and StatsBomb Open Data.
import { matchDetailsHandler } from '../server/matchSources.js';

export default matchDetailsHandler();
