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
    // jsdom ships no IndexedDB, and everything from the vault keyfile cache to the
    // Yjs document store needs one. Without this each such test has to import the
    // shim itself, and forgetting to leaves a silent gap rather than a failure.
    setupFiles: ['fake-indexeddb/auto'],
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
        //
        // IMPORTANT: every named chunk must contain its full transitive dep
        // tree (e.g. Radix needs @floating-ui, aria-hidden, react-remove-scroll
        // family). Otherwise the catch-all `vendor` ↔ named-chunk cycle causes
        // TDZ errors at runtime ("Cannot access 'X' before initialization").
        // Returning undefined for unmatched modules lets Rollup auto-split
        // instead of forcing a catch-all bucket.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor'))
            return 'vendor-charts';
          if (id.includes('react-day-picker') || id.includes('date-fns')) return 'vendor-dates';
          if (id.includes('dexie')) return 'vendor-db';
          if (id.includes('@reduxjs') || id.includes('react-redux') || id.includes('/redux/'))
            return 'vendor-redux';

          // Radix + its full ecosystem of transitive deps. cmdk is built on
          // Radix primitives so it must live in the same chunk to avoid
          // cross-chunk circular imports.
          if (
            id.includes('@radix-ui') ||
            id.includes('@floating-ui') ||
            id.includes('aria-hidden') ||
            id.includes('react-remove-scroll') ||
            id.includes('react-style-singleton') ||
            id.includes('use-callback-ref') ||
            id.includes('use-sidecar') ||
            id.includes('detect-node-es') ||
            id.includes('get-nonce') ||
            id.includes('cmdk')
          )
            return 'vendor-radix';

          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('i18next')) return 'vendor-i18n';
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('/zod/'))
            return 'vendor-forms';
          if (id.includes('papaparse') || id.includes('lodash')) return 'vendor-utils';

          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';

          // Let Rollup auto-split everything else. A manual catch-all `vendor`
          // bucket is what caused the original TDZ bug.
          return undefined;
        },
      },
    },
  },

  server: { port: PORT, host: true },
  preview: { port: PORT, host: true, allowedHosts: ['app.saldoo.io'] },
});
