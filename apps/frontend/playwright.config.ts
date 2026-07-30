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
  // The html report is what CI uploads on failure; without it the artifact is empty and
  // a red run can only be read from the log.
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Cross-device tests keep several contexts on one shared fake Drive, so a stray
    // permission prompt would hang them rather than fail them.
    permissions: [],
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // A production build served by `preview`, not the dev server. The dev server injects
    // an inline React-refresh script that the shipped Content-Security-Policy forbids, so
    // CSP could never be asserted against it — and the bundle under test would not be the
    // bundle that ships. The cost is real and worth naming: a source change needs a
    // rebuild before a test sees it.
    //
    // Its own port, so a dev server already running on 5173 is neither killed nor
    // silently reused with different state.
    command: `bun run build && bun run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,

    // Fixed, so a developer's own Google client and backend can never leak into a run.
    // Google is stubbed at the network boundary, so the client id only has to exist.
    env: {
      VITE_GOOGLE_CLIENT: 'e2e-google-client-id',
      // Same origin: the rates endpoint is stubbed per context, and an absolute URL
      // would need its own entry in the Content-Security-Policy.
      VITE_SERVER_URL: '',
      // Pinned, or a developer's own `.env` decides where the fake Drive folder is and
      // the tests assert against a name that only exists on that machine.
      VITE_GA_DRIVE_DIRECTORY: 'saldoo',
      VITE_GA_DRIVE_FILE: 'saldoo-data.json',
      // Umami loads into the same origin as the vault. No test ever wants it.
      VITE_UMAMI_WEBSITE_ID: '',
      VITE_UMAMI_SRC: '',
    },
  },
});
