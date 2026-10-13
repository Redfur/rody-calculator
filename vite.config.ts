import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { serviceWorker } from './sw-plugin';

// base: './' — все пути относительные, сайт работает и в подпапке GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  build: {
    assetsInlineLimit: 0,
  },
});
