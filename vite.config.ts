/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Drohnen-Trainingsbegleiter',
        short_name: 'Drohnen-Training',
        description: 'Praxisleitfaden Drohnensteuerer BOS – Trainingsbegleiter',
        theme_color: '#e30613',
        background_color: '#ffffff',
        lang: 'de',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    // Fester Dev-Port, damit der OIDC-Redirect (PUBLIC/REDIRECT auf :5174) passt.
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
  },
});
