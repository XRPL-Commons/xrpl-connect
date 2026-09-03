import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { WalletErrorCode } from '@xrpl-connect/core';

const mockSdk = {
  connect: vi.fn(),
  sign: vi.fn(),
  signAndSubmit: vi.fn(),
  signMessage: vi.fn(),
  destroy: vi.fn(),
};

vi.mock('@xyrawallet/sdk', () => ({
  XyraSDK: vi.fn().mockImplementation(function () {
    return mockSdk;
  }),
}));

import { XyraAdapter } from '../src/xyra-adapter';

beforeEach(() => {
  mockSdk.connect.mockReset();
  mockSdk.sign.mockReset();
  mockSdk.signAndSubmit.mockReset();
  mockSdk.signMessage.mockReset();
  mockSdk.destroy.mockReset();
});

function installWindow(value: unknown) {
  const w = globalThis as unknown as { window?: unknown };
  if (value === undefined) {
    delete w.window;
  } else {
    w.window = value;
  }
}

afterEach(() => {
  installWindow(undefined);
});

describe('XyraAdapter.isAvailable', () => {
  it('returns false in a non-browser environment', async () => {
    installWindow(undefined);
    await expect(new XyraAdapter().isAvailable()).resolves.toBe(false);
  });

  it('returns true when window.open is available', async () => {
    installWindow({ open: vi.fn() });
    await expect(new XyraAdapter().isAvailable()).resolves.toBe(true);
  });

  it('returns false when window.open is not a function', async () => {
    installWindow({});
    await expect(new XyraAdapter().isAvailable()).resolves.toBe(false);
  });
});

describe('XyraAdapter.connect', () => {
  it('returns account info on success', async () => {
    mockSdk.connect.mockResolvedValue({
      address: 'rXyraUser',
      publicKey: 'PK',
      network: 'xrpl-mainnet',
    });

    const account = await new XyraAdapter().connect({ network: 'mainnet' });

    expect(account.address).toBe('rXyraUser');
    expect(account.publicKey).toBe('PK');
    expect(account.network.id).toBe('mainnet');
  });

  it('maps an explicit testnet request without substitution', async () => {
    mockSdk.connect.mockResolvedValue({
      address: 'rXyraUser',
      publicKey: 'PK',
      network: 'xrpl-testnet',
    });

    const account = await new XyraAdapter().connect({ network: 'testnet' });

    expect(account.network.id).toBe('testnet');
    expect(mockSdk.connect).toHaveBeenCalledWith({ network: 'xrpl-testnet' });
  });

  it('defaults an omitted network to testnet and verifies the SDK response', async () => {
    mockSdk.connect.mockResolvedValue({
      address: 'rXyraUser',
      publicKey: 'PK',
      network: 'xrpl-testnet',
    });

    const account = await new XyraAdapter().connect();

    expect(mockSdk.connect).toHaveBeenCalledWith({ network: 'xrpl-testnet' });
    expect(account.network.id).toBe('testnet');
  });

  it.each([
    ['devnet', 'devnet'],
    ['custom', { id: 'custom', name: 'Custom', wss: 'wss://custom.example.com' }],
    ['prototype key', { id: 'toString', name: 'Custom', wss: 'wss://custom.example.com' }],
  ])('rejects unsupported explicit network (%s) before opening the SDK', async (_name, network) => {
    await expect(new XyraAdapter().connect({ network: network as never })).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_NOT_SUPPORTED,
    });
    expect(mockSdk.connect).not.toHaveBeenCalled();
  });

  it('rejects an unknown SDK response network without caching an account', async () => {
    mockSdk.connect.mockResolvedValue({
      address: 'rXyraUser',
      publicKey: 'PK',
      network: 'xrpl-sidechain',
    });

    const adapter = new XyraAdapter();
    await expect(adapter.connect({ network: 'testnet' })).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_NOT_SUPPORTED,
    });
    await expect(adapter.getAccount()).resolves.toBeNull();
  });

  it('rejects a known SDK response that differs from the selected network', async () => {
    mockSdk.connect.mockResolvedValue({
      address: 'rXyraUser',
      publicKey: 'PK',
      network: 'xrpl-testnet',
    });

    const adapter = new XyraAdapter();
    await expect(adapter.connect({ network: 'mainnet' })).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_MISMATCH,
    });
    await expect(adapter.getAccount()).resolves.toBeNull();
  });

  it('maps a closed-popup error to connection-rejected', async () => {
    mockSdk.connect.mockRejectedValue(new Error('User closed popup'));

    await expect(new XyraAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
    });
  });

  it('falls back to a generic connection error for other failures', async () => {
    mockSdk.connect.mockRejectedValue(new Error('something exploded'));

    await expect(new XyraAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });

  it('does not restore state when a pending connection resolves after disconnect', async () => {
    let resolveConnect!: (value: {
      address: string;
      publicKey: string;
      network: 'xrpl-mainnet';
    }) => void;
    mockSdk.connect.mockReturnValue(
      new Promise((resolve) => {
        resolveConnect = resolve;
      })
    );
    const adapter = new XyraAdapter();
    const connectEvent = vi.fn();
    adapter.on('connect', connectEvent);

    const connection = adapter.connect({ network: 'mainnet' });
    await vi.waitFor(() => expect(mockSdk.connect).toHaveBeenCalledOnce());
    await adapter.disconnect();
    resolveConnect({ address: 'rStale', publicKey: 'PK', network: 'xrpl-mainnet' });

    await expect(connection).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    await expect(adapter.getAccount()).resolves.toBeNull();
    expect(connectEvent).not.toHaveBeenCalled();
  });

  it('destroys an SDK that finishes initializing after the adapter is destroyed', async () => {
    const adapter = new XyraAdapter();
    const connection = adapter.connect();

    adapter.destroy();

    await expect(connection).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
    expect(mockSdk.destroy).toHaveBeenCalledOnce();
  });
});

