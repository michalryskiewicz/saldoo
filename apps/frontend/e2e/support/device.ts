import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { FakeDrive } from './fake-drive.ts';
import { installGoogleStub } from './google-stub.ts';
import { serveWithShippedCsp } from './csp.ts';

/**
 * One device: its own browser context — so its own IndexedDB, sessionStorage and
 * `navigator.onLine` — pointed at a Drive folder it may or may not share with another.
 *
 * Two of these over one {@link FakeDrive} is what the epic's headline behaviour needs
 * to be observable at all.
 */
export type Device = {
  page: Page;
  context: BrowserContext;
  /**
   * Cuts this device off, both signals at once: `navigator.onLine` flips (which the app
   * reads) and Google requests fail the way a dead network fails. Neither alone is
   * enough — an intercepted request never reaches the network stack, so
   * `setOffline` on its own leaves the stub happily answering.
   */
  setOffline(offline: boolean): Promise<void>;
  /** Every console error and uncaught exception seen so far, in order. */
  problems(): string[];
  close(): Promise<void>;
};

export type OpenDeviceOptions = {
  drive: FakeDrive;
  baseURL: string;
  /** Starts cut off, for the case where the app's very first load has no network. */
  offline?: boolean;
  /**
   * Puts the page's clock under the test's control, then lets it run normally.
   *
   * Installed before the first navigation, which is the only point that matters: code
   * capturing `Date.now` as a reference — the idle lock does — holds the real one
   * forever if the clock arrives later, and no amount of moving it afterwards is seen.
   */
  controlledClock?: boolean;
};

/**
 * Noise from outside the app's control, which would otherwise make the
 * console-is-clean assertion useless.
 *
 * Kept deliberately short: every entry here is a thing this suite stops checking.
 */
const IGNORED_PROBLEMS = [
  // A deliberately aborted request is how this harness models a dead network; the
  // browser logs the failure regardless of the app handling it correctly.
  /net::ERR_INTERNET_DISCONNECTED/,
  /Failed to load resource/,
];

export async function openDevice(
  browser: Browser,
  { drive, baseURL, offline = false, controlledClock = false }: OpenDeviceOptions
): Promise<Device> {
  let isOffline = offline;
  const problems: string[] = [];

  const context = await browser.newContext({ baseURL });

  if (controlledClock) {
    await context.clock.install();
    // Ticking again straight away: a paused clock would stall the animations Radix waits
    // on, and every dialog in the app would stay half-open.
    await context.clock.resume();
  }

  await serveWithShippedCsp(context, new URL(baseURL).origin);
  await installGoogleStub(context, drive, { isOffline: () => isOffline });

  const page = await context.newPage();

  const note = (message: string) => {
    if (IGNORED_PROBLEMS.some((pattern) => pattern.test(message))) return;

    problems.push(message);
  };

  page.on('console', (message) => {
    if (message.type() === 'error') note(message.text());
  });
  page.on('pageerror', (error) => note(error.message));

  await context.setOffline(offline);

  return {
    page,
    context,

    async setOffline(next) {
      isOffline = next;
      await context.setOffline(next);
    },

    problems: () => [...problems],

    close: () => context.close(),
  };
}
