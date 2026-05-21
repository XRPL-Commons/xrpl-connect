import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletErrorCode } from '@xrpl-connect/core';

const mockXummInstance = {
  authorize: vi.fn(),
  logout: vi.fn(),
  payload: {
    createAndSubscribe: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('xumm', () => ({
  Xumm: vi.fn().mockImplementation(() => mockXummInstance),
}));

import { XamanAdapter } from '../src/xaman-adapter';

beforeEach(() => {
  mockXummInstance.authorize.mockReset();
  mockXummInstance.logout.mockReset();
  mockXummInstance.payload.createAndSubscribe.mockReset();
  mockXummInstance.payload.create.mockReset();
});

describe('XamanAdapter.isAvailable', () => {
  it('is always available regardless of options', async () => {
    await expect(new XamanAdapter().isAvailable()).resolves.toBe(true);
    await expect(new XamanAdapter({ apiKey: 'key' }).isAvailable()).resolves.toBe(true);
  });
});

describe('XamanAdapter.connect', () => {
  it('returns account info on a successful authorize', async () => {
    mockXummInstance.authorize.mockResolvedValue({ me: { account: 'rXamanUser' } });
    const adapter = new XamanAdapter({ apiKey: 'test-key' });

    const account = await adapter.connect();

    expect(account.address).toBe('rXamanUser');
    expect(account.network.id).toBe('mainnet');
  });

  it('throws a wrapped connection error when no API key is given', async () => {
    const adapter = new XamanAdapter();
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
    expect(mockXummInstance.authorize).not.toHaveBeenCalled();
  });

  it('wraps an authorization error returned by the SDK', async () => {
    mockXummInstance.authorize.mockResolvedValue(new Error('User rejected'));
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });
});

describe('XamanAdapter.sign', () => {
  it('rejects when called before connect (wrapped as a sign failure)', async () => {
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
  });

  it('maps a rejected payload to a sign-rejected error', async () => {
    mockXummInstance.authorize.mockResolvedValue({ me: { account: 'rXamanUser' } });
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await adapter.connect();

    // Spy on the private waitForSignature step indirectly by faking the payload result
    mockXummInstance.payload.createAndSubscribe.mockImplementation(async (_tx, _cb) => {
      // Simulate the SDK invoking the subscription with a rejection.
      // The adapter then awaits a websocket; we short-circuit by throwing.
      throw new Error('Sign rejected by user');
    });

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });
  });
});

describe('XamanAdapter.disconnect', () => {
  it('logs out and clears local state', async () => {
    mockXummInstance.authorize.mockResolvedValue({ me: { account: 'rXamanUser' } });
    mockXummInstance.logout.mockResolvedValue(undefined);
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await adapter.connect();
    expect(await adapter.getAccount()).not.toBeNull();

    await adapter.disconnect();

    expect(mockXummInstance.logout).toHaveBeenCalled();
    expect(await adapter.getAccount()).toBeNull();
  });

  it('still clears state when logout throws', async () => {
    mockXummInstance.authorize.mockResolvedValue({ me: { account: 'rXamanUser' } });
    mockXummInstance.logout.mockRejectedValue(new Error('already logged out'));
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await adapter.connect();

    await adapter.disconnect();

    expect(await adapter.getAccount()).toBeNull();
  });
});
