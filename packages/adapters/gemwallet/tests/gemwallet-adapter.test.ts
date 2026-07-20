import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { TIME, WalletErrorCode } from '@xrpl-connect/core';

vi.mock('@gemwallet/api', () => ({
  isInstalled: vi.fn(),
  getPublicKey: vi.fn(),
  signMessage: vi.fn(),
  signTransaction: vi.fn(),
  submitTransaction: vi.fn(),
}));

import * as gemApi from '@gemwallet/api';
import { GemWalletAdapter } from '../src/gemwallet-adapter';

const api = gemApi as unknown as Record<keyof typeof gemApi, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  api.isInstalled.mockReset();
  api.getPublicKey.mockReset();
  api.signMessage.mockReset();
  api.signTransaction.mockReset();
  api.submitTransaction.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GemWalletAdapter.isAvailable', () => {
  it('returns true when extension reports installed', async () => {
    api.isInstalled.mockResolvedValue({ result: { isInstalled: true } });
    await expect(new GemWalletAdapter().isAvailable()).resolves.toBe(true);
  });

  it('returns false when extension reports not installed', async () => {
    api.isInstalled.mockResolvedValue({ result: { isInstalled: false } });
    await expect(new GemWalletAdapter().isAvailable()).resolves.toBe(false);
  });

  it('returns false when the call throws', async () => {
    api.isInstalled.mockRejectedValue(new Error('boom'));
    await expect(new GemWalletAdapter().isAvailable()).resolves.toBe(false);
  });

  it('returns false when the extension does not answer in time', async () => {
    vi.useFakeTimers();
    api.isInstalled.mockReturnValue(new Promise(() => {}));
    const availability = new GemWalletAdapter().isAvailable();

    await vi.advanceTimersByTimeAsync(TIME.AVAILABILITY_TIMEOUT);

    await expect(availability).resolves.toBe(false);
  });
});

describe('GemWalletAdapter.connect', () => {
  it('returns the account on success', async () => {
    api.isInstalled.mockResolvedValue({ result: { isInstalled: true } });
    api.getPublicKey.mockResolvedValue({ result: { address: 'rGem', publicKey: 'PK' } });

    const account = await new GemWalletAdapter().connect();

    expect(account.address).toBe('rGem');
    expect(account.publicKey).toBe('PK');
    expect(account.network.id).toBe('mainnet');
  });

  it('throws a wrapped connection error when not installed', async () => {
    api.isInstalled.mockResolvedValue({ result: { isInstalled: false } });
    await expect(new GemWalletAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });

  it('wraps user rejection into a connection error', async () => {
    api.isInstalled.mockResolvedValue({ result: { isInstalled: true } });
    api.getPublicKey.mockRejectedValue(new Error('User rejected request'));
    await expect(new GemWalletAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });

  it('fails within the availability timeout when the extension does not answer', async () => {
    vi.useFakeTimers();
    api.isInstalled.mockReturnValue(new Promise(() => {}));

    const rejection = expect(new GemWalletAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
    await vi.advanceTimersByTimeAsync(TIME.AVAILABILITY_TIMEOUT);

    await rejection;
    expect(api.getPublicKey).not.toHaveBeenCalled();
  });
});

describe('GemWalletAdapter.sign', () => {
  async function connected() {
    api.isInstalled.mockResolvedValue({ result: { isInstalled: true } });
    api.getPublicKey.mockResolvedValue({ result: { address: 'rGem', publicKey: 'PK' } });
    const adapter = new GemWalletAdapter();
    await adapter.connect();
    return adapter;
  }

  it('returns the signed tx blob on success', async () => {
    const adapter = await connected();
    api.signTransaction.mockResolvedValue({ result: { signature: 'SIG' } });

    const result = await adapter.sign({ TransactionType: 'Payment' } as never);

    expect(result.tx_blob).toBe('SIG');
  });

  it('throws notConnected when no session exists', async () => {
    const adapter = new GemWalletAdapter();
    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
  });

  it('maps rejection to sign-rejected', async () => {
    const adapter = await connected();
    api.signTransaction.mockRejectedValue(new Error('User Rejected'));

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });
  });
});

describe('GemWalletAdapter.disconnect', () => {
  it('clears the current account', async () => {
    api.isInstalled.mockResolvedValue({ result: { isInstalled: true } });
    api.getPublicKey.mockResolvedValue({ result: { address: 'rGem', publicKey: 'PK' } });
    const adapter = new GemWalletAdapter();
    await adapter.connect();
    expect(await adapter.getAccount()).not.toBeNull();

    await adapter.disconnect();

    expect(await adapter.getAccount()).toBeNull();
  });
});
