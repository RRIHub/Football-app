import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiFootballKey = env.API_FOOTBALL_KEY;
  const footballDataKey = env.FOOTBALL_DATA_API_KEY;
  const newsKey = env.GUARDIAN_API_KEY;

  const proxy: Record<string, object> = {};
  if (apiFootballKey)
    proxy['/af-api'] = {
      target: 'https://v3.football.api-sports.io',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/af-api/, ''),
      headers: { 'x-apisports-key': apiFootballKey },
    };
  if (footballDataKey)
    proxy['/api'] = {
      target: 'https://api.football-data.org/v4',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api/, ''),
      headers: { 'X-Auth-Token': footballDataKey },
    };
  if (newsKey)
    proxy['/news-api'] = {
      target: 'https://content.guardianapis.com',
      changeOrigin: true,
      // The Guardian takes its key as a query parameter; add it here so it never reaches the browser.
      rewrite: (path: string) => {
        const rest = path.replace(/^\/news-api/, '');
        return `${rest}${rest.includes('?') ? '&' : '?'}api-key=${encodeURIComponent(newsKey)}`;
      },
    };

  return {
    plugins: [react()],
    define: {
      // Only flags and settings reach the client; keys stay in the proxy.
      __DATA_SOURCE__: JSON.stringify(apiFootballKey ? 'api-football' : footballDataKey ? 'football-data' : 'demo'),
      __LIVE_NEWS__: JSON.stringify(Boolean(newsKey)),
      // Optional comma-separated football-data.org competition codes, e.g. "PL,PD,CL,WC".
      __COMPETITIONS__: JSON.stringify(env.FOOTBALL_DATA_COMPETITIONS ?? ''),
      __LIVE_REFRESH_SECONDS__: JSON.stringify(Number(env.LIVE_REFRESH_SECONDS) || 20),
      // Requests per minute your API-Football plan allows.
      __API_FOOTBALL_RATE__: JSON.stringify(Number(env.API_FOOTBALL_REQUESTS_PER_MINUTE) || 10),
    },
    server: { proxy },
    preview: { proxy },
  };
});
