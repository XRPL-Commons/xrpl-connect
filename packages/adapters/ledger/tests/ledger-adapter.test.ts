import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalletErrorCode } from '@xrpl-connect/core';

const mocks = vi.hoisted(() => {
  const transportWebHID = { create: vi.fn() };
  const transportWebUSB = { create: vi.fn() };
  const mockTransport = { close: vi.fn().mockResolvedValue(undefined) };
  const xrpAppInstance = {
    getAddress: vi.fn(),
    signTransaction: vi.fn(),
  };
  return { transportWebHID, transportWebUSB, mockTransport, xrpAppInstance };
});

const { transportWebHID, transportWebUSB, mockTransport, xrpAppInstance } = mocks;

vi.mock('@ledgerhq/hw-transport-webhid', () => ({
  default: mocks.transportWebHID,
}));

vi.mock('@ledgerhq/hw-transport-webusb', () => ({
  default: mocks.transportWebUSB,
}));

vi.mock('@ledgerhq/hw-app-xrp', () => ({
  default: vi.fn().mockImplementation(() => mocks.xrpAppInstance),
}));

vi.mock('xrpl', () => ({
  encode: vi.fn(() => 'encodedblob'),
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    autofill: vi.fn(async (tx) => ({ ...tx, Sequence: 1, Fee: '10' })),
    submitAndWait: vi.fn().mockResolvedValue({ result: { hash: 'HASH' } }),
  })),
}));

import { LedgerAdapter } from '../src/ledger-adapter';

function installNavigator(value: Record<string, unknown> | undefined) {
  if (value === undefined) {
    vi.unstubAllGlobals();
  } else {
    vi.stubGlobal('navigator', value);
  }
}

beforeEach(() => {
  transportWebHID.create.mockReset();
  transportWebUSB.create.mockReset();
  xrpAppInstance.getAddress.mockReset();
  xrpAppInstance.signTransaction.mockReset();
  transportWebHID.create.mockResolvedValue(mockTransport);
  transportWebUSB.create.mockResolvedValue(mockTransport);
});

afterEach(() => {
  installNavigator(undefined);
});

describe('LedgerAdapter.isAvailable', () => {
  it('returns true when WebHID is supported', async () => {
    installNavigator({ hid: {} });
    await expect(new LedgerAdapter().isAvailable()).resolves.toBe(true);
  });

  it('returns true when only WebUSB is supported', async () => {
    installNavigator({ usb: {} });
    await expect(new LedgerAdapter().isAvailable()).resolves.toBe(true);
  });

  it('returns false when neither WebHID nor WebUSB is available', async () => {
    installNavigator({});
    await expect(new LedgerAdapter().isAvailable()).resolves.toBe(false);
  });
});

describe('LedgerAdapter.connect', () => {
  it('returns account info on success', async () => {
    installNavigator({ hid: {} });
    xrpAppInstance.getAddress.mockResolvedValue({
      address: 'rLedger',
      publicKey: 'aabbcc',
    });

    const account = await new LedgerAdapter().connect();

    expect(account.address).toBe('rLedger');
    expect(account.network.id).toBe('mainnet');
  });

  it('wraps "no device" errors as not-installed', async () => {
    installNavigator({ hid: {} });
    xrpAppInstance.getAddress.mockRejectedValue(new Error('No device found'));

    await expect(new LedgerAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.WALLET_NOT_INSTALLED,
    });
  });

  it('wraps user rejection (statusCode 0x6985) as a connection failure', async () => {
    installNavigator({ hid: {} });
    const rejected = Object.assign(new Error('rejected'), { statusCode: 0x6985 });
    xrpAppInstance.getAddress.mockRejectedValue(rejected);

    await expect(new LedgerAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });
});

describe('LedgerAdapter.sign', () => {
  async function connected() {
    installNavigator({ hid: {} });
    xrpAppInstance.getAddress.mockResolvedValue({
      address: 'rLedger',
      publicKey: 'aabbcc',
    });
    const adapter = new LedgerAdapter();
    await adapter.connect();
    return adapter;
  }

  it('throws notConnected when no account is set', async () => {
    installNavigator({ hid: {} });
    const adapter = new LedgerAdapter();
    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      // The adapter wraps the underlying notConnected in signFailed
      code: WalletErrorCode.SIGN_FAILED,
    });
  });

  it('signs successfully when the device returns a signature', async () => {
    const adapter = await connected();
    xrpAppInstance.signTransaction.mockResolvedValue('deadbeef');

    const result = await adapter.sign({ TransactionType: 'Payment' } as never);

    expect(typeof result.tx_blob).toBe('string');
    expect(result.tx_blob!.length).toBeGreaterThan(0);
  });

  it('maps a user-rejected device signature to sign-rejected', async () => {
    const adapter = await connected();
    const rejected = Object.assign(new Error('rejected'), { statusCode: 0x6985 });
    xrpAppInstance.signTransaction.mockRejectedValue(rejected);

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });
  });
});

describe('LedgerAdapter.disconnect', () => {
  it('clears the current account', async () => {
    installNavigator({ hid: {} });
    xrpAppInstance.getAddress.mockResolvedValue({
      address: 'rLedger',
      publicKey: 'aabbcc',
    });
    const adapter = new LedgerAdapter();
    await adapter.connect();
    expect(await adapter.getAccount()).not.toBeNull();

    await adapter.disconnect();

    expect(await adapter.getAccount()).toBeNull();
  });
});
