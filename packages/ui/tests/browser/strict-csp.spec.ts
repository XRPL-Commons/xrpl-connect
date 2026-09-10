import { expect, test, type Page } from '@playwright/test';

const fixturePath = '/packages/ui/tests/browser/strict-csp.html';
const strictCspNonce = 'strict-csp-test-nonce';

declare global {
  interface Window {
    __strictCspViolations: string[];
  }
}

function strictCspHeader(): string {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "connect-src 'self' ws:",
    `style-src 'nonce-${strictCspNonce}'`,
    "style-src-attr 'none'",
    "font-src 'none'",
    "img-src 'self' data:",
  ].join('; ');
}

async function installStrictCsp(page: Page, fixture = fixturePath): Promise<string[]> {
  const fontRequests: string[] = [];
  page.on('request', (request) => {
    if (/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|\.woff2?(?:\?|$))/i.test(request.url())) {
      fontRequests.push(request.url());
    }
  });
  await page.addInitScript(() => {
    window.__strictCspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      if (
        event.effectiveDirective.startsWith('style-src') ||
        event.effectiveDirective === 'font-src'
      ) {
        window.__strictCspViolations.push(event.effectiveDirective);
      }
    });
  });
  await page.route(`**${fixture}`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': strictCspHeader(),
      },
    });
  });
  return fontRequests;
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
  );
}

async function openWalletDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open wallet dialog' }).click();
  await expect(page.getByRole('dialog', { name: 'Connect Wallet' })).toBeVisible();
}

async function styleState(
  page: Page,
  selector: string
): Promise<{
  nonce: string;
  applied: boolean;
}> {
  return page.locator(selector).evaluate((element) => {
    const style = element.shadowRoot?.querySelector('style') as HTMLStyleElement | null;
    return { nonce: style?.nonce ?? '', applied: Boolean(style?.sheet) };
  });
}

async function expectNoStyleOrFontViolations(page: Page, fontRequests: string[]): Promise<void> {
  await settle(page);
  expect(await page.evaluate(() => window.__strictCspViolations)).toEqual([]);
  expect(fontRequests).toEqual([]);
}

test('authorizes HTML- and JS-created connector styles and keeps computed styling', async ({
  page,
}) => {
  const fontRequests = await installStrictCsp(page);
  await page.goto(fixturePath);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');

  await expect(page.locator('#html-connector #connect-wallet-button')).toHaveCSS(
    'border-radius',
    '8px'
  );
  await expect(page.locator('#js-connector #connect-wallet-button')).toHaveCSS(
    'border-radius',
    '8px'
  );
  await expect
    .poll(() => styleState(page, '#html-connector'))
    .toEqual({
      nonce: strictCspNonce,
      applied: true,
    });
  await expect
    .poll(() => styleState(page, '#js-connector'))
    .toEqual({
      nonce: strictCspNonce,
      applied: true,
    });
  await expectNoStyleOrFontViolations(page, fontRequests);
});

