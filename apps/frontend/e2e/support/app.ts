import { expect, type Locator, type Page } from '@playwright/test';
import pl from '../../src/locales/pl.json' with { type: 'json' };

/**
 * The app driven the way a person drives it.
 *
 * Every label comes from the same translation file the app renders, so a copy change
 * moves the selectors with it instead of quietly reddening the suite — and a selector
 * that stops resolving means the label really is gone.
 */

type Dictionary = Record<string, unknown>;

function label(path: string): string {
  const found = path
    .split('.')
    .reduce<unknown>((node, key) => (node as Dictionary)?.[key], pl as Dictionary);

  if (typeof found !== 'string') throw new Error(`No translation for ${path}`);

  return found;
}

/** Long enough to cover the outbox's 2s debounce plus the upload itself. */
const SYNC_TIMEOUT_MS = 15_000;

const EXPENSES_PATH = '/dashboard/expenses';
const ACCOUNT_PATH = '/dashboard/account';

export class SaldooApp {
  constructor(readonly page: Page) {}

  async open(path = EXPENSES_PATH): Promise<void> {
    await this.page.goto(path);
  }

  /** Onboarding lands on the overview, so the expenses page is never where it left off. */
  async openExpenses(): Promise<void> {
    if (new URL(this.page.url()).pathname !== EXPENSES_PATH) await this.open(EXPENSES_PATH);

    await expect(this.page.getByRole('button', { name: label('create_expense') })).toBeVisible();
  }

  // === Vault ===

  private get passphraseInput(): Locator {
    return this.page.locator('#vault-passphrase');
  }

  private get unlockInput(): Locator {
    return this.page.locator('#vault-secret');
  }

  async expectAsksForPassphrase(): Promise<void> {
    await expect(this.unlockInput).toBeVisible();
  }

  async createVault(passphrase: string): Promise<void> {
    await this.passphraseInput.fill(passphrase);
    await this.page.locator('#vault-passphrase-confirm').fill(passphrase);
    await this.page.getByRole('button', { name: label('vault.create_button') }).click();

    // The recovery code is the only copy that will ever exist, so the app refuses to
    // move on until it has been acknowledged.
    await this.page.locator('#recovery-code-saved').click();
    await this.page.getByRole('button', { name: label('vault.recovery_continue') }).click();
  }

  async unlock(passphrase: string): Promise<void> {
    await this.unlockInput.fill(passphrase);
    await this.page.getByRole('button', { name: label('vault.unlock_button'), exact: true }).click();
  }

  // === Onboarding ===

  private next(): Locator {
    return this.page.getByRole('button', { name: label('metrics.next'), exact: true });
  }

  /**
   * Walks the wizard once, taking its defaults where it offers them. Tags arrive
   * pre-filled, which is what makes an expense creatable at all — the form's category
   * field has nothing to choose from otherwise.
   */
  async completeOnboarding(): Promise<void> {
    await this.page.getByRole('button', { name: label('metrics.lets_begin') }).click();
    await this.next().click();

    await this.page.getByRole('radio', { name: 'PLN' }).click();
    await this.next().click();

    await this.page.getByRole('radio', { name: '50-30-20' }).click();
    await this.next().click();

    await this.next().click();
    await this.page.getByRole('button', { name: label('metrics.end') }).click();

    // Submitting writes the tags and the settings and *then* navigates, so the wizard going
    // away is not the end of it: leaving before that navigation lands means the app steers
    // the next page away underneath the test.
    await expect(this.page.getByRole('tablist')).toBeHidden({ timeout: SYNC_TIMEOUT_MS });
    await this.page.waitForURL('**/dashboard');
  }

  /** Setup, or unlock, or nothing — whichever this device's state calls for. */
  async signInAndOpenVault(passphrase: string): Promise<void> {
    const setup = this.passphraseInput;
    const unlock = this.unlockInput;

    await expect(setup.or(unlock).first()).toBeVisible({ timeout: SYNC_TIMEOUT_MS });

    if (await setup.isVisible()) await this.createVault(passphrase);
    else await this.unlock(passphrase);
  }

