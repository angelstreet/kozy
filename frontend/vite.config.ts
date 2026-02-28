import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon-192.png', 'pwa-icon-512.png'],
      manifest: {
        name: 'Kozy - Property Management',
        short_name: 'Kozy',
        description: 'Property management dashboard',
        theme_color: '#10B981',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/kozy/',
        scope: '/kozy/',
        icons: [
          { src: 'pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } }
          }
        ]
      }
    })
  ],
  build: {
    target: 'esnext',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  base: process.env.VITE_BASE_PATH || '/kozy/',
  server: {
    port: 3002,
    host: true,
    allowedHosts: ['kozy.angelstreet.io', 'localhost', '65.108.14.251'],
    proxy: {
      '/kozy/api': { target: 'http://localhost:5002', rewrite: (p) => p.replace(/^\/kozy\/api/, '/api') },
    },
  },
});
