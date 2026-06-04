/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // API-Pfade NICHT auf index.html zurückfallen lassen. Sonst fängt der
        // Service Worker echte Navigationen wie /api/auth/admin/login ab und
        // liefert die SPA aus dem Cache, statt sie ans Backend (302 → OIDC)
        // durchzulassen.
        navigateFallbackDenylist: [/^\/api\//],
      },
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
