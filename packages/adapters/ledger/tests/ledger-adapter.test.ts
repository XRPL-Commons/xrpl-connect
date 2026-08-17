import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { createWalletError, WalletErrorCategory, WalletErrorCode } from '@xrpl-connect/core';

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
  default: vi.fn().mockImplementation(function () {
    return mocks.xrpAppInstance;
  }),
}));

vi.mock('xrpl', () => ({
  encode: vi.fn(() => 'encodedblob'),
  Client: vi.fn().mockImplementation(function () {
    return {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      autofill: vi.fn(async (tx) => ({ ...tx, Sequence: 1, Fee: '10' })),
      submitAndWait: vi.fn().mockResolvedValue({ result: { hash: 'HASH' } }),
    };
  }),
}));

import { LedgerAdapter } from '../src/ledger-adapter';
import { LedgerDeviceState } from '../src/types';

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
  mockTransport.close.mockReset().mockResolvedValue(undefined);
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

  it('maps user rejection (statusCode 0x6985) to connection-rejected', async () => {
    installNavigator({ hid: {} });
    const rejected = Object.assign(new Error('rejected'), { statusCode: 0x6985 });
    xrpAppInstance.getAddress.mockRejectedValue(rejected);

    await expect(new LedgerAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
    });
  });

  it('maps Ledger transport chooser cancellation to connection-rejected', async () => {
    installNavigator({ usb: {} });
    const rejected = Object.assign(new Error('No device selected.'), {
      name: 'TransportOpenUserCancelled',
    });
    transportWebUSB.create.mockRejectedValue(rejected);

    await expect(new LedgerAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
      category: WalletErrorCategory.USER_ACTION,
      originalError: rejected,
    });
  });

  it('does not open a fallback chooser after transport cancellation', async () => {
    installNavigator({ hid: {}, usb: {} });
    const rejected = Object.assign(new Error('The user aborted a request.'), {
      name: 'TransportOpenUserCancelled',
    });
    transportWebHID.create.mockRejectedValue(rejected);

    await expect(new LedgerAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
      originalError: rejected,
    });
    expect(transportWebUSB.create).not.toHaveBeenCalled();
  });

  it('falls back to the alternate transport after a generic transport failure', async () => {
    installNavigator({ hid: {}, usb: {} });
    transportWebHID.create.mockRejectedValue(new Error('WebHID unavailable'));
    xrpAppInstance.getAddress.mockResolvedValue({ address: 'rLedger', publicKey: 'aabbcc' });

    await expect(new LedgerAdapter().connect()).resolves.toMatchObject({ address: 'rLedger' });
    expect(transportWebUSB.create).toHaveBeenCalledTimes(1);
  });

  it('does not infer cancellation from an untyped no-device message', async () => {
    installNavigator({ usb: {} });
    transportWebUSB.create.mockRejectedValue(new Error('No device selected.'));

    await expect(new LedgerAdapter().connect()).rejects.toMatchObject({
      code: WalletErrorCode.WALLET_NOT_INSTALLED,
    });
  });
});

