// Vercel serverless function: forwards /api/api-football?path=... with the server-side key.
import { proxyHandler } from '../server/handlers.js';

export default proxyHandler('api-football');
