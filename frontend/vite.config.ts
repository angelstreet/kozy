import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      devOptions: { enabled: false },
      manifest: {
        name: 'Kozy',
        short_name: 'Kozy',
        theme_color: '#3B82F6',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  base: '/kozy/',
  server: {
    port: 5174,
    proxy: {
      '/kozy/api': { target: 'http://localhost:3002', rewrite: (p) => p.replace(/^\/kozy\/api/, '/api') },
    },
  },
});
