import { afterEach, describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { TIME, WalletErrorCode } from '@xrpl-connect/core';

vi.mock('@gemwallet/api', () => ({
  isInstalled: vi.fn(),
  getNetwork: vi.fn(),
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
  api.getNetwork.mockReset();
  api.getPublicKey.mockReset();
  api.signMessage.mockReset();
  api.signTransaction.mockReset();
  api.submitTransaction.mockReset();
});

describe('GemWalletAdapter.fetchAccount', () => {
  async function connected() {
    api.isInstalled.mockResolvedValue({ result: { isInstalled: true } });
    api.getPublicKey.mockResolvedValue({
      result: { address: 'rOriginal', publicKey: 'ORIGINAL_PK' },
    });
    const adapter = new GemWalletAdapter();
    await adapter.connect();
    return adapter;
  }

  it('queries GemWallet and replaces cached account and network data', async () => {
    const adapter = await connected();
    api.getPublicKey.mockResolvedValue({ result: { address: 'rFresh', publicKey: 'FRESH_PK' } });
    api.getNetwork.mockResolvedValue({
      result: { chain: 'XRPL', network: 'Testnet', websocket: 'wss://fresh.example' },
    });

    const account = await adapter.fetchAccount();

    expect(api.getPublicKey).toHaveBeenCalledTimes(2);
    expect(api.getNetwork).toHaveBeenCalledTimes(1);
    expect(account).toEqual({
      address: 'rFresh',
      publicKey: 'FRESH_PK',
      network: { id: 'testnet', name: 'Testnet', wss: 'wss://fresh.example' },
    });
    await expect(adapter.getAccount()).resolves.toEqual(account);
  });

  it('treats an explicit GemWallet rejection as an error and preserves the cache', async () => {
    const adapter = await connected();
    api.getPublicKey.mockResolvedValue({ type: 'reject', result: undefined });

    await expect(adapter.fetchAccount()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
    });
    expect(api.getNetwork).not.toHaveBeenCalled();
    await expect(adapter.getAccount()).resolves.toMatchObject({ address: 'rOriginal' });
  });

  it('rejects with a typed connection error when the live query fails', async () => {
    const adapter = await connected();
    api.getPublicKey.mockRejectedValue(new Error('extension unavailable'));

    await expect(adapter.fetchAccount()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });

  it('does not restore state when disconnected during a live query', async () => {
    const adapter = await connected();
    let resolveAccount!: (value: unknown) => void;
    api.getPublicKey.mockImplementation(() => new Promise((resolve) => (resolveAccount = resolve)));

    const fetching = adapter.fetchAccount();
    await adapter.disconnect();
    resolveAccount({ result: { address: 'rLate', publicKey: 'LATE_PK' } });

    await expect(fetching).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    await expect(adapter.getAccount()).resolves.toBeNull();
    expect(api.getNetwork).not.toHaveBeenCalled();
  });

  it('does not let an older concurrent refresh overwrite a newer one', async () => {
    const adapter = await connected();
    let resolveFirst!: (value: unknown) => void;
    let resolveSecond!: (value: unknown) => void;
    api.getPublicKey
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));
    api.getNetwork.mockResolvedValue({
      result: { chain: 'XRPL', network: 'Testnet', websocket: 'wss://testnet.example' },
    });

    const first = adapter.fetchAccount();
    const second = adapter.fetchAccount();
    resolveSecond({ result: { address: 'rNewer', publicKey: 'NEWER_PK' } });
    await expect(second).resolves.toMatchObject({ address: 'rNewer' });
    resolveFirst({ result: { address: 'rOlder', publicKey: 'OLDER_PK' } });

    await expect(first).resolves.toMatchObject({ address: 'rNewer' });
    await expect(adapter.getAccount()).resolves.toMatchObject({ address: 'rNewer' });
  });
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

  it('preserves the typed not-installed error', async () => {
    api.isInstalled.mockResolvedValue({ result: { isInstalled: false } });
    await expect(new GemWalletAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.WALLET_NOT_INSTALLED,
    });
  });

  it('maps user rejection to a connection-rejected error', async () => {
    api.isInstalled.mockResolvedValue({ result: { isInstalled: true } });
    api.getPublicKey.mockRejectedValue(new Error('User rejected request'));
    await expect(new GemWalletAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
    });
  });

  it('maps an explicit rejection response to a connection-rejected error', async () => {
    api.isInstalled.mockResolvedValue({ result: { isInstalled: true } });
    api.getPublicKey.mockResolvedValue({ type: 'reject' });

    await expect(new GemWalletAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
    });
  });

  it('preserves the typed not-installed error after the availability timeout', async () => {
    vi.useFakeTimers();
    api.isInstalled.mockReturnValue(new Promise(() => {}));

    const rejection = expect(new GemWalletAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.WALLET_NOT_INSTALLED,
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

  it('maps explicit rejection responses from every signing method to sign-rejected', async () => {
    const adapter = await connected();
    api.signTransaction.mockResolvedValue({ type: 'reject' });
    api.submitTransaction.mockResolvedValue({ type: 'reject' });
    api.signMessage.mockResolvedValue({ type: 'reject' });

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });
    await expect(
      adapter.signAndSubmit({ TransactionType: 'Payment' } as never)
    ).rejects.toMatchObject({ code: WalletErrorCode.SIGN_REJECTED });
    await expect(adapter.signMessage('hello')).rejects.toMatchObject({
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
