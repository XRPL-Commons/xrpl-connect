// @vitest-environment node
import { describe, expect, it } from 'vite-plus/test';
import { STANDARD_NETWORKS, type Transaction } from 'xrpl-connect';
import { createTransactionReview, formatAmount, formatXrpDrops } from '../src/review';
import { assertFeeWithinLimit } from '../src/signing';

const account = 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY';
const issuer = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';

function detail(review: ReturnType<typeof createTransactionReview>, name: string) {
  return review.details.find((entry) => entry.name === name)?.value;
}

describe('transaction review', () => {
  it('formats drops exactly as XRP', () => {
    expect(formatXrpDrops('0')).toBe('0 XRP');
    expect(formatXrpDrops('1')).toBe('0.000001 XRP');
    expect(formatXrpDrops('12')).toBe('0.000012 XRP');
    expect(formatXrpDrops('1500000')).toBe('1.5 XRP');
    expect(formatXrpDrops('1000000000')).toBe('1000 XRP');
    expect(formatXrpDrops('100000000000000001')).toBe('100000000000.000001 XRP');
    expect(formatXrpDrops('1.5')).toBe('1.5');
  });

  it('formats issued-currency and MPT amounts with their issuer or issuance', () => {
    expect(formatAmount({ currency: 'USD', issuer, value: '12.5' })).toBe(
      `12.5 USD (issuer ${issuer})`
    );
    expect(formatAmount({ mpt_issuance_id: '00000001ABCD', value: '100' })).toBe(
      '100 MPT (issuance 00000001ABCD)'
    );
    // An unexpected shape is not summarized, so none of its fields is hidden.
    expect(formatAmount({ currency: 'USD', issuer, value: '1', extra: 'x' })).toBeUndefined();
    expect(formatAmount({ currency: 'USD', value: '1' })).toBeUndefined();
    expect(formatAmount(5)).toBeUndefined();
  });

  it('lists every field once, type-specific fields first and complex values as JSON', () => {
    const transaction = {
      TransactionType: 'OfferCreate',
      Account: account,
      Fee: '15',
      Sequence: 3,
      Flags: 0x00080000,
      TakerGets: '25000000',
      TakerPays: { currency: 'USD', issuer, value: '10' },
      Memos: [{ Memo: { MemoData: '68656C6C6F' } }],
    } as Transaction;
    const review = createTransactionReview(transaction, STANDARD_NETWORKS.mainnet, 'sign');

    expect(review.details.map(({ name }) => name)).toEqual([
      'TransactionType',
      'Flags',
      'TakerGets',
      'TakerPays',
      'Memos',
      'Fee',
      'network',
      'Account',
      'Sequence',
    ]);
    expect(detail(review, 'network')).toBe('Mainnet');
    expect(detail(review, 'Fee')).toBe('0.000015 XRP');
    expect(detail(review, 'Flags')).toBe('524288');
    expect(detail(review, 'TakerGets')).toBe('25 XRP');
    expect(detail(review, 'TakerPays')).toBe(`10 USD (issuer ${issuer})`);
    expect(JSON.parse(detail(review, 'Memos')!)).toEqual(transaction.Memos);
  });

  it('shows MPT payments and returns a frozen copy of the transaction', () => {
    const transaction = {
      TransactionType: 'Payment',
      Account: account,
      Destination: issuer,
      Amount: { mpt_issuance_id: '0000012FFD9EE5DA93AC614B4DB94D7E0FCE415CA51BED47', value: '7' },
      Fee: '12',
      Sequence: 1,
    } as Transaction;
    const review = createTransactionReview(transaction, STANDARD_NETWORKS.testnet, 'signAndSubmit');

    expect(detail(review, 'Amount')).toBe(
      '7 MPT (issuance 0000012FFD9EE5DA93AC614B4DB94D7E0FCE415CA51BED47)'
    );
    expect(review.transaction).toEqual(transaction);
    expect(review.transaction).not.toBe(transaction);
    expect(Object.isFrozen(review.transaction)).toBe(true);
    expect(Object.isFrozen((review.transaction as { Amount: object }).Amount)).toBe(true);
    expect(Object.isFrozen(review.details)).toBe(true);
    expect(Object.isFrozen(transaction)).toBe(false);
  });
});

describe('fee limit', () => {
  const base = { TransactionType: 'Payment', Account: account } as Transaction;

  it('caps every fee at 2 XRP except owner-reserve priced transactions', () => {
    expect(() => assertFeeWithinLimit({ ...base, Fee: '2000000' })).not.toThrow();
    expect(() => assertFeeWithinLimit({ ...base, Fee: '2000001' })).toThrow(
      'exceeds the 2 XRP limit'
    );
    expect(() => assertFeeWithinLimit({ ...base, Fee: '99999999999999999999999999' })).toThrow(
      'exceeds the 2 XRP limit'
    );
    for (const TransactionType of ['AccountDelete', 'AMMCreate', 'VaultCreate']) {
      expect(() =>
        assertFeeWithinLimit({ ...base, TransactionType, Fee: '5000000' } as Transaction)
      ).not.toThrow();
    }
  });

  it('requires a whole number of drops', () => {
    for (const Fee of [undefined, '', '1.5', '-1', '1e6', ' 12']) {
      expect(() => assertFeeWithinLimit({ ...base, Fee } as Transaction)).toThrow(
        'whole number of drops'
      );
    }
  });
});
