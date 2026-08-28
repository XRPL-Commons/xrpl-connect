import { expect, test, type Locator, type Page } from '@playwright/test';

const fixturePath = '/packages/ui/tests/browser/';

async function openOverflowingWalletDialog(page: Page): Promise<Locator> {
  await page.goto(fixturePath);
  await page.getByRole('button', { name: 'Open wallet dialog' }).click();
  const content = page.getByRole('region', { name: 'Wallet options' });
  await expect(content).toBeVisible();
  return content;
}

async function expectScrolledToEnd(content: Locator): Promise<void> {
  await expect
    .poll(() =>
      content.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)
    )
    .toBeLessThanOrEqual(1);
  await expect(content.getByRole('button', { name: 'Install Wallet 12' })).toBeInViewport();
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
]) {
  test(`keeps the header visible and the wallet list scrollable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const content = await openOverflowingWalletDialog(page);
    const modal = page.locator('[data-xrpl-overlay-portal] .modal');
    const header = page.locator('[data-xrpl-overlay-portal] .header');

    await expect
      .poll(() => content.evaluate((element) => element.scrollHeight > element.clientHeight))
      .toBe(true);
    await expect(content).toHaveCSS('overflow-y', 'auto');
    await expect(content).toHaveCSS('overscroll-behavior-y', 'contain');
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    const [modalBox, headerBox] = await Promise.all([modal.boundingBox(), header.boundingBox()]);
    expect(modalBox).not.toBeNull();
    expect(headerBox).not.toBeNull();
    expect(modalBox!.height).toBeLessThanOrEqual(viewport.height * 0.85 + 1);
    expect(headerBox!.y).toBeGreaterThanOrEqual(modalBox!.y);
    expect(headerBox!.y + headerBox!.height).toBeLessThanOrEqual(modalBox!.y + modalBox!.height);
  });
}

test('supports wheel scrolling without moving the locked document', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const content = await openOverflowingWalletDialog(page);

  await content.hover();
  await page.mouse.wheel(0, 10_000);
  await expectScrolledToEnd(content);
  await page.mouse.wheel(0, 1_000);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('supports keyboard scrolling to the final wallet', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const content = await openOverflowingWalletDialog(page);

  await content.focus();
  await page.keyboard.press('End');
  await expectScrolledToEnd(content);
});

test('supports touch scrolling to the final wallet', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const content = await openOverflowingWalletDialog(page);
  const box = await content.boundingBox();
  expect(box).not.toBeNull();

  const client = await context.newCDPSession(page);
  const x = box!.x + box!.width / 2;
  const startY = box!.y + box!.height - 24;
  const endY = box!.y + 24;
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: startY }],
  });
  for (let step = 1; step <= 8; step += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: startY + ((endY - startY) * step) / 8 }],
    });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expectScrolledToEnd(content);
});

test('provides wallet dialog semantics, traps focus, and restores every close path', async ({
  page,
}) => {
  await page.goto(fixturePath);
  const opener = page.getByRole('button', { name: 'Open wallet dialog' });

  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Connect Wallet' });
  const closeButton = dialog.getByRole('button', { name: 'Close' });
  const lastWallet = dialog.getByRole('button', { name: 'Install Wallet 12' });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(closeButton).toBeFocused();

  await lastWallet.focus();
  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(lastWallet).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  await opener.click();
  await page
    .getByRole('dialog', { name: 'Connect Wallet' })
    .getByRole('button', {
      name: 'Close',
    })
    .click();
  await expect(opener).toBeFocused();

  await opener.click();
  await page.locator('[data-xrpl-overlay-portal] .overlay').dispatchEvent('click');
  await expect(opener).toBeFocused();

  await opener.click();
  await page
    .getByRole('dialog', { name: 'Connect Wallet' })
    .getByRole('button', {
      name: 'Wallet 1',
      exact: true,
    })
    .click();
  await expect(page.getByRole('dialog', { name: 'Connect Wallet' })).toBeHidden();
  await expect(opener).toBeFocused();
});

test('provides account dialog semantics, traps focus, and restores its internal opener', async ({
  page,
}) => {
  await page.goto(fixturePath);
  const opener = page.locator('#account-connector').locator('#connect-wallet-button');

  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Connected' });
  const closeButton = dialog.getByRole('button', { name: 'Close' });
  const disconnectButton = dialog.getByRole('button', { name: 'Disconnect' });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(closeButton).toBeFocused();

  await disconnectButton.focus();
  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(disconnectButton).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  await opener.click();
  await page
    .locator('[data-xrpl-account-modal-portal] .account-modal-overlay')
    .dispatchEvent('click');
  await expect(opener).toBeFocused();

  await opener.click();
  await page
    .getByRole('dialog', { name: 'Connected' })
    .getByRole('button', {
      name: 'Close',
    })
    .click();
  await expect(opener).toBeFocused();
});
