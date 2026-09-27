// Vercel serverless function: forwards /api/football-data?path=... with the server-side key.
import { proxyHandler } from '../server/handlers.js';

export default proxyHandler('football-data');
