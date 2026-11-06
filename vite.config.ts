import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/** Production-only Content-Security-Policy: scripts only from this site, network only to this site + the account API. */
function csp(): Plugin {
  let apiUrl = '';
  return {
    name: 'lwd-csp',
    apply: 'build',
    configResolved(config) {
      // The API address may come from the environment or from .env.production (same sources Vite exposes to the app).
      apiUrl = process.env.VITE_LWD_API_URL || loadEnv(config.mode, config.envDir ?? process.cwd(), 'VITE_').VITE_LWD_API_URL || '';
    },
    transformIndexHtml(html) {
      let api = '';
      try { api = apiUrl ? new URL(apiUrl).origin : ''; } catch { api = ''; }
      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "media-src 'self' blob:",
        "font-src 'self' data:",
        `connect-src 'self'${api ? ` ${api}` : ''}`,
        "worker-src 'self'",
        "manifest-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join('; ');
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
    },
  };
}

// base './' makes the build work on any static host, including sub-paths
// such as GitHub Pages project sites.
export default defineConfig({
  base: './',
  plugins: [react(), csp()],
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as never);
