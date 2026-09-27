import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.FOOTBALL_DATA_API_KEY;
  const newsKey = env.GUARDIAN_API_KEY;

  const proxy: Record<string, object> = {};
  if (apiKey)
    proxy['/api'] = {
      target: 'https://api.football-data.org/v4',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api/, ''),
      headers: { 'X-Auth-Token': apiKey },
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
      // Only flags reach the client; keys stay in the proxy.
      __LIVE_DATA__: JSON.stringify(Boolean(apiKey)),
      __LIVE_NEWS__: JSON.stringify(Boolean(newsKey)),
      // Optional comma-separated competition codes, e.g. "PL,PD,CL,WC".
      __COMPETITIONS__: JSON.stringify(env.FOOTBALL_DATA_COMPETITIONS ?? ''),
      __LIVE_REFRESH_SECONDS__: JSON.stringify(Number(env.LIVE_REFRESH_SECONDS) || 20),
    },
    server: { proxy },
    preview: { proxy },
  };
});
