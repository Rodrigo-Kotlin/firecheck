import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  // Em produção (GitHub Pages) o app é servido em /firecheck/.
  // Em desenvolvimento usamos '/' para evitar paths absolutos quebrados.
  base: process.env.GITHUB_PAGES ? '/firecheck/' : '/',
  plugins: [react(), cloudflare()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});