import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
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
