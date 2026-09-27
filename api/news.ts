// Vercel serverless function: forwards /api/news?path=... with the server-side key.
import { proxyHandler } from '../server/handlers.js';

export default proxyHandler('news');