describe('XyraAdapter.sign', () => {
  async function connected() {
    mockSdk.connect.mockResolvedValue({
      address: 'rXyraUser',
      publicKey: 'PK',
      network: 'xrpl-mainnet',
    });
    const adapter = new XyraAdapter();
    await adapter.connect({ network: 'mainnet' });
    return adapter;
  }

  it('throws notConnected before any session is open', async () => {
    const adapter = new XyraAdapter();
    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
  });

  it('returns the signed payload on success', async () => {
    const adapter = await connected();
    mockSdk.sign.mockResolvedValue({ tx_blob: 'BLOB', hash: 'HASH' });

    const result = await adapter.sign({ TransactionType: 'Payment' } as never);

    expect(result.tx_blob).toBe('BLOB');
    expect(result.hash).toBe('HASH');
    expect(mockSdk.sign).toHaveBeenCalledWith(expect.objectContaining({ network: 'xrpl-mainnet' }));
  });

  it('maps a closed-popup error to sign-rejected', async () => {
    const adapter = await connected();
    mockSdk.sign.mockRejectedValue(new Error('Popup closed by user'));

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });
  });
});

describe('XyraAdapter.signMessage', () => {
  it('preserves the signer address reported by Xyra', async () => {
    mockSdk.connect.mockResolvedValue({
      address: 'rConnected',
      publicKey: 'CONNECTED_PK',
      network: 'xrpl-mainnet',
    });
    mockSdk.signMessage.mockResolvedValue({
      address: 'rSigner',
      message: 'hello',
      signature: 'SIG',
      publicKey: 'SIGNER_PK',
    });
    const adapter = new XyraAdapter();
    await adapter.connect({ network: 'mainnet' });

    await expect(adapter.signMessage('hello')).resolves.toMatchObject({
      signerAddress: 'rSigner',
      message: 'hello',
      signature: 'SIG',
      publicKey: 'SIGNER_PK',
    });
  });
});

describe('XyraAdapter.disconnect', () => {
  it('clears local state', async () => {
    mockSdk.connect.mockResolvedValue({
      address: 'rXyraUser',
      publicKey: 'PK',
      network: 'xrpl-mainnet',
    });
    const adapter = new XyraAdapter();
    await adapter.connect({ network: 'mainnet' });
    expect(await adapter.getAccount()).not.toBeNull();

    await adapter.disconnect();

    expect(await adapter.getAccount()).toBeNull();
  });
});
