import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const serverPort = process.env.PLATFORM_PORT || '3001';
const target = `http://localhost:${serverPort}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve the workspace types package to source so Vite transpiles it.
      '@vibe/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target, changeOrigin: true },
      '/run': { target, changeOrigin: true, ws: true },
      '/sites': { target, changeOrigin: true, ws: true },
      '/healthz': { target, changeOrigin: true },
    },
  },
});
