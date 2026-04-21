import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

const ReactCompilerConfig = {};

const PORT = 5173;

// https://vite.dev/config/
export default defineConfig({
  // Load .env from monorepo root instead of apps/frontend/
  envDir: path.resolve(__dirname, '../..'),
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', ReactCompilerConfig]],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: { port: PORT, host: true },
  preview: { port: PORT, host: true, allowedHosts: ['app.saldoo.io'] },
});
