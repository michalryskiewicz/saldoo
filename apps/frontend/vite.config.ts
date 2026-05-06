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

  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split heavy vendor libs into separate chunks. Reduces peak memory
        // during minification (the prod build was OOM-killed in Coolify CI),
        // and helps browser caching since these libs change rarely.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('react-day-picker') || id.includes('date-fns')) return 'vendor-dates';
          if (id.includes('dexie')) return 'vendor-db';
          if (id.includes('@reduxjs') || id.includes('react-redux')) return 'vendor-redux';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('i18next') || id.includes('react-i18next')) return 'vendor-i18n';
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod'))
            return 'vendor-forms';
          if (id.includes('papaparse') || id.includes('lodash')) return 'vendor-utils';

          if (id.includes('react-dom') || /node_modules\/react\//.test(id)) return 'vendor-react';

          return 'vendor';
        },
      },
    },
  },

  server: { port: PORT, host: true },
  preview: { port: PORT, host: true, allowedHosts: ['app.saldoo.io'] },
});
