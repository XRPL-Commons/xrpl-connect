import { expect, test, type Locator, type Page } from '@playwright/test';

const fixturePath = '/packages/ui/tests/browser/availability.html';

declare global {
  interface Window {
    getAvailabilityProbeCounts(): { initial: number; injected: number };
    getOpenEventCount(): number;
    injectWallet(): void;
    resolveInitialAvailability(available?: boolean): void;
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
