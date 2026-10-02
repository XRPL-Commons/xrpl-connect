import { expect, test } from '@playwright/test';

for (const framework of ['react', 'vue'] as const) {
  test(`${framework} distinguishes empty wallet lists from an omitted filter`, async ({ page }) => {
    await page.goto('/packages/ui/tests/browser/strict-csp-frameworks.html?empty-wallets');
    const connector = page.locator(`#${framework}-connector`);
    await expect(connector).toHaveAttribute('wallets', '');
    await connector.locator('#connect-wallet-button').click();

    const dialog = page.getByRole('dialog', { name: 'Connect Wallet' });
    const content = dialog.getByRole('region', { name: 'Wallet options' });
    const walletButtons = content.locator('[data-wallet-id]');
    await expect(dialog).toBeVisible();
    await expect(content).toHaveAttribute('aria-busy', 'false');
    await expect(walletButtons).toHaveCount(0);

    await page.evaluate((framework) => {
      window.setFrameworkWallets(framework, ['framework-wallet']);
    }, framework);
    await expect(
      dialog.getByRole('button', { name: 'Framework Wallet', exact: true })
    ).toBeVisible();

    await page.evaluate((framework) => window.setFrameworkWallets(framework, []), framework);
    await expect(connector).toHaveAttribute('wallets', '');
    await expect(content).toHaveAttribute('aria-busy', 'false');
    await expect(walletButtons).toHaveCount(0);

    await page.evaluate((framework) => window.setFrameworkWallets(framework), framework);
    await expect(connector).not.toHaveAttribute('wallets');
    await expect(
      dialog.getByRole('button', { name: 'Framework Wallet', exact: true })
    ).toBeVisible();
  });
}
