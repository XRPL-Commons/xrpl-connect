import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

const fixture = '/packages/ui/tests/browser/xaman-oauth.html';
const apiKey = '12345678-1234-4234-8234-123456789abc';
const account = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
// Authorization requests by the single-use code the fake Xaman server issued for them.
const issued = new Map<string, URL>();
let codes = 0;

function token(state: string) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256' })}.${encode({
    client_id: apiKey,
    sub: account,
    state,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.test-signature`;
}

/** The redirect Xaman sends after the user approves `auth`, carrying a fresh code. */
function callbackFor(auth: URL): URL {
  const code = `code-${++codes}`;
  issued.set(code, auth);
  const callback = new URL(auth.searchParams.get('redirect_uri')!);
  callback.searchParams.set('state', auth.searchParams.get('state')!);
  callback.searchParams.set('code', code);
  return callback;
}

test.beforeEach(async ({ context }) => {
  // Exercise the packaged adapter and SDK, replacing only the wallet's HTTP boundary.
  await context.route('https://oauth2.xumm.app/auth?*', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Wallet authorization</title>' })
  );
  await context.route('https://oauth2.xumm.app/token', (route) => {
    const request = route.request();
    const body = new URLSearchParams(request.postData() ?? '');
    const code = body.get('code') ?? '';
    const auth = issued.get(code);
    const challenge = createHash('sha256')
      .update(body.get('code_verifier') ?? '')
      .digest('base64url');
    if (
      request.method() !== 'POST' ||
      !auth ||
      body.get('grant_type') !== 'authorization_code' ||
      body.get('client_id') !== apiKey ||
      body.get('redirect_uri') !== auth.searchParams.get('redirect_uri') ||
      auth.searchParams.get('code_challenge_method') !== 'S256' ||
      challenge !== auth.searchParams.get('code_challenge')
    ) {
      return route.fulfill({ status: 400, json: { error: 'invalid_grant' } });
    }
    issued.delete(code);
    return route.fulfill({
      json: { access_token: token(auth.searchParams.get('state')!), token_type: 'bearer' },
    });
  });
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

for (const [name, params] of [
  ['an access_token', { access_token: token('forged') }],
  ['an authorization_code', { authorization_code: 'forged' }],
  ['a code for an unissued state', { state: 'xrpl-connect-forged', code: 'forged' }],
] as const) {
  test(`ignores a crafted link with ${name} and no local sign-in attempt`, async ({ page }) => {
    let requested = false;
    await page.route('https://oauth2.xumm.app/**', (route) => {
      requested = true;
      return route.fallback();
    });
    await page.goto(`${fixture}?${new URLSearchParams(params)}`);
    await page.getByRole('button', { name: 'Recover return' }).click();
    await expect(page.locator('#state')).toHaveText('disconnected');
    expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({});
    expect(requested).toBe(false);
  });
}

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
  expect(auth.searchParams.get('response_type')).toBe('code');
  const callback = callbackFor(auth);

  const returned = await context.newPage();
  await returned.goto(callback.href);
  await expect(returned.locator('#state')).toHaveText('disconnected');
  await expect(page.locator('#state')).toHaveText('pending');
  await returned.getByRole('button', { name: 'Recover return' }).click();
  await expect(returned.locator('#state')).toHaveText(account);
  await expect(page.locator('#state')).toHaveText(account);
  expect(new URL(returned.url()).search).toBe('');
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
  const callback = callbackFor(auth);
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
