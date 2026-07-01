import { describe, it, expect } from 'vitest';
import { orderWalletsByMru } from '../src/utils';

const wallets = [{ id: 'xaman' }, { id: 'crossmark' }, { id: 'gemwallet' }, { id: 'ledger' }];

describe('orderWalletsByMru', () => {
  it('returns the input unchanged when there is no history', () => {
    expect(orderWalletsByMru(wallets, [])).toEqual(wallets);
  });

  it('surfaces the most-recently-used wallets first', () => {
    const ordered = orderWalletsByMru(wallets, ['ledger', 'gemwallet']);
    expect(ordered.map((w) => w.id)).toEqual(['ledger', 'gemwallet', 'xaman', 'crossmark']);
  });

  it('keeps the original relative order for wallets with no history (stable)', () => {
    const ordered = orderWalletsByMru(wallets, ['crossmark']);
    expect(ordered.map((w) => w.id)).toEqual(['crossmark', 'xaman', 'gemwallet', 'ledger']);
  });

  it('ignores history entries for wallets that are not present', () => {
    const ordered = orderWalletsByMru(wallets, ['not-a-wallet', 'ledger']);
    expect(ordered.map((w) => w.id)).toEqual(['ledger', 'xaman', 'crossmark', 'gemwallet']);
  });
});
