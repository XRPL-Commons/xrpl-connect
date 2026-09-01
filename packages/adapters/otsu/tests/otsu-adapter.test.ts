import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { STANDARD_NETWORKS, WalletErrorCode } from '@xrpl-connect/core';
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

function emitProviderEvent(
  provider: ReturnType<typeof makeProvider>,
  event: string,
  data: unknown
) {
  const registration = provider.on.mock.calls.find(
    ([registeredEvent]) => registeredEvent === event
  );
  const callback = registration?.[1] as ((eventData: unknown) => void) | undefined;
  callback?.(data);
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

  it('returns false in a browser without an Otsu provider', async () => {
    installProvider(null);

    await expect(new OtsuAdapter().isAvailable()).resolves.toBe(false);
  });

  it('detects an Otsu provider injected after an earlier availability check', async () => {
    const adapter = new OtsuAdapter();
    installProvider(null);
    await expect(adapter.isAvailable()).resolves.toBe(false);

    installProvider(makeProvider());
    await expect(adapter.isAvailable()).resolves.toBe(true);
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

  it.each(['mainnet', 'testnet', 'devnet'] as const)(
    'uses the provider live %s network as the account network',
    async (network) => {
      const provider = makeProvider({
        connect: vi.fn().mockResolvedValue({ address: 'rOtsuUser' }),
        getNetwork: vi.fn().mockResolvedValue({ network }),
      });
      installProvider(provider);

      const account = await new OtsuAdapter().connect({ network });

      expect(account.network).toEqual(STANDARD_NETWORKS[network]);
    }
  );

  it('accepts an omitted network when the provider reports a supported live network', async () => {
    const provider = makeProvider({
      connect: vi.fn().mockResolvedValue({ address: 'rOtsuUser' }),
      getNetwork: vi.fn().mockResolvedValue({ network: 'devnet' }),
    });
    installProvider(provider);

    const account = await new OtsuAdapter().connect();

    expect(account.network).toEqual(STANDARD_NETWORKS.devnet);
  });

  it.each([
    ['custom', { id: 'custom', name: 'Custom', wss: 'wss://custom.example.com' }],
    ['unknown', 'sidechain'],
    ['prototype key', { id: 'toString', name: 'Custom', wss: 'wss://custom.example.com' }],
  ])(
    'rejects unsupported explicit network (%s) before connecting the provider',
    async (_name, network) => {
      const provider = makeProvider({
        connect: vi.fn().mockResolvedValue({ address: 'rOtsuUser' }),
      });
      installProvider(provider);

      await expect(new OtsuAdapter().connect({ network: network as never })).rejects.toMatchObject({
        code: WalletErrorCode.NETWORK_NOT_SUPPORTED,
      });
      expect(provider.connect).not.toHaveBeenCalled();
      expect(provider.getNetwork).not.toHaveBeenCalled();
    }
  );

  it('rejects a requested and live network mismatch before caching the account', async () => {
    const provider = makeProvider({
      connect: vi.fn().mockResolvedValue({ address: 'rOtsuUser' }),
      getNetwork: vi.fn().mockResolvedValue({ network: 'testnet' }),
    });
    installProvider(provider);
    const adapter = new OtsuAdapter();

    await expect(adapter.connect({ network: 'mainnet' })).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_MISMATCH,
    });
    await expect(adapter.getAccount()).resolves.toBeNull();
  });

  it('fails closed when the initial live network query fails', async () => {
    const provider = makeProvider({
      connect: vi.fn().mockResolvedValue({ address: 'rOtsuUser' }),
      getNetwork: vi.fn().mockRejectedValue(new Error('network unavailable')),
    });
    installProvider(provider);
    const adapter = new OtsuAdapter();

    await expect(adapter.connect({ network: 'testnet' })).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
    await expect(adapter.getAccount()).resolves.toBeNull();
  });

  it('rejects an unsupported live network with a typed error', async () => {
    const provider = makeProvider({
      connect: vi.fn().mockResolvedValue({ address: 'rOtsuUser' }),
      getNetwork: vi.fn().mockResolvedValue({ network: 'sidechain' }),
    });
    installProvider(provider);

    const adapter = new OtsuAdapter();
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_NOT_SUPPORTED,
    });
    await expect(adapter.getAccount()).resolves.toBeNull();
  });

  it.each([null, undefined, {}])(
    'rejects malformed live network response %j with a typed error',
    async (response) => {
      const provider = makeProvider({
        connect: vi.fn().mockResolvedValue({ address: 'rOtsuUser' }),
        getNetwork: vi.fn().mockResolvedValue(response),
      });
      installProvider(provider);

      await expect(new OtsuAdapter().connect()).rejects.toMatchObject({
        code: WalletErrorCode.NETWORK_NOT_SUPPORTED,
      });
    }
  );

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

