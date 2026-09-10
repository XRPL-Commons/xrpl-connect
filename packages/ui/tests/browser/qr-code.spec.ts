import { expect, test } from '@playwright/test';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const uri = 'wc:0123456789abcdef0123456789abcdef@2?relay-protocol=irn&symKey=' + 'ab'.repeat(32);
const strictCspNonce = 'strict-csp-test-nonce';

for (const path of ['pre-generated', 'on-demand']) {
  for (const logo of ['inline', 'failed', 'stalled']) {
    test(`${path} QR decodes with ${logo} logo under enforced CSP`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/qr.html?**', async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          headers: {
            ...response.headers(),
            'content-security-policy': [
              "default-src 'self'",
              "base-uri 'none'",
              "object-src 'none'",
              "script-src 'self'",
              "connect-src 'self' ws:",
              `style-src 'nonce-${strictCspNonce}'`,
              "style-src-attr 'none'",
              "font-src 'none'",
              "img-src 'self' data:",
            ].join('; '),
          },
        });
      });
      let releaseLogo: (() => void) | undefined;
      const heldLogo = new Promise<void>((resolve) => {
        releaseLogo = resolve;
      });
      if (logo !== 'inline') {
        await page.route('**/qr-logo.svg', async (route) => {
          if (logo === 'stalled') {
            await heldLogo;
            await route.fulfill({
              contentType: 'image/svg+xml',
              body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="blue"/></svg>',
            });
          } else {
            await route.fulfill({ status: 404, body: 'Missing logo' });
          }
        });
      }
      await page.addInitScript(() => {
        (window as unknown as { cspViolations: string[] }).cspViolations = [];
        document.addEventListener('securitypolicyviolation', (event) => {
          (window as unknown as { cspViolations: string[] }).cspViolations.push(
            event.effectiveDirective
          );
        });
      });
      try {
        await page.goto(`/packages/ui/tests/browser/qr.html?path=${path}&logo=${logo}`, {
          waitUntil: 'domcontentloaded',
        });
        await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', {
          timeout: 10000,
        });
        if (path === 'pre-generated') {
          await expect(page.locator('body')).toHaveAttribute('data-pre-generated', 'true');
        }
        const qr = page.locator('[data-xrpl-overlay-portal] #qr-container');
        await expect(qr.locator('svg')).toBeVisible({ timeout: 10000 });
        await expect(qr.locator('svg image')).toHaveCount(logo === 'inline' ? 1 : 0);
        await expect
          .poll(async () => {
            const png = PNG.sync.read(
              await page.locator('[data-xrpl-overlay-portal] .qr-card').screenshot()
            );
            return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
          })
          .toBe(uri);
        if (logo === 'stalled') {
          const fallback = await qr.innerHTML();
          releaseLogo?.();
          await page.waitForLoadState('networkidle');
          expect(await qr.innerHTML()).toBe(fallback);
        }
        expect(errors).toEqual([]);
        expect(
          await page.evaluate(
            () => (window as unknown as { cspViolations: string[] }).cspViolations
          )
        ).toEqual([]);
      } finally {
        releaseLogo?.();
      }
    });
  }
}

test('a late logo cannot replace a newer pairing QR', async ({ page }) => {
  await page.clock.install();
  let releaseLogo!: () => void;
  const heldLogo = new Promise<void>((resolve) => {
    releaseLogo = resolve;
  });
  let logoRequested!: () => void;
  const requested = new Promise<void>((resolve) => {
    logoRequested = resolve;
  });
  await page.route('**/qr-logo.svg', async (route) => {
    logoRequested();
    await heldLogo;
    await route.fulfill({ status: 404, body: 'Missing logo' });
  });
  try {
    await page.goto('/packages/ui/tests/browser/qr.html?path=on-demand&logo=stalled', {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    await requested;
    await page.waitForFunction(
      () =>
        (document.querySelector('#connector') as HTMLElement & { qrRenderGeneration: number })
          .qrRenderGeneration === 1
    );
    const replacement = uri.replace('0123456789abcdef', 'fedcba9876543210');
    await page.locator('#connector').evaluate((element, value) => {
      const connector = element as HTMLElement & {
        walletManager: { wallets: { icon?: string }[] };
        setQRCode(walletId: string, uri: string): void;
      };
      connector.walletManager.wallets[0].icon = undefined;
      connector.setQRCode('walletconnect', value);
    }, replacement);
    const card = page.locator('[data-xrpl-overlay-portal] .qr-card');
    await expect
      .poll(async () => {
        const png = PNG.sync.read(await card.screenshot());
        return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
      })
      .toBe(replacement);
    const qr = page.locator('[data-xrpl-overlay-portal] #qr-container');
    const current = await qr.innerHTML();
    releaseLogo();
    await page.waitForLoadState('networkidle');
    // Wait for the original bounded render to settle after the failed image load.
    await page.clock.fastForward(3500);
    expect(await qr.innerHTML()).toBe(current);
  } finally {
    releaseLogo();
  }
});
