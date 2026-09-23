import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import pkg from './package.json';

export default defineConfig({
  plugins: [react()],
  // Single source of truth for the displayed version — src/version.ts reads
  // this instead of carrying its own hand-bumped copy.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    // Off for release: Tauri embeds all of dist/ in the binary, and the map
    // was ~7 MB of it. Source is public on GitHub for anyone debugging.
    sourcemap: false,
  },
  clearScreen: false,
});
