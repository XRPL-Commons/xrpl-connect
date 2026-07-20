import { describe, expect, it } from 'vitest';
import { isWalletError } from './errors';
import { WalletErrorCategory, WalletErrorCode } from './types';

describe('isWalletError', () => {
  it('recognizes wallet errors created by another bundled copy of core', () => {
    const error = Object.assign(new Error('Rejected'), {
      name: 'WalletError',
      code: WalletErrorCode.SIGN_REJECTED,
      category: WalletErrorCategory.USER_ACTION,
    });

    expect(isWalletError(error)).toBe(true);
  });

  it('does not recognize unrelated errors', () => {
    expect(isWalletError(new Error('Rejected'))).toBe(false);
  });
});
