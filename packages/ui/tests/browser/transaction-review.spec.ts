import { expect, test, type Locator, type Page } from '@playwright/test';

const fixturePath = '/packages/ui/tests/browser/transaction-review.html';

type Outcome =
  | { status: 'pending' }
  | { status: 'signed'; transaction?: Record<string, unknown> }
  | { status: 'error'; code: string };

declare global {
  interface Window {
    disconnectWallet(): Promise<void>;
    getOutcomes(): Outcome[];
    getSignatureCount(): number;
    signPayment(amount?: string): number;
  }
}

async function openFixture(page: Page): Promise<void> {
  await page.goto(fixturePath);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

function reviewDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Review transaction' });
}

function detail(dialog: Locator, label: string): Locator {
  return dialog
    .locator('.auth-prompt-review-row')
    .filter({ has: dialog.page().locator('dt', { hasText: new RegExp(`^${label}$`) }) })
    .locator('dd');
}

const outcomes = (page: Page) => page.evaluate(() => window.getOutcomes());
const signatureCount = (page: Page) => page.evaluate(() => window.getSignatureCount());

test('reviews a Privy payment in the connector and signs only after approval', async ({ page }) => {
  await openFixture(page);
  const trigger = page.getByRole('button', { name: 'Sign payment', exact: true });
  await trigger.click();

  const dialog = reviewDialog(page);
  await expect(dialog).toBeVisible();
  await expect(detail(dialog, 'Transaction type')).toHaveText('Payment');
  await expect(detail(dialog, 'Network')).toHaveText('Testnet');
  await expect(detail(dialog, 'Account')).toHaveText('rBgGZ9tc4him9KBzD8fKFiQz3fSZpaSwMH');
  await expect(detail(dialog, 'Destination')).toHaveText('rcM6pp3HTU5AS3Z122kH3w3AzerJRnZ1P');
  await expect(detail(dialog, 'Destination tag')).toHaveText('42');
  await expect(detail(dialog, 'Amount')).toHaveText('1.5 XRP');
  await expect(detail(dialog, 'Fee')).toHaveText('0.000012 XRP');
  await expect(detail(dialog, 'SigningPubKey')).toHaveText(
    '0279BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'
  );

  const approve = dialog.getByRole('button', { name: 'Approve', exact: true });
  await expect(approve).toBeDisabled();
  await expect(approve).toBeEnabled();
  await dialog.screenshot({ path: test.info().outputPath('payment-review.png') });
  expect(await signatureCount(page)).toBe(0);

  await approve.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(() => outcomes(page))
    .toEqual([
      {
        status: 'signed',
        transaction: expect.objectContaining({ Amount: '1500000', DestinationTag: 42 }),
      },
    ]);
  expect(await signatureCount(page)).toBe(1);
  await expect(trigger).toBeFocused();
});

test('shows every field of a complex transaction', async ({ page }) => {
  await openFixture(page);
  await page.getByRole('button', { name: 'Sign offer', exact: true }).click();

  const dialog = reviewDialog(page);
  await expect(detail(dialog, 'Transaction type')).toHaveText('OfferCreate');
  await expect(detail(dialog, 'TakerGets')).toHaveText('25 XRP');
  await expect(detail(dialog, 'TakerPays')).toHaveText(
    '10 USD (issuer rU74NBjYiU8pyrSd57Mo62K75hAFPspaLb)'
  );
  const memos = detail(dialog, 'Memos');
  await expect(memos).toContainText('"MemoData": "68656C6C6F"');
  await expect(memos).toHaveCSS('white-space', 'pre-wrap');
  await memos.scrollIntoViewIfNeeded();
  await dialog.screenshot({ path: test.info().outputPath('offer-review.png') });

  await dialog.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => outcomes(page)).toEqual([{ status: 'error', code: 'SIGN_REJECTED' }]);
});

test('rejecting or dismissing the review never signs', async ({ page }) => {
  await openFixture(page);

  await page.evaluate(() => window.signPayment());
  await reviewDialog(page).getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.evaluate(() => window.signPayment());
  await expect(reviewDialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.evaluate(() => window.signPayment());
  await reviewDialog(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await expect
    .poll(() => outcomes(page))
    .toEqual([
      { status: 'error', code: 'SIGN_REJECTED' },
      { status: 'error', code: 'SIGN_REJECTED' },
      { status: 'error', code: 'SIGN_REJECTED' },
    ]);
  expect(await signatureCount(page)).toBe(0);
});

test('queues concurrent signatures so a double click approves only the first', async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => {
    window.signPayment('1500000');
    window.signPayment('25000000');
  });

  let dialog = reviewDialog(page);
  await expect(detail(dialog, 'Amount')).toHaveText('1.5 XRP');
  const approve = dialog.getByRole('button', { name: 'Approve', exact: true });
  await expect(approve).toBeEnabled();
  await approve.dblclick();

  dialog = reviewDialog(page);
  await expect(detail(dialog, 'Amount')).toHaveText('25 XRP');
  await expect(dialog.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  await expect
    .poll(() => outcomes(page))
    .toEqual([
      { status: 'signed', transaction: expect.objectContaining({ Amount: '1500000' }) },
      { status: 'pending' },
    ]);
  expect(await signatureCount(page)).toBe(1);

  await dialog.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(() => outcomes(page))
    .toEqual([
      { status: 'signed', transaction: expect.objectContaining({ Amount: '1500000' }) },
      { status: 'error', code: 'SIGN_REJECTED' },
    ]);
  expect(await signatureCount(page)).toBe(1);
});

test('disconnecting during a review closes it and rejects the signature', async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => window.signPayment());
  await expect(reviewDialog(page)).toBeVisible();

  await page.evaluate(() => window.disconnectWallet());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => outcomes(page)).toEqual([{ status: 'error', code: 'NOT_CONNECTED' }]);
  expect(await signatureCount(page)).toBe(0);
  await expect(page.locator('body')).toHaveCSS('overflow', 'visible');
});
