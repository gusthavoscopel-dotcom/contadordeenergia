import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, /api/* é repassado para o servidor local das funções
// (scripts/dev-api.js). Na Vercel, /api/* são as funções serverless.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: `http://localhost:${process.env.API_PORT || 3001}`, changeOrigin: false },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
