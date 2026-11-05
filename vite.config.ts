import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes the build work on any static host, including sub-paths
// such as GitHub Pages project sites.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as never);
