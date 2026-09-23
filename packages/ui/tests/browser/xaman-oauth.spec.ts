import { expect, test } from '@playwright/test';

const fixture = '/packages/ui/tests/browser/xaman-oauth.html';
const apiKey = '12345678-1234-4234-8234-123456789abc';
const account = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';

function token(state: string) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256' })}.${encode({
    client_id: apiKey,
    sub: account,
    state,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.test-signature`;
}

test.beforeEach(async ({ context }) => {
  // Exercise the packaged adapter and SDK, replacing only the wallet's HTTP boundary.
  await context.route('https://oauth2.xumm.app/auth?*', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Wallet authorization</title>' })
  );
  await context.route('https://xumm.app/api/v1/jwt/ping', (route) =>
    route.fulfill({
      json: {
        auth: {
          jwtData: {
            sub: account,
            account,
            network_id: 0,
            network_type: 'MAINNET',
            network_endpoint: 'wss://xrplcluster.com',
          },
        },
      },
    })
  );
  await context.route('https://oauth2.xumm.app/userinfo', (route) =>
    route.fulfill({
      json: {
        sub: account,
        account,
        networkId: 0,
        networkType: 'MAINNET',
        networkEndpoint: 'wss://xrplcluster.com',
      },
    })
  );
});

test('completes the original connection after explicit recovery in a separate tab', async ({
  page,
  context,
}) => {
  await page.goto(fixture);
  const popupEvent = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  const popup = await popupEvent;
  await popup.waitForURL('https://oauth2.xumm.app/auth?*');
  const auth = new URL(popup.url());
  const callback = new URL(auth.searchParams.get('redirect_uri')!);
  callback.searchParams.set('state', auth.searchParams.get('state')!);
  callback.searchParams.set('access_token', token(auth.searchParams.get('state')!));

  const returned = await context.newPage();
  await returned.goto(callback.href);
  await expect(returned.locator('#state')).toHaveText('disconnected');
  await expect(page.locator('#state')).toHaveText('pending');
  await returned.getByRole('button', { name: 'Recover return' }).click();
  await expect(returned.locator('#state')).toHaveText(account);
  await expect(page.locator('#state')).toHaveText(account);
  expect(new URL(returned.url()).searchParams.has('access_token')).toBe(false);
  expect(context.pages()).toHaveLength(3);
  await page.getByRole('button', { name: 'Refresh account' }).click();
  await expect(page.locator('#state')).toHaveText(account);
  await returned.getByRole('button', { name: 'Refresh account' }).click();
  await expect(returned.locator('#state')).toHaveText(account);
});

test('ignores a late callback after cancellation and allows a new connection', async ({
  page,
  context,
}) => {
  await page.goto(fixture);
  const popupEvent = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  const popup = await popupEvent;
  await popup.waitForURL('https://oauth2.xumm.app/auth?*');
  const auth = new URL(popup.url());
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(page.locator('#state')).toHaveText('disconnected');
  const callback = new URL(auth.searchParams.get('redirect_uri')!);
  callback.searchParams.set('state', auth.searchParams.get('state')!);
  callback.searchParams.set('access_token', token(auth.searchParams.get('state')!));
  const returned = await context.newPage();
  await returned.goto(callback.href);
  await returned.getByRole('button', { name: 'Recover return' }).click();
  await expect(returned.locator('#state')).toHaveText('disconnected');
  await expect(page.locator('#state')).toHaveText('disconnected');
  const retryPopup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  const retry = await retryPopup;
  await retry.waitForURL('https://oauth2.xumm.app/auth?*');
  expect(new URL(retry.url()).searchParams.get('state')).not.toBe(auth.searchParams.get('state'));
});
