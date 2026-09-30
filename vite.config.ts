import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { accountHandler } from './server/accounts.js';
import { configHandler, proxyHandler, type Env } from './server/handlers.js';
import { matchDetailsHandler } from './server/matchSources.js';

/**
 * Serves the same /api handlers that run as Vercel functions in production,
 * so `npm run dev` and `npm run preview` behave like the deployed app.
 */
function apiRoutes(env: Env): Plugin {
  const routes: Record<string, Connect.NextHandleFunction> = {
    '/api/config': configHandler(env),
    '/api/football-data': proxyHandler('football-data', env),
    '/api/api-football': proxyHandler('api-football', env),
    '/api/news': proxyHandler('news', env),
    '/api/account': accountHandler(env),
    '/api/match-details': matchDetailsHandler(env),
  };
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const path = (req.url ?? '').split('?')[0];
    const handler = routes[path];
    if (!handler) return next();
    Promise.resolve(handler(req, res, next)).catch(next);
  };
  return {
    name: 'footiq-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

export default defineConfig(({ mode }) => {
  // Keys from .env files and the shell; they stay in this server process.
  const env: Env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
  return {
    plugins: [react(), apiRoutes(env)],
  };
});
