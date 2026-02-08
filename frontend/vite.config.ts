import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  base: process.env.VITE_BASE_PATH || '/kozy/',
  server: {
    port: 5174,
    proxy: {
      '/kozy/api': { target: 'http://localhost:3002', rewrite: (p) => p.replace(/^\/kozy\/api/, '/api') },
    },
  },
});
