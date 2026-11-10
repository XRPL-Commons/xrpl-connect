import { expect, test, type Locator, type Page } from '@playwright/test';

const fixturePath = '/packages/ui/tests/browser/availability.html';

declare global {
  interface Window {
    getAvailabilityProbeCounts(): { initial: number; injected: number };
    getOpenEventCount(): number;
    injectWallet(): void;
    resolveInitialAvailability(available?: boolean): void;
    showMixedWallets(): void;
    getAvailabilityWalletId(): string | undefined;
    showDelayedWallets(): void;
    resolveDelayedAvailability(): void;
  }
}

async function loadFixture(page: Page, withClock = false): Promise<void> {
  if (withClock) await page.clock.install();
  await page.goto(fixturePath);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => page.evaluate(() => window.getAvailabilityProbeCounts().initial)).toBe(1);
}

function walletDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Connect Wallet' });
}

test('opens immediately during discovery and preserves keyboard focus', async ({ page }) => {
  await loadFixture(page);
  const opener = page.getByRole('button', { name: 'Open wallet dialog' });

  await opener.click();
  const dialog = walletDialog(page);
  const content = dialog.getByRole('region', { name: 'Wallet options' });
  const closeButton = dialog.getByRole('button', { name: 'Close' });
  await expect(dialog).toBeVisible();
  await expect(content).toHaveAttribute('aria-busy', 'true');
  await expect(content.getByRole('status')).toHaveText('Finding available wallets…');
  await expect(closeButton).toBeFocused();

  await page.evaluate(() => window.resolveInitialAvailability());
  await expect(dialog.getByRole('button', { name: 'Installed Wallet', exact: true })).toBeVisible();
  await expect(content).toHaveAttribute('aria-busy', 'false');
  await expect(closeButton).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('reuses cached results and refreshes an injected wallet without stealing focus', async ({
  page,
}) => {
  await loadFixture(page, true);
  const opener = page.getByRole('button', { name: 'Open wallet dialog' });

  await opener.click();
  const dialog = walletDialog(page);
  const installedWallet = dialog.getByRole('button', { name: 'Installed Wallet', exact: true });
  await page.evaluate(() => window.resolveInitialAvailability());
  await expect(installedWallet).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  expect(await page.evaluate(() => window.getAvailabilityProbeCounts())).toEqual({
    initial: 1,
    injected: 0,
  });

  await opener.click();
  const reopenedDialog = walletDialog(page);
  const reopenedInstalledWallet = reopenedDialog.getByRole('button', {
    name: 'Installed Wallet',
    exact: true,
  });
  await expect(reopenedInstalledWallet).toBeVisible();
  await expect(reopenedDialog.getByRole('region', { name: 'Wallet options' })).toHaveAttribute(
    'aria-busy',
    'false'
  );
  expect(await page.evaluate(() => window.getAvailabilityProbeCounts())).toEqual({
    initial: 1,
    injected: 0,
  });

  await reopenedInstalledWallet.focus();
  await expect(reopenedInstalledWallet).toBeFocused();
  await page.evaluate(() => window.injectWallet());
  await page.clock.runFor(5_000);

  await expect(
    reopenedDialog.getByRole('button', { name: 'Injected Wallet', exact: true })
  ).toBeVisible();
  await expect(reopenedInstalledWallet).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => window.getAvailabilityProbeCounts().injected))
    .toBe(1);
});

test('does not reopen after closing while initial discovery is pending', async ({ page }) => {
  await loadFixture(page);
  const opener = page.getByRole('button', { name: 'Open wallet dialog' });

  await opener.click();
  const dialog = walletDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => window.getOpenEventCount())).toBe(1);

  await page.evaluate(() => window.resolveInitialAvailability());
  await expect(page.locator('[data-xrpl-overlay-portal] .modal')).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => window.getOpenEventCount())).toBe(1);
});

test('expands the wallet list when discovery finishes during a height transition', async ({
  page,
}) => {
  await loadFixture(page);
  await page.evaluate(() => window.resolveInitialAvailability());
  await page.getByRole('button', { name: 'Open wallet dialog' }).click();
  const dialog = walletDialog(page);
  await expect(dialog.getByRole('button', { name: 'Installed Wallet', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();

  await page.evaluate(async () => {
    window.showDelayedWallets();
    const connector = document.querySelector('#wallet-connector') as HTMLElement & {
      open(): Promise<void>;
    };
    void connector.open();

    // Resolve discovery after the loading view is measured, before its height is applied.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        window.resolveDelayedAvailability();
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });
  });

  const content = dialog.getByRole('region', { name: 'Wallet options' });
  await expect(content.getByRole('button')).toHaveCount(6);
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations({ subtree: true }).map((animation) => animation.finished)
    );
  });
  expect(await content.evaluate((element) => element.scrollHeight - element.clientHeight)).toBe(0);
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
});

async function openMixedWallets(page: Page): Promise<Locator> {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await loadFixture(page);
  await page.evaluate(() => window.showMixedWallets());
  await page.getByRole('button', { name: 'Open wallet dialog' }).click();
  await page.evaluate(() => window.resolveInitialAvailability());
  const dialog = walletDialog(page);
  await expect(dialog.getByRole('button', { name: 'Installed Wallet', exact: true })).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Wallet options' })).toHaveAttribute(
    'aria-busy',
    'true'
  );
  return dialog;
}

test('shows responsive wallets independently and preserves focus and order as others arrive', async ({
  page,
}) => {
  const dialog = await openMixedWallets(page);
  const installed = dialog.getByRole('button', { name: 'Installed Wallet', exact: true });
  await installed.focus();
  await page.evaluate(() => window.resolveDelayedAvailability());
  await expect(dialog.locator('[data-wallet-id]')).toHaveText([
    'Delayed Wallet 0',
    'Installed Wallet',
    'Delayed Wallet 1',
    'Delayed Wallet 2',
    'Delayed Wallet 3',
    'Delayed Wallet 4',
    'Delayed Wallet 5',
  ]);
  await expect(installed).toBeFocused();
  await expect(dialog.getByRole('region', { name: 'Wallet options' })).toHaveAttribute(
    'aria-busy',
    'false'
  );
});

test('connects to an installed wallet while unrelated detection is still pending', async ({
  page,
}) => {
  const dialog = await openMixedWallets(page);
  await dialog.getByRole('button', { name: 'Installed Wallet', exact: true }).click();
  await page.clock.runFor(200);
  await expect
    .poll(() => page.evaluate(() => window.getAvailabilityWalletId()))
    .toBe('installed-wallet');
  await expect(dialog).toBeHidden();
  await page.evaluate(() => window.resolveDelayedAvailability());
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.getAvailabilityWalletId())).toBe('installed-wallet');
});
