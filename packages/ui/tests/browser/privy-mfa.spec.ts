import { expect, test } from '@playwright/test';

test('the pinned Privy SDK resumes and cancels signing with a browser passkey', async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page.goto('http://localhost:4173/packages/privy/tests/browser/mfa.html');
  await page.getByRole('button', { name: 'Register virtual passkey' }).click();
  await expect(page.locator('output')).toHaveText('registered');
  await page.getByRole('button', { name: 'Request signature' }).click();
  await page.getByRole('button', { name: 'Confirm with passkey' }).click();
  await expect(page.locator('output')).toHaveText('verified-fixture');
  await page.getByRole('button', { name: 'Request signature' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('output')).toHaveText('mfa_cancelled');
});
