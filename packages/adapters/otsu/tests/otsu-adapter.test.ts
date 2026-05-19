import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalletErrorCode } from '@xrpl-connect/core';
import { OtsuAdapter } from '../src/otsu-adapter';

function makeProvider(overrides: Record<string, unknown> = {}) {
  return {
    isOtsu: true,
    isConnected: vi.fn(() => false),
    connect: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getAddress: vi.fn(),
    getNetwork: vi.fn().mockResolvedValue({ network: 'mainnet' }),
    signTransaction: vi.fn(),
    signAndSubmit: vi.fn(),
    signMessage: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    ...overrides,
  };
}

function installProvider(provider: ReturnType<typeof makeProvider> | null) {
  const w = globalThis as unknown as { window?: unknown };
  if (provider) {
    w.window = { xrpl: provider };
  } else {
    w.window = {};
  }
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe('OtsuAdapter.isAvailable', () => {
  beforeEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('returns false in a non-browser environment', async () => {
    await expect(new OtsuAdapter().isAvailable()).resolves.toBe(false);
  });

  it('returns true when window exists', async () => {
    installProvider(makeProvider());
    await expect(new OtsuAdapter().isAvailable()).resolves.toBe(true);
  });
});

describe('OtsuAdapter.connect', () => {
  it('returns the account info on success', async () => {
    const provider = makeProvider({
      connect: vi.fn().mockResolvedValue({ address: 'rOtsuUser' }),
    });
    installProvider(provider);

    const account = await new OtsuAdapter().connect();

    expect(account.address).toBe('rOtsuUser');
    expect(account.network.id).toBe('mainnet');
    expect(provider.connect).toHaveBeenCalled();
  });

  it('throws notInstalled when the provider is not injected', async () => {
    installProvider(null);
    await expect(new OtsuAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.WALLET_NOT_INSTALLED,
    });
  });

  it('maps user rejection to a connection-rejected error', async () => {
    const provider = makeProvider({
      connect: vi.fn().mockRejectedValue(new Error('User rejected request')),
    });
    installProvider(provider);

    await expect(new OtsuAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
    });
  });
});

describe('OtsuAdapter.sign', () => {
  async function connected() {
    const provider = makeProvider({
      connect: vi.fn().mockResolvedValue({ address: 'rOtsuUser' }),
    });
    installProvider(provider);
    const adapter = new OtsuAdapter();
    await adapter.connect();
    return { adapter, provider };
  }

  it('throws notConnected before connect()', async () => {
    installProvider(makeProvider());
    const adapter = new OtsuAdapter();
    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
  });

  it('returns the signed transaction on success', async () => {
    const { adapter, provider } = await connected();
    provider.signTransaction.mockResolvedValue({ tx_blob: 'BLOB', hash: 'H' });

    const result = await adapter.sign({ TransactionType: 'Payment' } as never);

    expect(result.tx_blob).toBe('BLOB');
    expect(result.hash).toBe('H');
  });

  it('maps a user rejection to a sign-rejected error', async () => {
    const { adapter, provider } = await connected();
    provider.signTransaction.mockRejectedValue(new Error('User rejected the signing'));

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });
  });
});

describe('OtsuAdapter.disconnect', () => {
  it('calls provider.disconnect and clears state', async () => {
    const provider = makeProvider({
      connect: vi.fn().mockResolvedValue({ address: 'rOtsuUser' }),
    });
    installProvider(provider);
    const adapter = new OtsuAdapter();
    await adapter.connect();
    expect(await adapter.getAccount()).not.toBeNull();

    await adapter.disconnect();

    expect(provider.disconnect).toHaveBeenCalled();
    expect(await adapter.getAccount()).toBeNull();
  });
});
