import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Browser-level tests, which is the only place several things this app relies on can
 * be observed at all: the IndexedDB upgrade path, whether a CSP allowlist is complete,
 * whether the vault re-locks, and whether two devices sharing one Drive folder
 * converge.
 *
 * Google and Drive are stubbed at the **network boundary** rather than bypassed in
 * app code, so the real gateway still runs — a test that swapped it out would prove
 * nothing about what ships.
 */
export default defineConfig({
  testDir: './e2e',
  // `.e2e.ts` rather than the default `.spec`/`.test`, so a browser test is never
  // picked up by the unit runner and vice versa -- they need different environments.
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Cross-device tests keep several contexts on one shared fake Drive, so a stray
    // permission prompt would hang them rather than fail them.
    permissions: [],
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // Its own port, so a dev server already running on 5173 is neither killed nor
    // silently reused with different state.
    command: `bun run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