describe('OtsuAdapter.fetchAccount', () => {
  it('queries the provider and replaces cached account and network data', async () => {
    const provider = makeProvider({
      isConnected: vi.fn(() => true),
      connect: vi.fn().mockResolvedValue({ address: 'rOriginal' }),
      getAddress: vi.fn().mockResolvedValue({ address: 'rFresh' }),
      getNetwork: vi.fn().mockResolvedValueOnce({ network: 'mainnet' }),
    });
    installProvider(provider);
    const adapter = new OtsuAdapter();
    await adapter.connect();
    provider.getNetwork.mockResolvedValue({ network: 'testnet' });

    const account = await adapter.fetchAccount();

    expect(provider.getAddress).toHaveBeenCalledTimes(1);
    expect(provider.getNetwork).toHaveBeenCalledTimes(2);
    expect(account).toEqual({
      address: 'rFresh',
      network: STANDARD_NETWORKS.testnet,
    });
    await expect(adapter.getAccount()).resolves.toEqual(account);
  });

  it('returns null and clears the cache when the provider is disconnected', async () => {
    const isConnected = vi.fn(() => true);
    const provider = makeProvider({
      isConnected,
      connect: vi.fn().mockResolvedValue({ address: 'rOriginal' }),
    });
    installProvider(provider);
    const adapter = new OtsuAdapter();
    await adapter.connect();
    isConnected.mockReturnValue(false);
    provider.getAddress.mockClear();
    provider.getNetwork.mockClear();

    await expect(adapter.fetchAccount()).resolves.toBeNull();
    expect(provider.getAddress).not.toHaveBeenCalled();
    expect(provider.getNetwork).not.toHaveBeenCalled();
    await expect(adapter.getAccount()).resolves.toBeNull();
  });

  it('rejects with a typed connection error when the live query fails', async () => {
    const provider = makeProvider({
      isConnected: vi.fn(() => true),
      connect: vi.fn().mockResolvedValue({ address: 'rOriginal' }),
      getAddress: vi.fn().mockRejectedValue(new Error('provider unavailable')),
    });
    installProvider(provider);
    const adapter = new OtsuAdapter();
    await adapter.connect();

    await expect(adapter.fetchAccount()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });

  it('maps unsupported live network data to a typed network error', async () => {
    const provider = makeProvider({
      isConnected: vi.fn(() => true),
      connect: vi.fn().mockResolvedValue({ address: 'rOriginal' }),
      getAddress: vi.fn().mockResolvedValue({ address: 'rFresh' }),
      getNetwork: vi
        .fn()
        .mockResolvedValueOnce({ network: 'mainnet' })
        .mockResolvedValue({ network: 'unsupported' }),
    });
    installProvider(provider);
    const adapter = new OtsuAdapter();
    await adapter.connect();

    await expect(adapter.fetchAccount()).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_NOT_SUPPORTED,
    });
    await expect(adapter.getAccount()).resolves.toMatchObject({ address: 'rOriginal' });
  });

  it('does not restore state when disconnected during a live query', async () => {
    let resolveAddress!: (value: unknown) => void;
    const provider = makeProvider({
      isConnected: vi.fn(() => true),
      connect: vi.fn().mockResolvedValue({ address: 'rOriginal' }),
      getAddress: vi.fn(() => new Promise((resolve) => (resolveAddress = resolve))),
    });
    installProvider(provider);
    const adapter = new OtsuAdapter();
    await adapter.connect();
    provider.getNetwork.mockClear();

    const fetching = adapter.fetchAccount();
    await adapter.disconnect();
    resolveAddress({ address: 'rLate' });

    await expect(fetching).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    await expect(adapter.getAccount()).resolves.toBeNull();
    expect(provider.getNetwork).not.toHaveBeenCalled();
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

  it('does not sign after the provider changes to another live network', async () => {
    const { adapter, provider } = await connected();
    provider.getNetwork.mockResolvedValue({ network: 'testnet' });
    provider.signTransaction.mockResolvedValue({ tx_blob: 'BLOB', hash: 'H' });

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_MISMATCH,
    });
    expect(provider.signTransaction).not.toHaveBeenCalled();
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

  it('does not let an older disconnect completion clear a newer connection', async () => {
    let releaseDisconnect!: () => void;
    const disconnectBlocked = new Promise<void>((resolve) => (releaseDisconnect = resolve));
    const provider = makeProvider({
      connect: vi.fn().mockResolvedValue({ address: 'rOtsuUser' }),
      disconnect: vi.fn(() => disconnectBlocked),
    });
    installProvider(provider);
    const adapter = new OtsuAdapter();
    await adapter.connect();

    const disconnecting = adapter.disconnect();
    await expect(adapter.getAccount()).resolves.toBeNull();
    await adapter.connect();
    releaseDisconnect();
    await disconnecting;

    await expect(adapter.getAccount()).resolves.toMatchObject({ address: 'rOtsuUser' });
  });
});

describe('OtsuAdapter provider events', () => {
  it('signals an error and preserves account state for an unknown network event', async () => {
    const provider = makeProvider({
      connect: vi.fn().mockResolvedValue({ address: 'rOtsuUser' }),
      getNetwork: vi.fn().mockResolvedValue({ network: 'mainnet' }),
    });
    installProvider(provider);
    const adapter = new OtsuAdapter();
    await adapter.connect();
    const accountBefore = await adapter.getAccount();
    const errorListener = vi.fn();
    const networkListener = vi.fn();
    adapter.on('error', errorListener);
    adapter.on('networkChanged', networkListener);

    emitProviderEvent(provider, 'networkChanged', { network: 'sidechain' });

    expect(errorListener).toHaveBeenCalledWith(
      expect.objectContaining({ code: WalletErrorCode.NETWORK_NOT_SUPPORTED })
    );
    expect(networkListener).not.toHaveBeenCalled();
    await expect(adapter.getAccount()).resolves.toEqual(accountBefore);
  });

  it.each([null, undefined, {}])(
    'signals an error and preserves account state for malformed network event %j',
    async (event) => {
      const provider = makeProvider({
        connect: vi.fn().mockResolvedValue({ address: 'rOtsuUser' }),
        getNetwork: vi.fn().mockResolvedValue({ network: 'mainnet' }),
      });
      installProvider(provider);
      const adapter = new OtsuAdapter();
      await adapter.connect();
      const accountBefore = await adapter.getAccount();
      const errorListener = vi.fn();
      const networkListener = vi.fn();
      adapter.on('error', errorListener);
      adapter.on('networkChanged', networkListener);

      emitProviderEvent(provider, 'networkChanged', event);

      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({ code: WalletErrorCode.NETWORK_NOT_SUPPORTED })
      );
      expect(networkListener).not.toHaveBeenCalled();
      await expect(adapter.getAccount()).resolves.toEqual(accountBefore);
    }
  );

  it('updates account state for a supported network event', async () => {
    const provider = makeProvider({
      connect: vi.fn().mockResolvedValue({ address: 'rOtsuUser' }),
      getNetwork: vi.fn().mockResolvedValue({ network: 'mainnet' }),
    });
    installProvider(provider);
    const adapter = new OtsuAdapter();
    await adapter.connect();

    emitProviderEvent(provider, 'networkChanged', { network: 'devnet' });

    await expect(adapter.getNetwork()).resolves.toEqual(STANDARD_NETWORKS.devnet);
  });
});
