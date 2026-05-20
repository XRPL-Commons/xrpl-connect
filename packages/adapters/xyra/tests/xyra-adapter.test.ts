import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalletErrorCode } from '@xrpl-connect/core';

const mockSdk = {
  connect: vi.fn(),
  sign: vi.fn(),
  signAndSubmit: vi.fn(),
  signMessage: vi.fn(),
  destroy: vi.fn(),
};

vi.mock('@xyrawallet/sdk', () => ({
  XyraSDK: vi.fn().mockImplementation(() => mockSdk),
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
});

describe('XyraAdapter.sign', () => {
  async function connected() {
    mockSdk.connect.mockResolvedValue({
      address: 'rXyraUser',
      publicKey: 'PK',
      network: 'xrpl-mainnet',
    });
    const adapter = new XyraAdapter();
    await adapter.connect();
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
  });

  it('maps a closed-popup error to sign-rejected', async () => {
    const adapter = await connected();
    mockSdk.sign.mockRejectedValue(new Error('Popup closed by user'));

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
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
    await adapter.connect();
    expect(await adapter.getAccount()).not.toBeNull();

    await adapter.disconnect();

    expect(await adapter.getAccount()).toBeNull();
  });
});
