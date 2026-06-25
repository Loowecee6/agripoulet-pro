import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          strategies: 'generateSW',
          filename: 'sw-v2.js',
          includeAssets: ['favicon.svg'],
          manifest: {
            name: 'AgriPoulet Pro',
            short_name: 'AgriPoulet',
            description: 'Application de gestion avicole - AgriPoulet Pro',
            theme_color: '#ea580c',
            background_color: '#fff7ed',
            display: 'standalone',
            orientation: 'portrait',
            scope: '/',
            start_url: '/',
            icons: [
              {
                src: '/pwa-192x192.svg',
                sizes: '192x192',
                type: 'image/svg+xml',
              },
              {
                src: '/pwa-512x512.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
              },
              {
                src: '/pwa-512x512.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,ico,png,svg,webp}'],
            navigateFallback: '/index.html',
            navigateFallbackDenylist: [/\/__\/auth/],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
                handler: 'NetworkOnly',
              },
              {
                urlPattern: /^https:\/\/firebaseinstallations\.googleapis\.com\/.*/i,
                handler: 'NetworkOnly',
              },
              {
                urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'tailwind-cdn',
                  expiration: {
                    maxEntries: 5,
                    maxAgeSeconds: 60 * 60 * 24 * 365,
                  },
                },
              },
            ],
          },
        }),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
