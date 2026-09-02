// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
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

  it('discovers MetaMask through EIP-6963 when another wallet owns window.ethereum', async () => {
    const legacy = mockProvider({ isMetaMask: false });
    const metamask = mockProvider({});
    setProvider(legacy);
    const announce = () => {
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: { info: { rdns: 'io.metamask' }, provider: metamask },
        })
      );
    };
    window.addEventListener('eip6963:requestProvider', announce);

    try {
      await expect(new MetaMaskSnapAdapter().isAvailable()).resolves.toBe(true);
      expect(metamask.request).toHaveBeenCalledWith({ method: 'wallet_getSnaps' });
      expect(legacy.request).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('eip6963:requestProvider', announce);
    }
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

  it('does not restore account state when disconnected during account approval', async () => {
    let resolveAccount!: (value: unknown) => void;
    setProvider(
      mockProvider({
        snapHandlers: {
          xrpl_changeNetwork: () => ({}),
          xrpl_getActiveNetwork: () => ({ chainId: 0, name: 'Mainnet', nodeUrl: '' }),
          xrpl_getAccount: () => new Promise((resolve) => (resolveAccount = resolve)),
        },
      })
    );
    const adapter = new MetaMaskSnapAdapter();

    const connecting = adapter.connect();
    await vi.waitFor(() => expect(resolveAccount).toBeTypeOf('function'));
    await adapter.disconnect();
    resolveAccount({ account: 'rLate', publicKey: 'LATE_PK' });

    await expect(connecting).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    await expect(adapter.getAccount()).resolves.toBeNull();
  });

  it('rejects an unknown active Snap network with a typed error', async () => {
    setProvider(
      mockProvider({
        snapHandlers: {
          xrpl_getActiveNetwork: () => ({ chainId: 999, name: 'Unknown', nodeUrl: '' }),
        },
      })
    );
    const adapter = new MetaMaskSnapAdapter();

    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_NOT_SUPPORTED,
    });
    await expect(adapter.getAccount()).resolves.toBeNull();
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

  it('clears the cached session when reconnect fails after changing networks', async () => {
    let chainId = 0;
    let accountRequests = 0;
    setProvider(
      mockProvider({
        snapHandlers: {
          xrpl_getActiveNetwork: () => ({ chainId, name: 'Network', nodeUrl: '' }),
          xrpl_changeNetwork: (params) => {
            chainId = (params as { chainId: number }).chainId;
            return {};
          },
          xrpl_getAccount: () => {
            accountRequests += 1;
            if (accountRequests > 1) throw new Error('Account request failed');
            return { account: 'rSNAP', publicKey: 'PUBKEY' };
          },
        },
      })
    );
    const adapter = new MetaMaskSnapAdapter();
    await adapter.connect();

    await expect(adapter.connect({ network: 'testnet' })).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
    await expect(adapter.getAccount()).resolves.toBeNull();
    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
  });

  it('rejects an unsupported runtime network id before requesting the Snap', async () => {
    const provider = mockProvider({});
    setProvider(provider);

    await expect(
      new MetaMaskSnapAdapter().connect({ network: 'sidechain' as never })
    ).rejects.toMatchObject({ code: WalletErrorCode.NETWORK_NOT_SUPPORTED });
    expect(provider.request).not.toHaveBeenCalled();
  });

  it('rejects when MetaMask does not apply the requested network', async () => {
    setProvider(
      mockProvider({
        snapHandlers: {
          xrpl_changeNetwork: () => ({}),
          xrpl_getActiveNetwork: () => ({ chainId: 0, name: 'Mainnet', nodeUrl: '' }),
        },
      })
    );

    await expect(new MetaMaskSnapAdapter().connect({ network: 'testnet' })).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_MISMATCH,
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

  it('does not sign or submit after the active Snap network changes', async () => {
    let chainId = 0;
    const sign = vi.fn(() => ({ hash: 'HASH', tx_blob: 'BLOB' }));
    const submit = vi.fn(() => ({
      result: { engine_result: 'tesSUCCESS', tx_json: { hash: 'SUBMITTED' } },
    }));
    setProvider(
      mockProvider({
        snapHandlers: {
          xrpl_getActiveNetwork: () => ({ chainId, name: 'Network', nodeUrl: '' }),
          xrpl_getAccount: () => ({ account: 'rSNAP', publicKey: 'PUBKEY' }),
          xrpl_sign: sign,
          xrpl_signAndSubmit: submit,
        },
      })
    );
    const adapter = new MetaMaskSnapAdapter();
    await adapter.connect();
    chainId = 1;

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_MISMATCH,
    });
    await expect(
      adapter.signAndSubmit({ TransactionType: 'Payment' } as never)
    ).rejects.toMatchObject({ code: WalletErrorCode.NETWORK_MISMATCH });
    expect(sign).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('signAndSubmit returns the submitted hash', async () => {
    const adapter = await connected({
      xrpl_signAndSubmit: () => ({
        result: { engine_result: 'tesSUCCESS', tx_json: { hash: 'SUBMITTED' } },
      }),
    });
    const res = await adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
    expect(res.hash).toBe('SUBMITTED');
  });

  it('returns the hash when the ledger queues a submitted transaction', async () => {
    const adapter = await connected({
      xrpl_signAndSubmit: () => ({
        result: { engine_result: 'terQUEUED', tx_json: { hash: 'QUEUED' } },
      }),
    });

    await expect(adapter.signAndSubmit({ TransactionType: 'Payment' } as never)).resolves.toEqual({
      hash: 'QUEUED',
    });
  });

  it('rejects a ledger submission failure instead of reporting success', async () => {
    const adapter = await connected({
      xrpl_signAndSubmit: () => ({
        result: {
          engine_result: 'tecUNFUNDED_PAYMENT',
          engine_result_message: 'Insufficient XRP balance',
          tx_json: { hash: 'REJECTED' },
        },
      }),
    });

    await expect(
      adapter.signAndSubmit({ TransactionType: 'Payment' } as never)
    ).rejects.toMatchObject({ code: WalletErrorCode.SIGN_FAILED });
  });

  it('rejects a malformed successful response without a transaction hash', async () => {
    const adapter = await connected({
      xrpl_signAndSubmit: () => ({ result: { engine_result: 'tesSUCCESS', tx_json: {} } }),
    });

    await expect(
      adapter.signAndSubmit({ TransactionType: 'Payment' } as never)
    ).rejects.toMatchObject({ code: WalletErrorCode.SIGN_FAILED });
  });

  it('signMessage returns the signature and public key', async () => {
    const adapter = await connected({
      xrpl_signMessage: () => ({ signature: 'SIG' }),
    });
    const res = await adapter.signMessage('hello');
    expect(res).toEqual({ message: 'hello', signature: 'SIG', publicKey: 'PUBKEY' });
  });

  it('rejects invalid UTF-8 bytes before invoking the Snap', async () => {
    const signMessage = vi.fn(() => ({ signature: 'SIG' }));
    const adapter = await connected({ xrpl_signMessage: signMessage });

    await expect(adapter.signMessage(Uint8Array.from([0xc3, 0x28]))).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    expect(signMessage).not.toHaveBeenCalled();
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
  it('rejects custom ids that collide with object prototype keys', async () => {
    const changeNetwork = vi.fn();
    setProvider(
      mockProvider({
        snapHandlers: {
          xrpl_getActiveNetwork: () => ({ chainId: 0, name: 'Mainnet', nodeUrl: '' }),
          xrpl_changeNetwork: changeNetwork,
        },
      })
    );

    await expect(
      new MetaMaskSnapAdapter().connect({
        network: { id: 'toString', name: 'Custom', wss: 'wss://custom.example.com' },
      })
    ).rejects.toMatchObject({ code: WalletErrorCode.NETWORK_NOT_SUPPORTED });
    expect(changeNetwork).not.toHaveBeenCalled();
  });

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
