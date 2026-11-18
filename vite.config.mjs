import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createApi } from './server/api.mjs';
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ndx-profile-api',
      configureServer(server) {
        const api = createApi();
        server.middlewares.use(api);
        server.httpServer?.on('close', () => api.close());
      },
      configurePreviewServer(server) {
        server.middlewares.use(createApi());
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    fs: {
      deny: [
        '.env',
        '.env.*',
        '**/.git/**',
        '**/.data/**',
        '**/.local/**',
        '**/*.sqlite*',
        '**/owner-bootstrap.txt',
        '**/server/**',
      ],
    },
  },
  preview: { host: '0.0.0.0', allowedHosts: true },
  build: { chunkSizeWarningLimit: 2500 },
  optimizeDeps: { include: ['three', '@dimforge/rapier3d-compat'] },
});
