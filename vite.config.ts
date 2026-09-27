import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.FOOTBALL_DATA_API_KEY;

  return {
    plugins: [react()],
    define: {
      // Only a boolean reaches the client; the key itself stays in the proxy.
      __LIVE_DATA__: JSON.stringify(Boolean(apiKey)),
      // Optional comma-separated competition codes, e.g. "PL,PD,CL,WC".
      __COMPETITIONS__: JSON.stringify(env.FOOTBALL_DATA_COMPETITIONS ?? ''),
    },
    server: {
      proxy: apiKey
        ? {
            '/api': {
              target: 'https://api.football-data.org/v4',
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api/, ''),
              headers: { 'X-Auth-Token': apiKey },
            },
          }
        : undefined,
    },
  };
});
