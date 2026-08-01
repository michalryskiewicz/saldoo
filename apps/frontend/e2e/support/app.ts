import { expect, type Locator, type Page } from '@playwright/test';
import pl from '../../src/locales/pl.json' with { type: 'json' };
import en from '../../src/locales/en.json' with { type: 'json' };

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
const DUTIES_PATH = '/dashboard/duties';

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

  /**
   * Opens a select by its label and picks one option by name.
   *
   * The listbox is portalled to the body rather than nested in the sheet, so the option is
   * looked up on the page while the trigger is looked up inside the form.
   */
  private async chooseOption(form: Locator, fieldLabel: string, option: string): Promise<void> {
    await form.getByLabel(fieldLabel, { exact: true }).click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
  }

  /** The create drawer, addressed by its title: the date picker's popover is a `dialog` too. */
  private get createDrawer(): Locator {
    return this.page.getByRole('dialog', { name: label('create_expense_title') });
  }

  async addExpense({
    description,
    amount,
    severity,
    frequency,
  }: {
    description: string;
    amount: number;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH';
    frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  }): Promise<void> {
    await this.openExpenses();
    await this.page.getByRole('button', { name: label('create_expense') }).click();

    const sheet = this.createDrawer;
    await expect(sheet).toBeVisible();

    // Exact throughout: 'Kategoria' is also a prefix of 'Kategoria Strategii Budżetu'.
    await sheet.getByLabel(label('description'), { exact: true }).fill(description);
    await sheet.getByLabel(label('expense'), { exact: true }).fill(String(amount));

    // Left at the form's own defaults unless asked for, so the tests that do not care about
    // either keep the shortest path through the form.
    //
    // Priority is a segmented control rather than a select, so it is clicked directly: three
    // buttons, all of them already on screen, and no list to open first.
    if (severity) await sheet.getByRole('radio', { name: label(severity), exact: true }).click();
    if (frequency) await this.chooseOption(sheet, label('frequency'), label(frequency));

    await sheet.getByLabel(label('execution'), { exact: true }).click();
    await this.page.getByRole('gridcell').filter({ hasText: /^15$/ }).first().click();

    await sheet.getByLabel(label('forms.category'), { exact: true }).click();
    await this.page.getByRole('option').first().click();

    // The strategy part is left alone: it is a segmented control now, and it arrives with the
    // first part its strategy offers already selected. Clicking through it would be testing the
    // harness's ability to click rather than anything about the form.

    await sheet.getByRole('button', { name: label('submit'), exact: true }).click();
    await expect(sheet).toBeHidden();
  }

  /**
   * Opens the create drawer and leaves it open, for looking at rather than filling in.
   *
   * It waits for the drawer to stop moving, not merely to exist. Radix slides it in with a
   * transform, and "visible" is true from the first frame — a screenshot taken then catches it
   * still off the edge of the screen, which is how the first form shots came back showing only the
   * page behind it.
   */
  async openCreateForm(): Promise<void> {
    await this.openExpenses();
    await this.page.getByRole('button', { name: label('create_expense') }).click();

    const drawer = this.createDrawer;
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: label('submit') })).toBeVisible();

    // Polled until the position stops changing, rather than waited out with a guessed number: the
    // sheet animates over 500ms and "visible" is true from the first frame, so a shot taken on the
    // strength of visibility alone catches it still half off the edge.
    let previous = -1;
    await expect
      .poll(
        async () => {
          const x = (await drawer.boundingBox())?.x ?? -1;
          const settled = x >= 0 && x === previous;
          previous = x;
          return settled;
        },
        { timeout: 5_000, intervals: [100] }
      )
      .toBe(true);
  }

  async closeCreateForm(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.createDrawer).toBeHidden();
  }

  // === Appearance ===

  /** Picks a theme through the header control, the way a person does. */
  async chooseTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await this.page.getByRole('button', { name: label('theme.choose') }).click();
    await this.page.getByRole('menuitem', { name: label(`theme.${theme}`) }).click();

    // The provider writes the class onto <html>, and everything downstream keys off it.
    if (theme !== 'system') {
      await expect(this.page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`));
    }
  }

  /**
   * Picks a language through the header control.
   *
   * The trigger is matched in either language, because this is the one control whose own label has
   * already changed by the time you want to use it again — reaching for the Polish label to switch
   * back from English finds nothing.
   *
   * The options are the exception to reading every label from the translations: a language names
   * itself, so "Polski" and "English" are the same words in both files.
   */
  async chooseLanguage(language: 'pl' | 'en'): Promise<void> {
    const trigger = this.page.getByRole('button', { name: pl.language.choose });

    await trigger.or(this.page.getByRole('button', { name: en.language.choose })).first().click();
    await this.page
      .getByRole('menuitem', { name: language === 'pl' ? pl.language.pl : pl.language.en })
      .click();
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
    // `aria-label`, because the control is icon-only: the Drive mark says what it is synced with
    // and colour says how it went, so there is no visible text to assert on.
    await expect(this.syncStatus).toHaveAttribute('aria-label', label('sync.synced'), {
      timeout: SYNC_TIMEOUT_MS,
    });
  }

  /**
   * Leaves the tab, the way switching away from the app does.
   *
   * `visibilityState` is the browser's to set and Playwright cannot, so it is overridden
   * before the event is dispatched. Everything downstream is the app's own code: the
   * listener, the flush, the upload. This is also how a test avoids sitting out the upload
   * debounce without pretending the debounce is shorter than it ships.
   */
  async leaveTab(): Promise<void> {
    await this.page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  async returnToTab(): Promise<void> {
    await this.page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  /** Leave, let the flush land, come back — what a person does between two devices. */
  async publishNow(): Promise<void> {
    await this.leaveTab();
    await this.waitUntilSynced();
    await this.returnToTab();
  }

  /**
   * A change is saved locally and still owed to Drive.
   *
   * Deliberately not the `sync.offline` label: the outbox outranks the connection status
   * in the indicator, because a write the user just made and that has not left the device
   * matters more to them than how the last sync went.
   */
  async expectChangesPending(): Promise<void> {
    await expect(this.syncStatus).toHaveAttribute('aria-label', label('sync.pending'), {
      timeout: SYNC_TIMEOUT_MS,
    });
  }

  async expectNoSyncFailure(): Promise<void> {
    const status = await this.syncStatus.getAttribute('aria-label');

    expect([label('sync.upload_failed'), label('sync.blocked'), label('sync.unreadable_backup')]).not.toContain(status);
  }

  // === Expenses ===

  /**
   * Clicks a column heading to sort by it.
   *
   * Scoped to `thead`: unscoped, "Wydatek" also matches the page's "Dodaj wydatek" button, which
   * opens the create drawer and silently leaves the table unsorted underneath it.
   */
  async sortBy(header: 'description' | 'severity'): Promise<void> {
    await this.page
      .locator('thead')
      .getByRole('button', { name: label(header === 'description' ? 'description' : 'severity') })
      .click();
  }

  /**
   * The summary's own label, read from the footer it now belongs to.
   *
   * `textContent`, not `innerText`: the latter returns what the styling made of the text, so a
   * heading-cased label came back as "CAŁKOWITA" and the assertion failed over a `text-transform`.
   * What this test is about is which element the summary is in, not how it is cased.
   */
  async footerLabel(): Promise<string> {
    return (await this.page.locator('tfoot tr td').first().textContent())?.trim() ?? '';
  }

  // === Search ===

  async searchFor(query: string): Promise<void> {
    await this.page
      .getByRole('searchbox', { name: label('table.search_placeholder') })
      .fill(query);
  }

  /** Through the button a person clicks, rather than by emptying the field programmatically. */
  async clearSearch(): Promise<void> {
    await this.page.getByRole('button', { name: label('table.clear_search') }).click();
  }

  /** The summary figure, whatever the table is currently showing. */
  async footerTotal(): Promise<string> {
    return (await this.page.locator('tfoot tr td').nth(1).textContent())?.trim() ?? '';
  }

  /**
   * That the table says *why* it is empty, naming what was typed.
   *
   * "Nothing matches this" and "you have none of these yet" are different facts and the wording
   * has to tell them apart. The text is built from the same translation the app renders, so a copy
   * change moves this with it.
   */
  async expectNothingMatches(query: string): Promise<void> {
    await expect(
      this.page.getByText(label('table.no_search_results').replace('{{query}}', query))
    ).toBeVisible();
  }

  /**
   * The first cell of every record, in the order they are rendered.
   *
   * `tbody` only, which is now the whole of the records: the summary lives in `tfoot`, so it can
   * no longer show up in this list however the table has been sorted.
   */
  async rowDescriptions(): Promise<string[]> {
    return this.page.evaluate(() =>
      [...document.querySelectorAll('tbody tr')].map(
        (row) => row.querySelector('td')?.textContent?.trim() ?? ''
      )
    );
  }

  private expenseRow(description: string): Locator {
    return this.page.getByRole('row').filter({ hasText: description });
  }

  /** Reopens an expense in the drawer it was created in and changes how often it recurs. */
  async changeExpenseFrequency(
    description: string,
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  ): Promise<void> {
    await this.openExpenses();
    await this.expenseRow(description).getByRole('button', { name: label('edit') }).click();

    const sheet = this.createDrawer;
    await expect(sheet).toBeVisible();

    await this.chooseOption(sheet, label('frequency'), label(frequency));

    // The same drawer, but its button is 'Edytuj' rather than 'Potwierdź' when it was opened
    // on an existing expense. Scoped to the sheet: the row's pencil carries that label too.
    await sheet.getByRole('button', { name: label('edit'), exact: true }).click();
    await expect(sheet).toBeHidden();
  }

  // === Duties ===

  async openDuties(): Promise<void> {
    if (new URL(this.page.url()).pathname !== DUTIES_PATH) await this.open(DUTIES_PATH);

    await expect(this.page.getByRole('tab', { name: label('all') })).toBeVisible();
  }

  async markDutyPaid(description: string): Promise<void> {
    await this.page
      .getByRole('row')
      .filter({ hasText: description })
      .getByRole('checkbox', { name: label('resolved') })
      .check();
  }

  /**
   * How many occurrences are ticked, rather than whether a named row is.
   *
   * Counted because a row cannot be named once the expense recurs weekly: every occurrence
   * carries the same description, so addressing one by its text matches four.
   */
  async paidDutyCount(): Promise<number> {
    return this.page.locator('tbody [role="checkbox"][aria-checked="true"]').count();
  }

  async expectPaidDuties(count: number): Promise<void> {
    await expect
      .poll(() => this.paidDutyCount(), { timeout: SYNC_TIMEOUT_MS })
      .toBe(count);
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