test('keeps nonce styles on wallet and account portals across reopen and renders loading CSS', async ({
  page,
}) => {
  const fontRequests = await installStrictCsp(page);
  await page.goto(fixturePath);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');

  await openWalletDialog(page);
  const walletPortal = page.locator('[data-xrpl-overlay-portal]');
  await expect(walletPortal.locator('.modal')).toHaveCSS('border-radius', '12px');
  await expect
    .poll(() => styleState(page, '[data-xrpl-overlay-portal]'))
    .toEqual({
      nonce: strictCspNonce,
      applied: true,
    });
  await page
    .getByRole('dialog', { name: 'Connect Wallet' })
    .getByRole('button', { name: 'Close' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Connect Wallet' })).toBeHidden();

  await openWalletDialog(page);
  await expect(walletPortal.locator('.modal')).toHaveCSS('display', 'flex');
  await expect
    .poll(() => styleState(page, '[data-xrpl-overlay-portal]'))
    .toEqual({
      nonce: strictCspNonce,
      applied: true,
    });
  await page
    .getByRole('dialog', { name: 'Connect Wallet' })
    .getByRole('button', { name: 'Close' })
    .click();

  const accountOpener = page.locator('#js-connector #connect-wallet-button');
  await accountOpener.click();
  const accountPortal = page.locator('[data-xrpl-account-modal-portal]');
  await expect(accountPortal.locator('.account-modal')).toBeVisible();
  await expect(accountPortal.locator('.account-modal')).toHaveCSS('border-radius', '12px');
  await expect
    .poll(() => styleState(page, '[data-xrpl-account-modal-portal]'))
    .toEqual({
      nonce: strictCspNonce,
      applied: true,
    });
  await accountPortal.getByRole('button', { name: 'Close' }).click();
  await accountOpener.click();
  await expect(accountPortal.locator('.account-modal')).toBeVisible();
  await expect
    .poll(() => styleState(page, '[data-xrpl-account-modal-portal]'))
    .toEqual({
      nonce: strictCspNonce,
      applied: true,
    });
  await accountPortal.getByRole('button', { name: 'Close' }).click();

  await openWalletDialog(page);
  await page.locator('#html-connector').evaluate((element) => {
    (
      element as HTMLElement & { showLoadingView(walletId: string, walletName: string): void }
    ).showLoadingView('wallet-1', 'Wallet 1');
  });
  const loadingMessage = page.locator('[data-xrpl-overlay-portal] .loading-wallet-message');
  await expect(loadingMessage).toHaveText('Check your Wallet 1');
  await expect(loadingMessage).not.toHaveAttribute('style');
  await expect(loadingMessage).toHaveCSS('margin-top', '8px');
  await expect(loadingMessage).toHaveCSS('font-size', '14px');
  await expect(loadingMessage).toHaveCSS('opacity', '0.7');

  await expectNoStyleOrFontViolations(page, fontRequests);
});

test('blocks missing and wrong nonces under enforced style-src', async ({ page }) => {
  const fontRequests = await installStrictCsp(page);
  await page.goto(fixturePath);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expectNoStyleOrFontViolations(page, fontRequests);

  await page.evaluate(() => {
    window.__strictCspViolations = [];
    const missing = document.createElement('xrpl-wallet-connector');
    missing.id = 'missing-nonce-connector';
    document.body.append(missing);

    const wrong = document.createElement('xrpl-wallet-connector');
    wrong.id = 'wrong-nonce-connector';
    wrong.nonce = 'wrong-nonce';
    document.body.append(wrong);
  });

  await expect
    .poll(() => styleState(page, '#missing-nonce-connector'))
    .toEqual({
      nonce: '',
      applied: false,
    });
  await expect
    .poll(() => styleState(page, '#wrong-nonce-connector'))
    .toEqual({
      nonce: 'wrong-nonce',
      applied: false,
    });
  await expect
    .poll(() => page.evaluate(() => window.__strictCspViolations))
    .toEqual(expect.arrayContaining(['style-src-elem']));
  expect(fontRequests).toEqual([]);
});

test('forwards nonce through the React and Vue wrappers before their first render', async ({
  page,
}) => {
  const frameworkFixturePath = '/packages/ui/tests/browser/strict-csp-frameworks.html';
  const fontRequests = await installStrictCsp(page, frameworkFixturePath);
  await page.goto(frameworkFixturePath);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');

  await expect(page.locator('#react-connector #connect-wallet-button')).toHaveCSS(
    'border-radius',
    '8px'
  );
  await expect(page.locator('#vue-connector #connect-wallet-button')).toHaveCSS(
    'border-radius',
    '8px'
  );
  for (const id of ['react-connector', 'vue-connector']) {
    await expect(page.locator(`#${id} #connect-wallet-button`)).toHaveCSS(
      'background-color',
      'rgb(17, 34, 51)'
    );
  }
  await expect
    .poll(() => styleState(page, '#react-connector'))
    .toEqual({
      nonce: strictCspNonce,
      applied: true,
    });
  await expect
    .poll(() => styleState(page, '#vue-connector'))
    .toEqual({
      nonce: strictCspNonce,
      applied: true,
    });
  await expectNoStyleOrFontViolations(page, fontRequests);
});
