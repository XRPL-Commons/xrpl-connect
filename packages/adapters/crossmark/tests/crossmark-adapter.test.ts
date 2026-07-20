import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { WalletErrorCode } from '@xrpl-connect/core';

vi.mock('@crossmarkio/sdk', () => {
  const sdk = {
    sync: { isInstalled: vi.fn() },
    api: { awaitRequest: vi.fn() },
    methods: {
      signInAndWait: vi.fn(),
      signAndWait: vi.fn(),
      signAndSubmitAndWait: vi.fn(),
    },
  };
  return {
    default: sdk,
    typings: { COMMANDS: { ADDRESS: 'address', NETWORK: 'network' } },
  };
});

import sdkDefault from '@crossmarkio/sdk';
import { CrossmarkAdapter } from '../src/crossmark-adapter';

const sdk = sdkDefault as unknown as {
  sync: { isInstalled: ReturnType<typeof vi.fn> };
  api: { awaitRequest: ReturnType<typeof vi.fn> };
  methods: {
    signInAndWait: ReturnType<typeof vi.fn>;
    signAndWait: ReturnType<typeof vi.fn>;
    signAndSubmitAndWait: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  sdk.sync.isInstalled.mockReset();
  sdk.api.awaitRequest.mockReset();
  sdk.methods.signInAndWait.mockReset();
  sdk.methods.signAndWait.mockReset();
  sdk.methods.signAndSubmitAndWait.mockReset();
});

describe('CrossmarkAdapter.fetchAccount', () => {
  async function connected() {
    sdk.sync.isInstalled.mockReturnValue(true);
    sdk.methods.signInAndWait.mockResolvedValue({
      response: { data: { address: 'rOriginal', publicKey: 'ORIGINAL_PK' } },
    });
    const adapter = new CrossmarkAdapter();
    await adapter.connect();
    return adapter;
  }

  it('queries Crossmark and replaces cached account and network data', async () => {
    const adapter = await connected();
    sdk.api.awaitRequest.mockImplementation(({ command }: { command: string }) => {
      if (command === 'address') {
        return Promise.resolve({ response: { data: { address: 'rFresh' } } });
      }
      return Promise.resolve({
        response: {
          data: {
            network: {
              protocol: 'xrpl',
              type: 'testnet',
              label: 'xrp ledger',
              wss: 'wss://fresh.example',
              rpc: 'https://fresh.example',
            },
          },
        },
      });
    });

    const account = await adapter.fetchAccount();

    expect(sdk.api.awaitRequest).toHaveBeenCalledWith({ command: 'address' });
    expect(sdk.api.awaitRequest).toHaveBeenCalledWith({ command: 'network' });
    expect(account).toEqual({
      address: 'rFresh',
      publicKey: undefined,
      network: {
        id: 'testnet',
        name: 'Testnet',
        wss: 'wss://fresh.example',
        rpc: 'https://fresh.example',
      },
    });
    await expect(adapter.getAccount()).resolves.toEqual(account);
  });

  it('keeps Xahau network IDs distinct from XRPL mainnet', async () => {
    const adapter = await connected();
    sdk.api.awaitRequest.mockImplementation(({ command }: { command: string }) => {
      if (command === 'address') {
        return Promise.resolve({ response: { data: { address: 'rXahau' } } });
      }
      return Promise.resolve({
        response: {
          data: {
            network: {
              protocol: 'xrpl',
              type: 'mainnet',
              label: 'xahau',
              wss: 'wss://xahau.network',
            },
          },
        },
      });
    });

    await expect(adapter.fetchAccount()).resolves.toMatchObject({
      network: { id: 'xahau-mainnet', name: 'xahau mainnet' },
    });
  });

  it('returns null and clears the cache when Crossmark has no active account', async () => {
    const adapter = await connected();
    sdk.api.awaitRequest.mockImplementation(({ command }: { command: string }) =>
      Promise.resolve(
        command === 'address'
          ? { response: { data: { address: '' } } }
          : {
              response: {
                data: {
                  network: {
                    protocol: 'xrpl',
                    type: 'mainnet',
                    label: 'xrp ledger',
                    wss: 'wss://mainnet.example',
                  },
                },
              },
            }
      )
    );

    await expect(adapter.fetchAccount()).resolves.toBeNull();
    expect(sdk.api.awaitRequest).toHaveBeenCalledTimes(1);
    await expect(adapter.getAccount()).resolves.toBeNull();
  });

  it('rejects with a typed connection error when the live query fails', async () => {
    const adapter = await connected();
    sdk.api.awaitRequest.mockRejectedValue(new Error('extension unavailable'));

    await expect(adapter.fetchAccount()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });

  it('does not restore state when disconnected during a live query', async () => {
    const adapter = await connected();
    let resolveAddress!: (value: unknown) => void;
    sdk.api.awaitRequest.mockImplementation(
      () => new Promise((resolve) => (resolveAddress = resolve))
    );

    const fetching = adapter.fetchAccount();
    await adapter.disconnect();
    resolveAddress({ response: { data: { address: 'rLate' } } });

    await expect(fetching).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    await expect(adapter.getAccount()).resolves.toBeNull();
    expect(sdk.api.awaitRequest).toHaveBeenCalledTimes(1);
  });

  it('does not let an older concurrent refresh overwrite a newer one', async () => {
    const adapter = await connected();
    let resolveFirst!: (value: unknown) => void;
    let resolveSecond!: (value: unknown) => void;
    sdk.api.awaitRequest
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)))
      .mockResolvedValue({
        response: {
          data: {
            network: {
              protocol: 'xrpl',
              type: 'testnet',
              label: 'xrp ledger',
              wss: 'wss://testnet.example',
            },
          },
        },
      });

    const first = adapter.fetchAccount();
    const second = adapter.fetchAccount();
    resolveSecond({ response: { data: { address: 'rNewer' } } });
    await expect(second).resolves.toMatchObject({ address: 'rNewer' });
    resolveFirst({ response: { data: { address: 'rOlder' } } });

    await expect(first).resolves.toMatchObject({ address: 'rNewer' });
    await expect(adapter.getAccount()).resolves.toMatchObject({ address: 'rNewer' });
  });
});

