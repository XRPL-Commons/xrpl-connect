import { expect, test, type Locator, type Page } from '@playwright/test';

const fixturePath = '/packages/ui/tests/browser/social-login.html';

declare global {
  interface Window {
    delaySocialLogout(): void;
    finishSocialLogout(): void;
    clearSocialLogins(): void;
    getManagerConnectCount(): number;
    getConnectorConnectedCount(): number;
    getSocialCallCount(): number;
    getSocialDisconnectCount(): number;
    getSocialLoginMethods(): Array<string | undefined>;
    rejectSocial(message?: string): void;
    resolveSocial(): void;
  }
}

async function openWalletDialog(page: Page): Promise<Locator> {
  await page.goto(fixturePath);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Open wallet dialog', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect Wallet' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Wallet options' })).toHaveAttribute(
    'aria-busy',
    'false'
  );
  return dialog;
}

test('renders two social methods without a duplicate adapter row and preserves external wallets', async ({
  page,
}) => {
  const dialog = await openWalletDialog(page);

  await expect(
    dialog.getByRole('button', { name: 'Sign in with socials', exact: true })
  ).toBeVisible();
  await expect(dialog.locator('[data-social-login-id]')).toHaveCount(0);
  await expect(dialog.locator('[data-wallet-id="social-adapter"]')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'External Wallet', exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: 'Sign in with socials', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Sign in with socials' });
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole('region', { name: 'Social sign-in methods' })).toBeVisible();
  await expect(
    chooser.getByRole('button', { name: 'Continue with Google', exact: true })
  ).toBeVisible();
  await expect(
    chooser.getByRole('button', { name: 'Continue with Apple', exact: true })
  ).toBeVisible();
  await expect(chooser.locator('[data-social-login-id]')).toHaveCount(2);
  await expect(chooser.getByRole('button', { name: /Facebook/i })).toHaveCount(0);
  await chooser.getByRole('button', { name: 'Back to wallets', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Connect Wallet' })).toBeVisible();

  await page.evaluate(() => window.clearSocialLogins());
  const walletDialog = page.getByRole('dialog', { name: 'Connect Wallet' });
  await expect(
    walletDialog.getByRole('button', { name: 'Social Adapter', exact: true })
  ).toBeVisible();
  await walletDialog.getByRole('button', { name: 'External Wallet', exact: true }).click();
  await expect(page.locator('#state')).toHaveText('connected:rExternal');
});

test('connects through the manager once and retries the same social login method', async ({
  page,
}) => {
  const dialog = await openWalletDialog(page);

  await dialog.getByRole('button', { name: 'Sign in with socials', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Sign in with socials' });
  await chooser.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect(page.locator('#state')).toHaveText('pending');
  await expect.poll(() => page.evaluate(() => window.getSocialCallCount())).toBe(1);

  await page.evaluate(() => window.rejectSocial());
  const errorDialog = page.getByRole('dialog', { name: 'Connection Failed' });
  await expect(errorDialog).toBeVisible();
  await expect(errorDialog.getByText('Failed to connect to Continue with Google')).toBeVisible();

  await errorDialog.getByRole('button', { name: 'Try Again', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSocialCallCount())).toBe(2);
  await expect
    .poll(() => page.evaluate(() => window.getSocialLoginMethods()))
    .toEqual(['google', 'google']);

  await page.evaluate(() => window.resolveSocial());
  await expect(page.locator('#state')).toHaveText('connected:rSocial');
  expect(await page.evaluate(() => window.getManagerConnectCount())).toBe(1);
  expect(await page.evaluate(() => window.getConnectorConnectedCount())).toBe(1);
});

test('cancels pending authorization and ignores its late result', async ({ page }) => {
  const dialog = await openWalletDialog(page);

  await dialog.getByRole('button', { name: 'Sign in with socials', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Sign in with socials' });
  await chooser.getByRole('button', { name: 'Continue with Apple', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSocialCallCount())).toBe(1);
  await page
    .getByRole('dialog', { name: 'Connect Wallet' })
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#state')).toHaveText('idle');

  await page.evaluate(() => window.resolveSocial());
  await expect.poll(() => page.evaluate(() => window.getManagerConnectCount())).toBe(0);
  await expect.poll(() => page.evaluate(() => window.getConnectorConnectedCount())).toBe(0);
  expect(await page.evaluate(() => window.getSocialDisconnectCount())).toBeGreaterThan(0);
  expect(await page.locator('#state').textContent()).toBe('idle');
});

for (const source of ['application', 'component'] as const) {
  test(`updates the component on ${source} logout before provider cleanup finishes`, async ({
    page,
  }) => {
    const dialog = await openWalletDialog(page);
    await dialog.getByRole('button', { name: 'Sign in with socials', exact: true }).click();
    await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.getSocialCallCount())).toBe(1);
    await page.evaluate(() => window.resolveSocial());
    await expect(page.locator('#state')).toHaveText('connected:rSocial');

    const trigger = page.locator('#wallet-connector').locator('#connect-wallet-button');
    await trigger.click();
    const accountDialog = page.getByRole('dialog', { name: 'Connected' });
    await expect(accountDialog).toBeVisible();
    await page.evaluate(() => window.delaySocialLogout());
    if (source === 'application') {
      // Application logout can happen while the component's account dialog is open.
      await page.locator('#logout').dispatchEvent('click');
    } else {
      await accountDialog.getByRole('button', { name: 'Disconnect', exact: true }).click();
    }

    await expect(page.locator('#state')).toHaveText('idle');
    await expect(accountDialog).toBeHidden();
    await expect(trigger).toHaveText('Connect Wallet');

    await trigger.click();
    await page.getByRole('button', { name: 'Sign in with socials', exact: true }).click();
    await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
    expect(await page.evaluate(() => window.getSocialCallCount())).toBe(1);
    await page.evaluate(() => window.finishSocialLogout());
    await expect.poll(() => page.evaluate(() => window.getSocialCallCount())).toBe(2);
    await page.evaluate(() => window.resolveSocial());
    await expect(page.locator('#state')).toHaveText('connected:rSocial');
  });
}

test('keeps a newer account dialog open when an earlier logout finishes', async ({ page }) => {
  const dialog = await openWalletDialog(page);
  await dialog.getByRole('button', { name: 'Sign in with socials', exact: true }).click();
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.getSocialCallCount())).toBe(1);
  await page.evaluate(() => window.resolveSocial());
  await expect(page.locator('#state')).toHaveText('connected:rSocial');

  const trigger = page.locator('#wallet-connector').locator('#connect-wallet-button');
  await trigger.click();
  await page.evaluate(() => window.delaySocialLogout());
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Connected' })).toBeHidden();

  await trigger.click();
  await page.getByRole('button', { name: 'External Wallet', exact: true }).click();
  await expect(page.locator('#state')).toHaveText('connected:rExternal');
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Connected' })).toBeVisible();

  await page.evaluate(() => window.finishSocialLogout());
  await expect(page.getByRole('dialog', { name: 'Connected' })).toBeVisible();
  await expect(page.locator('#state')).toHaveText('connected:rExternal');
});