  async addExpense({ description, amount }: { description: string; amount: number }): Promise<void> {
    await this.openExpenses();
    await this.page.getByRole('button', { name: label('create_expense') }).click();

    const sheet = this.page.getByRole('dialog');
    await expect(sheet).toBeVisible();

    // Exact throughout: 'Kategoria' is also a prefix of 'Kategoria Strategii Budżetu'.
    await sheet.getByLabel(label('description'), { exact: true }).fill(description);
    await sheet.getByLabel(label('expense'), { exact: true }).fill(String(amount));

    await sheet.getByLabel(label('execution'), { exact: true }).click();
    await this.page.getByRole('gridcell').filter({ hasText: /^15$/ }).first().click();

    await sheet.getByLabel(label('forms.category'), { exact: true }).click();
    await this.page.getByRole('option').first().click();

    await sheet.getByLabel(label('forms.strategy-part'), { exact: true }).click();
    await this.page.getByRole('option').first().click();

    await sheet.getByRole('button', { name: label('submit'), exact: true }).click();
    await expect(sheet).toBeHidden();
  }

  // === Account settings ===

  async openAccount(): Promise<void> {
    if (new URL(this.page.url()).pathname !== ACCOUNT_PATH) await this.open(ACCOUNT_PATH);

    await expect(this.page.getByRole('radio', { name: 'PLN', exact: true })).toBeVisible({
      timeout: SYNC_TIMEOUT_MS,
    });
  }

  private radio(name: string): Locator {
    return this.page.getByRole('radio', { name, exact: true });
  }

  async chooseStrategy(strategy: string): Promise<void> {
    await this.radio(strategy).click();
  }

  async chooseCurrency(currency: string): Promise<void> {
    await this.radio(currency).click();
  }

  async submitAccountSettings(): Promise<void> {
    await this.page.getByRole('button', { name: label('submit'), exact: true }).click();
  }

  /**
   * The saved notice.
   *
   * Asserted separately from submitting, and before anything waits on the sync: sonner
   * dismisses it on its own, so a helper that waited first would be checking whether the
   * toast was slow rather than whether it appeared.
   */
  async expectSavedNotice(): Promise<void> {
    await expect(this.page.getByText(label('success.update-account-settings'))).toBeVisible();
  }

  async expectStrategy(strategy: string): Promise<void> {
    await expect(this.radio(strategy)).toBeChecked();
  }

  async expectCurrency(currency: string): Promise<void> {
    await expect(this.radio(currency)).toBeChecked();
  }

  // === Sync ===

  private get syncStatus(): Locator {
    return this.page.getByRole('status');
  }

  /**
   * Waits for the app's own indicator to say everything has left the device.
   *
   * The alternative — sleeping past the outbox's debounce — would encode a timing
   * assumption the app is free to change. This reads the same signal the user reads.
   */
  async waitUntilSynced(): Promise<void> {
    await expect(this.syncStatus).toHaveText(label('sync.synced'), { timeout: SYNC_TIMEOUT_MS });
  }

  /**
   * A change is saved locally and still owed to Drive.
   *
   * Deliberately not the `sync.offline` label: the outbox outranks the connection status
   * in the indicator, because a write the user just made and that has not left the device
   * matters more to them than how the last sync went.
   */
  async expectChangesPending(): Promise<void> {
    await expect(this.syncStatus).toHaveText(label('sync.pending'), { timeout: SYNC_TIMEOUT_MS });
  }

  async expectNoSyncFailure(): Promise<void> {
    const status = await this.syncStatus.textContent();

    expect([label('sync.upload_failed'), label('sync.blocked'), label('sync.unreadable_backup')]).not.toContain(status);
  }

  // === Expenses ===

  private expenseRow(description: string): Locator {
    return this.page.getByRole('row').filter({ hasText: description });
  }

  async removeExpense(description: string): Promise<void> {
    await this.openExpenses();
    await this.expenseRow(description).getByRole('button', { name: label('remove') }).click();
    await expect(this.expenseRow(description)).toHaveCount(0);
  }

  /** Waits for each row rather than reading once: a sync lands asynchronously. */
  async expectExpenses(descriptions: string[]): Promise<void> {
    for (const description of descriptions) {
      await expect(this.expenseRow(description)).toHaveCount(1, { timeout: SYNC_TIMEOUT_MS });
    }
  }

  async expectNoExpense(description: string): Promise<void> {
    await expect(this.expenseRow(description)).toHaveCount(0, { timeout: SYNC_TIMEOUT_MS });
  }

  /**
   * A sync runs when the app mounts, so reopening is how a device is asked to catch up —
   * and it doubles as proof the local write survived the reload.
   */
  async reopen(): Promise<void> {
    await this.page.reload();
    await this.openExpenses();
  }
}
