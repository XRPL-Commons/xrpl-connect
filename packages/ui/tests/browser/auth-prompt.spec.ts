import { expect, test, type Locator, type Page } from '@playwright/test';

const fixturePath = '/packages/ui/tests/browser/auth-prompt.html';

declare global {
  interface Window {
    getAuthCancelCount(): number;
    getAuthEventDetailKeys(): string[][];
    getDiscoveryCallCount(): number;
    getLastConnectOptions(): Record<string, unknown> | undefined;
    getResendCount(): number;
    getSubmittedValues(): Record<string, string>[];
    resolveAuthConnection(): void;
    resolveDelayedDiscovery(): void;
    setDiscoveryMode(mode: 'normal' | 'error' | 'delayed'): void;
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

test('discovers dashboard methods fresh on each chooser opening', async ({ page }) => {
  const dialog = await openWalletDialog(page);

  await expect(
    dialog.getByRole('button', { name: 'Sign in with socials', exact: true })
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'External Wallet', exact: true })).toBeVisible();
  await expect(dialog.locator('[data-wallet-id="dynamic-social"]')).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Sign in with socials', exact: true }).click();
  let chooser = page.getByRole('dialog', { name: 'Sign in with socials' });
  await expect(chooser.getByRole('button', { name: 'Email', exact: true })).toBeVisible();
  await expect(chooser.getByRole('button', { name: 'GitHub', exact: true })).toBeVisible();

  await chooser.getByRole('button', { name: 'Back to wallets', exact: true }).click();
  const walletDialog = page.getByRole('dialog', { name: 'Connect Wallet' });
  await walletDialog.getByRole('button', { name: 'Sign in with socials', exact: true }).click();
  chooser = page.getByRole('dialog', { name: 'Sign in with socials' });
  await expect(chooser.getByRole('button', { name: 'GitHub', exact: true })).toBeVisible();
  await expect(chooser.getByRole('button', { name: 'Email', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.getDiscoveryCallCount())).toBe(2);
});

test('passes the selected non-first discovered method options unchanged', async ({ page }) => {
  const dialog = await openWalletDialog(page);
  await dialog.getByRole('button', { name: 'Sign in with socials', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Sign in with socials' });
  await chooser.getByRole('button', { name: 'GitHub', exact: true }).click();

  await expect
    .poll(() => page.evaluate(() => window.getLastConnectOptions()))
    .toMatchObject({ loginMethod: 'github' });
  await page.evaluate(() => window.resolveAuthConnection());
  await expect(page.locator('#status')).toHaveText('connected:rLate');
});

test('keeps successful methods and retries a failed dashboard provider discovery', async ({
  page,
}) => {
  const dialog = await openWalletDialog(page);
  await page.evaluate(() => window.setDiscoveryMode('error'));
  await dialog.getByRole('button', { name: 'Sign in with socials', exact: true }).click();

  let chooser = page.getByRole('dialog', { name: 'Sign in with socials' });
  await expect(
    chooser.getByText('Unable to load sign-in methods for Dashboard Social.')
  ).toBeVisible();
  await expect(chooser.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();

  await page.evaluate(() => window.setDiscoveryMode('normal'));
  await chooser.getByRole('button', { name: 'Try again', exact: true }).click();
  chooser = page.getByRole('dialog', { name: 'Sign in with socials' });
  await expect(chooser.getByRole('button', { name: 'GitHub', exact: true })).toBeVisible();
  await expect(
    chooser.getByText('Unable to load sign-in methods for Dashboard Social.')
  ).toHaveCount(0);
});

test('ignores delayed discovery results after chooser close', async ({ page }) => {
  const dialog = await openWalletDialog(page);
  await page.evaluate(() => window.setDiscoveryMode('delayed'));
  await dialog.getByRole('button', { name: 'Sign in with socials', exact: true }).click();

  const chooser = page.getByRole('dialog', { name: 'Sign in with socials' });
  await expect(chooser.getByRole('status')).toHaveText('Loading available sign-in methods…');
  await chooser.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => window.resolveDelayedDiscovery());

  await page.getByRole('button', { name: 'Open wallet dialog', exact: true }).click();
  const walletDialog = page.getByRole('dialog', { name: 'Connect Wallet' });
  await expect(walletDialog).toBeVisible();
  await expect(walletDialog.locator('[data-social-login-id]')).toHaveCount(0);
  await expect(walletDialog.getByText('Delayed provider')).toHaveCount(0);
});

test('renders a private email-to-code prompt with retry, resend, and cancel recovery', async ({
  page,
}) => {
  const dialog = await openWalletDialog(page);
  await dialog.getByRole('button', { name: 'Sign in with socials', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Sign in with socials' });
  await chooser.getByRole('button', { name: 'Email', exact: true }).click();

  let prompt = page.getByRole('dialog', { name: 'Sign in with email' });
  await expect(prompt.getByLabel('Email address')).toBeVisible();
  await prompt.getByLabel('Email address').fill('secret@example.com');
  await prompt.getByRole('button', { name: 'Send code', exact: true }).click();
  await expect(prompt.getByRole('alert')).toHaveText('Email is not registered.');

  await prompt.getByLabel('Email address').fill('user@example.com');
  await prompt.getByRole('button', { name: 'Send code', exact: true }).click();
  prompt = page.getByRole('dialog', { name: 'Enter verification code' });
  await expect(prompt.getByLabel('Verification code')).toBeVisible();

  await prompt.getByRole('button', { name: 'Resend code', exact: true }).click();
  expect(await page.evaluate(() => window.getResendCount())).toBe(1);
  await prompt.getByLabel('Verification code').fill('000000');
  await prompt.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(prompt.getByRole('alert')).toHaveText('Invalid verification code.');

  await prompt.getByLabel('Verification code').fill('123456');
  await prompt.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('connected:rAuth');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const submitted = await page.evaluate(() => window.getSubmittedValues());
  expect(submitted).toEqual([
    { email: 'secret@example.com' },
    { email: 'user@example.com' },
    { code: '000000' },
    { code: '123456' },
  ]);
  const detailKeys = await page.evaluate(() => window.getAuthEventDetailKeys());
  expect(detailKeys.flat()).not.toContain('email');
  expect(detailKeys.flat()).not.toContain('code');
  expect(detailKeys.flat()).not.toContain('captchaToken');
});

test('cancels a prompt and ignores a late adapter result', async ({ page }) => {
  const dialog = await openWalletDialog(page);
  await dialog.getByRole('button', { name: 'Sign in with socials', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Sign in with socials' })
    .getByRole('button', { name: 'Email', exact: true })
    .click();
  const prompt = page.getByRole('dialog', { name: 'Sign in with email' });
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Connect Wallet' })).toBeVisible();
  expect(await page.evaluate(() => window.getAuthCancelCount())).toBe(1);

  await page.evaluate(() => window.resolveAuthConnection());
  await expect(page.locator('#status')).toHaveText('idle');
  await expect(page.getByRole('dialog', { name: 'Connect Wallet' })).toBeVisible();
});
