import { describe, expect, it } from 'vite-plus/test';
import { createWalletError, isWalletError } from './errors';
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

describe('createWalletError failure factories', () => {
  it('identifies missing adapter configuration as invalid input', () => {
    expect(createWalletError.configurationRequired('Test Wallet', ['apiKey'])).toMatchObject({
      code: WalletErrorCode.CONFIGURATION_REQUIRED,
      category: WalletErrorCategory.INVALID_INPUT,
      message: 'Test Wallet requires configuration before connecting: apiKey.',
    });
  });

  it('preserves existing typed errors instead of changing their code or category', () => {
    const typedError = createWalletError.notConnected();

    expect(createWalletError.connectionFailed('Test Wallet', typedError)).toBe(typedError);
    expect(createWalletError.signFailed(typedError)).toBe(typedError);
  });

  it('wraps unknown failures and retains the original error', () => {
    const cause = new Error('Provider failed');

    expect(createWalletError.connectionFailed('Test Wallet', cause)).toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
      originalError: cause,
    });
    expect(createWalletError.signFailed(cause)).toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
      originalError: cause,
    });
  });
});