describe('LedgerAdapter.getDeviceState', () => {
  it('does not report a cancelled transport chooser as ready', async () => {
    installNavigator({ usb: {} });
    transportWebUSB.create.mockRejectedValue(
      Object.assign(new Error('No device selected.'), { name: 'TransportOpenUserCancelled' })
    );

    await expect(new LedgerAdapter().getDeviceState()).resolves.toBe(LedgerDeviceState.UNKNOWN);
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
      code: WalletErrorCode.NOT_CONNECTED,
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

  it('maps a user-rejected message signature to sign-rejected', async () => {
    const adapter = await connected();
    const rejected = Object.assign(new Error('rejected'), { statusCode: 0x6985 });
    xrpAppInstance.signTransaction.mockRejectedValue(rejected);

    await expect(adapter.signMessage('hello')).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
      originalError: rejected,
    });
  });

  it('retains the provider cause for unknown signing failures', async () => {
    const adapter = await connected();
    const failure = new Error('Transport failed');
    xrpAppInstance.signTransaction.mockRejectedValue(failure);

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
      originalError: expect.objectContaining({ cause: failure }),
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

describe('LedgerAdapter.fetchAccount', () => {
  async function connected() {
    installNavigator({ hid: {} });
    xrpAppInstance.getAddress.mockResolvedValueOnce({
      address: 'rLedger',
      publicKey: 'aabbcc',
    });
    const adapter = new LedgerAdapter();
    await adapter.connect({ network: 'testnet' });
    return adapter;
  }

  it('performs a fresh device read and replaces changed account data', async () => {
    const adapter = await connected();
    xrpAppInstance.getAddress.mockResolvedValueOnce({
      address: 'rLedgerChanged',
      publicKey: 'ddeeff',
    });

    await expect(adapter.fetchAccount()).resolves.toMatchObject({
      address: 'rLedgerChanged',
      publicKey: 'ddeeff',
      network: { id: 'testnet' },
    });
    expect(xrpAppInstance.getAddress).toHaveBeenCalledTimes(2);
    await expect(adapter.getAccount()).resolves.toMatchObject({ address: 'rLedgerChanged' });
  });

  it('returns null without touching the device after disconnect', async () => {
    const adapter = await connected();
    await adapter.disconnect();

    await expect(adapter.fetchAccount()).resolves.toBeNull();
    expect(xrpAppInstance.getAddress).toHaveBeenCalledTimes(1);
  });

  it('invalidates account reads as soon as disconnect starts', async () => {
    const adapter = await connected();
    let releaseClose!: () => void;
    mockTransport.close.mockImplementationOnce(
      () => new Promise<void>((resolve) => (releaseClose = resolve))
    );

    const disconnecting = adapter.disconnect();
    await expect(adapter.fetchAccount()).resolves.toBeNull();
    expect(xrpAppInstance.getAddress).toHaveBeenCalledTimes(1);

    releaseClose();
    await disconnecting;
  });

  it('maps a fresh device-read failure without replacing the cached account', async () => {
    const adapter = await connected();
    xrpAppInstance.getAddress.mockRejectedValueOnce(new Error('No device found'));

    await expect(adapter.fetchAccount()).rejects.toMatchObject({
      code: WalletErrorCode.WALLET_NOT_INSTALLED,
    });
    await expect(adapter.getAccount()).resolves.toMatchObject({ address: 'rLedger' });
  });
});

describe('LedgerAdapter.getAccounts', () => {
  it('maps transport chooser cancellation to connection-rejected with its cause', async () => {
    installNavigator({ usb: {} });
    const rejected = Object.assign(new Error('No device selected.'), {
      name: 'TransportOpenUserCancelled',
    });
    transportWebUSB.create.mockRejectedValue(rejected);

    await expect(new LedgerAdapter().getAccounts()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
      category: WalletErrorCategory.USER_ACTION,
      originalError: rejected,
    });
    expect(xrpAppInstance.getAddress).not.toHaveBeenCalled();
  });

  it('stops account discovery on cancellation and closes its temporary transport', async () => {
    installNavigator({ usb: {} });
    const rejected = Object.assign(new Error('The user aborted a request.'), {
      name: 'TransportOpenUserCancelled',
    });
    xrpAppInstance.getAddress.mockRejectedValue(rejected);

    await expect(new LedgerAdapter().getAccounts()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
      originalError: rejected,
    });
    expect(xrpAppInstance.getAddress).toHaveBeenCalledTimes(1);
    expect(mockTransport.close).toHaveBeenCalledTimes(1);
  });

  it('preserves typed account-discovery errors and closes its temporary transport', async () => {
    installNavigator({ usb: {} });
    const typedError = createWalletError.notConnected();
    xrpAppInstance.getAddress.mockRejectedValue(typedError);

    await expect(new LedgerAdapter().getAccounts()).rejects.toBe(typedError);
    expect(xrpAppInstance.getAddress).toHaveBeenCalledTimes(1);
    expect(mockTransport.close).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to another transport after a typed transport error', async () => {
    installNavigator({ hid: {}, usb: {} });
    const typedError = createWalletError.notConnected();
    transportWebHID.create.mockRejectedValue(typedError);

    await expect(new LedgerAdapter().getAccounts()).rejects.toBe(typedError);
    expect(transportWebUSB.create).not.toHaveBeenCalled();
  });

  it('retains the generic all-accounts-failed classification and closes the transport', async () => {
    installNavigator({ usb: {} });
    xrpAppInstance.getAddress.mockRejectedValue(new Error('No device found'));

    await expect(new LedgerAdapter().getAccounts(2)).rejects.toMatchObject({
      code: WalletErrorCode.UNKNOWN_ERROR,
      message: expect.stringContaining('Please connect your Ledger device via USB'),
    });
    expect(xrpAppInstance.getAddress).toHaveBeenCalledTimes(2);
    expect(mockTransport.close).toHaveBeenCalledTimes(1);
  });

  it('retains structured Ledger status details when every account lookup fails', async () => {
    installNavigator({ usb: {} });
    xrpAppInstance.getAddress.mockRejectedValue({ statusCode: 0x6804 });

    await expect(new LedgerAdapter().getAccounts()).rejects.toMatchObject({
      code: WalletErrorCode.UNKNOWN_ERROR,
      message: expect.stringContaining('Please unlock your Ledger device'),
    });
    expect(mockTransport.close).toHaveBeenCalledTimes(1);
  });
});

describe('LedgerAdapter reconnect options', () => {
  it('serializes a constructor-selected account as its effective path', () => {
    const adapter = new LedgerAdapter({ accountIndex: 7 });

    expect(adapter.serializeReconnectOptions({ network: 'testnet' })).toEqual({
      derivationPath: "44'/144'/7'/0/0",
    });
  });

  it('serializes the account index actually used when derivationPath is empty', async () => {
    installNavigator({ hid: {} });
    xrpAppInstance.getAddress.mockResolvedValue({ address: 'rLedger', publicKey: 'aabbcc' });
    const adapter = new LedgerAdapter();

    const options = { derivationPath: '', accountIndex: 7 };
    await adapter.connect(options);

    expect(xrpAppInstance.getAddress).toHaveBeenCalledWith("44'/144'/7'/0/0", false, false);
    expect(adapter.serializeReconnectOptions(options)).toEqual({
      derivationPath: "44'/144'/7'/0/0",
    });
  });

  it('retains and serializes the active path when a later connect omits a selector', async () => {
    installNavigator({ hid: {} });
    xrpAppInstance.getAddress.mockResolvedValue({ address: 'rLedger', publicKey: 'aabbcc' });
    const adapter = new LedgerAdapter();

    await adapter.connect({ accountIndex: 7 });
    await adapter.connect({ network: 'testnet' });

    expect(xrpAppInstance.getAddress).toHaveBeenLastCalledWith("44'/144'/7'/0/0", false, false);
    expect(adapter.serializeReconnectOptions({ network: 'testnet' })).toEqual({
      derivationPath: "44'/144'/7'/0/0",
    });
  });
});