describe('CrossmarkAdapter.isAvailable', () => {
  it('returns true when the extension reports installed', async () => {
    sdk.sync.isInstalled.mockReturnValue(true);
    const adapter = new CrossmarkAdapter();
    await expect(adapter.isAvailable()).resolves.toBe(true);
  });

  it('returns false when the extension reports not installed', async () => {
    sdk.sync.isInstalled.mockReturnValue(false);
    const adapter = new CrossmarkAdapter();
    await expect(adapter.isAvailable()).resolves.toBe(false);
  });

  it('returns false when the underlying check throws', async () => {
    sdk.sync.isInstalled.mockImplementation(() => {
      throw new Error('boom');
    });
    const adapter = new CrossmarkAdapter();
    await expect(adapter.isAvailable()).resolves.toBe(false);
  });
});

describe('CrossmarkAdapter.connect', () => {
  it('returns account info on success', async () => {
    sdk.sync.isInstalled.mockReturnValue(true);
    sdk.methods.signInAndWait.mockResolvedValue({
      response: { data: { address: 'rUserAddress', publicKey: 'PUBKEY' } },
    });

    const adapter = new CrossmarkAdapter();
    const account = await adapter.connect();

    expect(account.address).toBe('rUserAddress');
    expect(account.publicKey).toBe('PUBKEY');
    expect(account.network.id).toBe('mainnet');
  });

  it('wraps "not installed" into a connection error', async () => {
    sdk.sync.isInstalled.mockReturnValue(false);
    const adapter = new CrossmarkAdapter();

    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });

  it('wraps user rejection into a connection error', async () => {
    sdk.sync.isInstalled.mockReturnValue(true);
    sdk.methods.signInAndWait.mockRejectedValue(new Error('User rejected'));
    const adapter = new CrossmarkAdapter();

    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });
});

describe('CrossmarkAdapter.sign', () => {
  async function connected() {
    sdk.sync.isInstalled.mockReturnValue(true);
    sdk.methods.signInAndWait.mockResolvedValue({
      response: { data: { address: 'rUser', publicKey: 'PK' } },
    });
    const adapter = new CrossmarkAdapter();
    await adapter.connect();
    return adapter;
  }

  it('returns tx_blob on success', async () => {
    const adapter = await connected();
    sdk.methods.signAndWait.mockResolvedValue({
      response: { data: { txBlob: 'DEADBEEF' } },
    });

    const result = await adapter.sign({ TransactionType: 'Payment' } as never);

    expect(result.tx_blob).toBe('DEADBEEF');
  });

  it('throws notConnected when no account is set', async () => {
    const adapter = new CrossmarkAdapter();
    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
  });

  it('maps user rejection to a sign-rejected error', async () => {
    const adapter = await connected();
    sdk.methods.signAndWait.mockRejectedValue(new Error('User Rejected the signature'));

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });
  });
});

describe('CrossmarkAdapter.disconnect', () => {
  it('clears the connected account', async () => {
    sdk.sync.isInstalled.mockReturnValue(true);
    sdk.methods.signInAndWait.mockResolvedValue({
      response: { data: { address: 'rUser', publicKey: 'PK' } },
    });
    const adapter = new CrossmarkAdapter();
    await adapter.connect();
    expect(await adapter.getAccount()).not.toBeNull();

    await adapter.disconnect();

    expect(await adapter.getAccount()).toBeNull();
  });
});
