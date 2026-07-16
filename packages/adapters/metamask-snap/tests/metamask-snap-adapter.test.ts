// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalletErrorCode } from '@xrpl-connect/core';
import { MetaMaskSnapAdapter } from '../src/metamask-snap-adapter';

const SNAP_ID = 'npm:xrpl-snap';

/**
 * Build a mock EIP-1193 provider whose `wallet_invokeSnap` dispatches on the
 * inner snap request method. Pass per-method handlers/overrides.
 */
function mockProvider(opts: {
  isMetaMask?: boolean;
  getSnaps?: () => unknown;
  snapHandlers?: Record<string, (params?: unknown) => unknown>;
}) {
  const request = vi.fn(async (args: { method: string; params?: unknown }) => {
    switch (args.method) {
      case 'wallet_getSnaps':
        return (opts.getSnaps ?? (() => ({})))();
      case 'wallet_requestSnaps':
        return { [SNAP_ID]: {} };
      case 'wallet_invokeSnap': {
        const req = (args.params as { request: { method: string; params?: unknown } }).request;
        const handler = opts.snapHandlers?.[req.method];
        if (!handler) throw new Error(`unhandled snap method ${req.method}`);
        return handler(req.params);
      }
      default:
        throw new Error(`unhandled method ${args.method}`);
    }
  });
  return { isMetaMask: opts.isMetaMask ?? true, request };
}

function setProvider(provider: unknown) {
  (window as unknown as { ethereum?: unknown }).ethereum = provider;
}

beforeEach(() => {
  setProvider(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('MetaMaskSnapAdapter.isAvailable', () => {
  it('returns false when no provider is injected', async () => {
    await expect(new MetaMaskSnapAdapter().isAvailable()).resolves.toBe(false);
  });

  it('returns false when the provider is not MetaMask', async () => {
    setProvider(mockProvider({ isMetaMask: false }));
    await expect(new MetaMaskSnapAdapter().isAvailable()).resolves.toBe(false);
  });

  it('returns true when MetaMask supports Snaps', async () => {
    setProvider(mockProvider({}));
    await expect(new MetaMaskSnapAdapter().isAvailable()).resolves.toBe(true);
  });

  it('returns false when wallet_getSnaps throws', async () => {
    setProvider(
      mockProvider({
        getSnaps: () => {
          throw new Error('no snaps');
        },
      })
    );
    await expect(new MetaMaskSnapAdapter().isAvailable()).resolves.toBe(false);
  });
});

describe('MetaMaskSnapAdapter.connect', () => {
  it('returns the account on success', async () => {
    setProvider(
      mockProvider({
        snapHandlers: {
          xrpl_changeNetwork: () => ({}),
          xrpl_getActiveNetwork: () => ({ chainId: 1, name: 'Testnet', nodeUrl: '' }),
          xrpl_getAccount: () => ({ account: 'rSNAP', publicKey: 'PUBKEY' }),
        },
      })
    );
    const account = await new MetaMaskSnapAdapter().connect({ network: 'testnet' });
    expect(account.address).toBe('rSNAP');
    expect(account.publicKey).toBe('PUBKEY');
    expect(account.network.id).toBe('testnet');
  });

  it('throws WALLET_NOT_INSTALLED when MetaMask is absent', async () => {
    await expect(new MetaMaskSnapAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.WALLET_NOT_INSTALLED,
    });
  });

  it('maps a user rejection to CONNECTION_REJECTED', async () => {
    setProvider(
      mockProvider({
        snapHandlers: {
          xrpl_changeNetwork: () => ({}),
          xrpl_getActiveNetwork: () => ({ chainId: 0, name: 'Mainnet', nodeUrl: '' }),
          xrpl_getAccount: () => {
            throw new Error('User rejected the request');
          },
        },
      })
    );
    await expect(new MetaMaskSnapAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
    });
  });
});

describe('MetaMaskSnapAdapter signing', () => {
  async function connected(snapHandlers: Record<string, (params?: unknown) => unknown>) {
    setProvider(
      mockProvider({
        snapHandlers: {
          xrpl_changeNetwork: () => ({}),
          xrpl_getActiveNetwork: () => ({ chainId: 0, name: 'Mainnet', nodeUrl: '' }),
          xrpl_getAccount: () => ({ account: 'rSNAP', publicKey: 'PUBKEY' }),
          ...snapHandlers,
        },
      })
    );
    const adapter = new MetaMaskSnapAdapter();
    await adapter.connect();
    return adapter;
  }

  it('sign returns the hash and tx_blob', async () => {
    const adapter = await connected({
      xrpl_sign: () => ({ hash: 'HASH', tx_blob: 'BLOB' }),
    });
    const signed = await adapter.sign({ TransactionType: 'Payment' } as never);
    expect(signed).toEqual({ hash: 'HASH', tx_blob: 'BLOB' });
  });

  it('signAndSubmit returns the submitted hash', async () => {
    const adapter = await connected({
      xrpl_signAndSubmit: () => ({ result: { hash: 'SUBMITTED' } }),
    });
    const res = await adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
    expect(res.hash).toBe('SUBMITTED');
  });

  it('signMessage returns the signature and public key', async () => {
    const adapter = await connected({
      xrpl_signMessage: () => ({ signature: 'SIG' }),
    });
    const res = await adapter.signMessage('hello');
    expect(res).toEqual({ message: 'hello', signature: 'SIG', publicKey: 'PUBKEY' });
  });

  it('maps a signing rejection to SIGN_REJECTED', async () => {
    const adapter = await connected({
      xrpl_sign: () => {
        throw new Error('User rejected signing');
      },
    });
    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });
  });

  it('sign throws NOT_CONNECTED before connecting', async () => {
    await expect(
      new MetaMaskSnapAdapter().sign({ TransactionType: 'Payment' } as never)
    ).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
  });
});

describe('MetaMaskSnapAdapter network switching', () => {
  it('switches and verifies the active Snap network', async () => {
    let chainId = 0;
    setProvider(
      mockProvider({
        snapHandlers: {
          xrpl_getActiveNetwork: () => ({ chainId, name: 'Network', nodeUrl: '' }),
          xrpl_changeNetwork: (params) => {
            chainId = (params as { chainId: number }).chainId;
            return {};
          },
          xrpl_getAccount: () => ({ account: 'rSNAP', publicKey: 'PUBKEY' }),
        },
      })
    );
    const adapter = new MetaMaskSnapAdapter();
    await adapter.connect();

    await expect(adapter.switchNetwork('testnet')).resolves.toMatchObject({ id: 'testnet' });
    await expect(adapter.getNetwork()).resolves.toMatchObject({ id: 'testnet' });
  });

  it('does not hide a rejected network change during connect', async () => {
    setProvider(
      mockProvider({
        snapHandlers: {
          xrpl_getActiveNetwork: () => ({ chainId: 0, name: 'Mainnet', nodeUrl: '' }),
          xrpl_changeNetwork: () => {
            throw new Error('User rejected network change');
          },
        },
      })
    );

    await expect(new MetaMaskSnapAdapter().connect({ network: 'testnet' })).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
    });
  });
});
