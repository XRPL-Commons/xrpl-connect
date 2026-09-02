import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { createWalletError, WalletErrorCategory, WalletErrorCode } from '@xrpl-connect/core';
import {
  decode,
  encodeForMultiSigning,
  hashes,
  multisign,
  verifyKeypairSignature,
  Wallet,
  type Transaction,
} from 'xrpl';

const mocks = vi.hoisted(() => {
  const transportWebHID = { create: vi.fn() };
  const transportWebUSB = { create: vi.fn() };
  const mockTransport = { close: vi.fn().mockResolvedValue(undefined) };
  const xrpAppInstance = {
    getAddress: vi.fn(),
    signTransaction: vi.fn(),
  };
  const client = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    autofill: vi.fn(),
    submitAndWait: vi.fn(),
  };
  return { transportWebHID, transportWebUSB, mockTransport, xrpAppInstance, client };
});

const { transportWebHID, transportWebUSB, mockTransport, xrpAppInstance, client } = mocks;

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

vi.mock('xrpl', async (importOriginal) => ({
  ...(await importOriginal<typeof import('xrpl')>()),
  Client: vi.fn().mockImplementation(function () {
    return mocks.client;
  }),
}));

import { LedgerAdapter } from '../src/ledger-adapter';
import { LedgerDeviceState } from '../src/types';
import { Client } from 'xrpl';

const SINGLE_SIGNER = new Wallet(
  '030E58CDD076E798C84755590AAF6237CA8FAE821070A59F648B517A30DC6F589D',
  '00141BA006D3363D2FB2785E8DF4E44D3A49908780CB4FB51F6D217C08C021429F'
);

const SINGLE_TRANSACTION = {
  TransactionType: 'Payment',
  Account: SINGLE_SIGNER.classicAddress,
  Destination: 'rQ3PTWGLCbPz8ZCicV5tCX3xuymojTng5r',
  Amount: '20000000',
  Sequence: 1,
  Fee: '12',
} satisfies Transaction;

const MULTISIGN_TRANSACTION = {
  Account: 'rEuLyBCvcw4CFmzv8RepSiAoNgF8tTGJQC',
  Fee: '30000',
  Flags: 262144,
  LimitAmount: {
    currency: 'USD',
    issuer: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    value: '100',
  },
  Sequence: 2,
  SigningPubKey: '',
  TransactionType: 'TrustSet',
} satisfies Transaction;

const LEDGER_SIGNER = {
  Account: 'rsA2LpzuawewSBQXkiju3YQTMzW13pAAdW',
  SigningPubKey: '02B3EC4E5DD96029A647CFA20DA07FE1F85296505552CCAC114087E66B46BD77DF',
  TxnSignature:
    '30450221009C195DBBF7967E223D8626CA19CF02073667F2B22E206727BFE848FF42BEAC8A022048C323B0BED19A988BDBEFA974B6DE8AA9DCAE250AA82BBD1221787032A864E5',
};

const OTHER_SIGNER = {
  Account: 'rUpy3eEg8rqjqfUoLeBnZkscbKbFsKXC3v',
  SigningPubKey: '028FFB276505F9AC3F57E8D5242B386A597EF6C40A7999F37F1948636FD484E25B',
  TxnSignature:
    '30440220680BBD745004E9CFB6B13A137F505FB92298AD309071D16C7B982825188FD1AE022004200B1F7E4A6A84BB0E4FC09E1E3BA2B66EBD32F0E6D121A34BA3B04AD99BC1',
};

const MULTISIGN_LEDGER_PAYLOAD =
  '1200142200040000240000000263D5038D7EA4C680000000000000000000000000005553440000000000B5F762798A53D543A014CAF8B297CFF8F2F937E868400000000000753073008114A3780F5CB5A44D366520FC44055E8ED44D9A2270';
const MULTISIGN_PREIMAGE =
  '534D54001200142200040000240000000263D5038D7EA4C680000000000000000000000000005553440000000000B5F762798A53D543A014CAF8B297CFF8F2F937E868400000000000753073008114A3780F5CB5A44D366520FC44055E8ED44D9A2270204288D2E47F8EF6C99BCC457966320D12409711';
const LEDGER_CONTRIBUTION_BLOB =
  '1200142200040000240000000263D5038D7EA4C680000000000000000000000000005553440000000000B5F762798A53D543A014CAF8B297CFF8F2F937E868400000000000753073008114A3780F5CB5A44D366520FC44055E8ED44D9A2270F3E010732102B3EC4E5DD96029A647CFA20DA07FE1F85296505552CCAC114087E66B46BD77DF744730450221009C195DBBF7967E223D8626CA19CF02073667F2B22E206727BFE848FF42BEAC8A022048C323B0BED19A988BDBEFA974B6DE8AA9DCAE250AA82BBD1221787032A864E58114204288D2E47F8EF6C99BCC457966320D12409711E1F1';
const COMBINED_MULTISIGN_BLOB =
  '1200142200040000240000000263D5038D7EA4C680000000000000000000000000005553440000000000B5F762798A53D543A014CAF8B297CFF8F2F937E868400000000000753073008114A3780F5CB5A44D366520FC44055E8ED44D9A2270F3E010732102B3EC4E5DD96029A647CFA20DA07FE1F85296505552CCAC114087E66B46BD77DF744730450221009C195DBBF7967E223D8626CA19CF02073667F2B22E206727BFE848FF42BEAC8A022048C323B0BED19A988BDBEFA974B6DE8AA9DCAE250AA82BBD1221787032A864E58114204288D2E47F8EF6C99BCC457966320D12409711E1E0107321028FFB276505F9AC3F57E8D5242B386A597EF6C40A7999F37F1948636FD484E25B744630440220680BBD745004E9CFB6B13A137F505FB92298AD309071D16C7B982825188FD1AE022004200B1F7E4A6A84BB0E4FC09E1E3BA2B66EBD32F0E6D121A34BA3B04AD99BC181147908A7F0EDD48EA896C3580A399F0EE78611C8E3E1F1';

function signWithSingleSigner(rawTransaction: string): string {
  const signed = decode(
    SINGLE_SIGNER.sign(decode(rawTransaction) as Transaction).tx_blob
  ) as Transaction;
  if (!signed.TxnSignature) throw new Error('Missing test signature');
  return signed.TxnSignature;
}

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
  vi.mocked(Client).mockClear();
  mockTransport.close.mockReset().mockResolvedValue(undefined);
  transportWebHID.create.mockResolvedValue(mockTransport);
  transportWebUSB.create.mockResolvedValue(mockTransport);
  client.connect.mockReset().mockResolvedValue(undefined);
  client.disconnect.mockReset().mockResolvedValue(undefined);
  client.autofill.mockReset().mockImplementation(async (tx: Transaction) => ({
    ...tx,
    Sequence: tx.Sequence ?? 1,
    Fee: tx.Fee ?? '10',
  }));
  client.submitAndWait.mockReset().mockResolvedValue({ result: { hash: 'HASH' } });
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

  it.each(['testnet', 'devnet'] as const)('uses the configured %s network', async (network) => {
    installNavigator({ hid: {} });
    xrpAppInstance.getAddress.mockResolvedValue({
      address: 'rLedger',
      publicKey: 'aabbcc',
    });

    await expect(new LedgerAdapter().connect({ network })).resolves.toMatchObject({
      network: { id: network },
    });
  });

  it('uses a custom application-configured network for signing and submission', async () => {
    installNavigator({ hid: {} });
    xrpAppInstance.getAddress.mockResolvedValue({
      address: SINGLE_SIGNER.classicAddress,
      publicKey: SINGLE_SIGNER.publicKey,
    });
    xrpAppInstance.signTransaction.mockImplementation(async (_path, rawTransaction) =>
      signWithSingleSigner(rawTransaction)
    );
    const customNetwork = {
      id: 'private-sidechain',
      name: 'Private Sidechain',
      wss: 'wss://sidechain.example',
    };
    const adapter = new LedgerAdapter();

    await adapter.connect({ network: customNetwork });
    await adapter.signAndSubmit(SINGLE_TRANSACTION);

    expect(await adapter.getNetwork()).toEqual(customNetwork);
    expect(Client).toHaveBeenCalledWith(customNetwork.wss);
  });

  it('rejects an unsupported runtime network id before opening the device', async () => {
    installNavigator({ hid: {} });

    await expect(
      new LedgerAdapter().connect({ network: 'sidechain' as never })
    ).rejects.toMatchObject({ code: WalletErrorCode.NETWORK_NOT_SUPPORTED });
    expect(transportWebHID.create).not.toHaveBeenCalled();
    expect(xrpAppInstance.getAddress).not.toHaveBeenCalled();
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
  async function connected(
    address = SINGLE_SIGNER.classicAddress,
    publicKey = SINGLE_SIGNER.publicKey
  ) {
    installNavigator({ hid: {} });
    xrpAppInstance.getAddress.mockResolvedValue({ address, publicKey });
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

  it('preserves valid single-sign serialization and artifacts', async () => {
    const adapter = await connected();
    xrpAppInstance.signTransaction.mockImplementation(async (_path, rawTransaction) =>
      signWithSingleSigner(rawTransaction)
    );

    const result = await adapter.sign(SINGLE_TRANSACTION);
    const expected = SINGLE_SIGNER.sign(SINGLE_TRANSACTION);
    const decoded = decode(result.tx_blob!) as Transaction;

    expect(result).toMatchObject({
      hash: '',
      tx_blob: expected.tx_blob,
      tx_json: decoded,
      signature: decoded.TxnSignature,
      signerAddress: SINGLE_SIGNER.classicAddress,
    });
    expect(decoded.SigningPubKey).toBe(SINGLE_SIGNER.publicKey);
    expect(decoded.TxnSignature).toBeTypeOf('string');
    expect(decoded.Signers).toBeUndefined();
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it('returns an authoritative signer-bound multisign contribution', async () => {
    const adapter = await connected(LEDGER_SIGNER.Account, LEDGER_SIGNER.SigningPubKey);
    xrpAppInstance.signTransaction.mockResolvedValue(LEDGER_SIGNER.TxnSignature);

    const result = await adapter.sign(MULTISIGN_TRANSACTION);
    const decoded = decode(result.tx_blob!) as Transaction;

    expect(xrpAppInstance.signTransaction).toHaveBeenCalledWith(
      "44'/144'/0'/0/0",
      MULTISIGN_LEDGER_PAYLOAD
    );
    expect(encodeForMultiSigning(MULTISIGN_TRANSACTION, LEDGER_SIGNER.Account)).toBe(
      MULTISIGN_PREIMAGE
    );
    expect(result).toMatchObject({
      hash: '',
      tx_blob: LEDGER_CONTRIBUTION_BLOB,
      tx_json: decoded,
      signature: LEDGER_SIGNER.TxnSignature,
      signerAddress: LEDGER_SIGNER.Account,
    });
    expect(decoded).toMatchObject({
      SigningPubKey: '',
      Signers: [{ Signer: LEDGER_SIGNER }],
    });
    expect(decoded.TxnSignature).toBeUndefined();
    expect(
      verifyKeypairSignature(
        MULTISIGN_PREIMAGE,
        LEDGER_SIGNER.TxnSignature,
        LEDGER_SIGNER.SigningPubKey
      )
    ).toBe(true);
    expect(
      verifyKeypairSignature(
        encodeForMultiSigning(MULTISIGN_TRANSACTION, OTHER_SIGNER.Account),
        LEDGER_SIGNER.TxnSignature,
        LEDGER_SIGNER.SigningPubKey
      )
    ).toBe(false);

    const otherAdapter = await connected(OTHER_SIGNER.Account, OTHER_SIGNER.SigningPubKey);
    xrpAppInstance.signTransaction.mockResolvedValue(OTHER_SIGNER.TxnSignature);
    const otherContribution = await otherAdapter.sign(MULTISIGN_TRANSACTION);

    const combined = multisign([result.tx_blob!, otherContribution.tx_blob!]);
    expect(combined).toBe(COMBINED_MULTISIGN_BLOB);
    expect(hashes.hashSignedTx(combined)).toBe(
      'BD636194C48FD7A100DE4C972336534C8E710FD008C0F3CF7BC5BF34DAF3C3E6'
    );
    expect(client.connect).not.toHaveBeenCalled();
    expect(client.autofill).not.toHaveBeenCalled();
  });

  it('fails when the multisign signature is not bound to the connected address', async () => {
    const adapter = await connected(OTHER_SIGNER.Account, LEDGER_SIGNER.SigningPubKey);
    xrpAppInstance.signTransaction.mockResolvedValue(LEDGER_SIGNER.TxnSignature);

    await expect(adapter.sign(MULTISIGN_TRANSACTION)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
      message: expect.stringContaining('does not match the connected account'),
    });
    expect(client.connect).not.toHaveBeenCalled();
  });

  it.each([
    ['TxnSignature', { ...MULTISIGN_TRANSACTION, TxnSignature: 'already-signed' }],
    ['Signers', { ...MULTISIGN_TRANSACTION, Signers: [] }],
  ])('rejects multisign input that already contains %s', async (_field, transaction) => {
    const adapter = await connected(LEDGER_SIGNER.Account, LEDGER_SIGNER.SigningPubKey);

    await expect(adapter.sign(transaction as Transaction)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
      message: expect.stringContaining('must not contain TxnSignature or Signers'),
    });
    expect(client.connect).not.toHaveBeenCalled();
    expect(xrpAppInstance.signTransaction).not.toHaveBeenCalled();
  });

  it('requires an explicit source account for multisigning', async () => {
    const adapter = await connected(LEDGER_SIGNER.Account, LEDGER_SIGNER.SigningPubKey);
    const { Account: _account, ...transaction } = MULTISIGN_TRANSACTION;

    await expect(adapter.sign(transaction as Transaction)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
      message: expect.stringContaining('requires the source Account'),
    });
    expect(client.connect).not.toHaveBeenCalled();
  });

  it.each([
    ['Fee', (({ Fee: _fee, ...transaction }) => transaction)(MULTISIGN_TRANSACTION)],
    ['Sequence', (({ Sequence: _sequence, ...transaction }) => transaction)(MULTISIGN_TRANSACTION)],
  ])('requires a prepared multisign transaction with %s', async (_field, transaction) => {
    const adapter = await connected(LEDGER_SIGNER.Account, LEDGER_SIGNER.SigningPubKey);

    await expect(adapter.sign(transaction as Transaction)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
      message: expect.stringContaining('requires a prepared transaction with Fee and Sequence'),
    });
    expect(client.connect).not.toHaveBeenCalled();
    expect(client.autofill).not.toHaveBeenCalled();
    expect(xrpAppInstance.signTransaction).not.toHaveBeenCalled();
  });

  it('maps a user-rejected device signature to sign-rejected', async () => {
    const adapter = await connected();
    const rejected = Object.assign(new Error('rejected'), { statusCode: 0x6985 });
    xrpAppInstance.signTransaction.mockRejectedValue(rejected);

    await expect(adapter.sign(SINGLE_TRANSACTION)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });
    expect(client.disconnect).toHaveBeenCalledTimes(1);
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

    await expect(adapter.sign(SINGLE_TRANSACTION)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
      originalError: expect.objectContaining({ cause: failure }),
    });
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnects the XRPL client when autofill fails', async () => {
    const adapter = await connected();
    client.autofill.mockRejectedValue(new Error('autofill failed'));

    await expect(adapter.sign(SINGLE_TRANSACTION)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(xrpAppInstance.signTransaction).not.toHaveBeenCalled();
  });
});

describe('LedgerAdapter.signAndSubmit', () => {
  async function connected() {
    installNavigator({ hid: {} });
    xrpAppInstance.getAddress.mockResolvedValue({
      address: SINGLE_SIGNER.classicAddress,
      publicKey: SINGLE_SIGNER.publicKey,
    });
    const adapter = new LedgerAdapter();
    await adapter.connect();
    return adapter;
  }

  it('preserves single-sign submission and disconnects afterward', async () => {
    const adapter = await connected();
    xrpAppInstance.signTransaction.mockImplementation(async (_path, rawTransaction) =>
      signWithSingleSigner(rawTransaction)
    );

    const result = await adapter.signAndSubmit(SINGLE_TRANSACTION);

    expect(client.submitAndWait).toHaveBeenCalledWith(result.tx_blob);
    expect(result).toMatchObject({ hash: 'HASH', id: 'HASH' });
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnects when submission fails', async () => {
    const adapter = await connected();
    xrpAppInstance.signTransaction.mockImplementation(async (_path, rawTransaction) =>
      signWithSingleSigner(rawTransaction)
    );
    client.submitAndWait.mockRejectedValue(new Error('submission failed'));

    await expect(adapter.signAndSubmit(SINGLE_TRANSACTION)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it('fails closed for a partial multisign contribution', async () => {
    const adapter = await connected();

    await expect(adapter.signAndSubmit(MULTISIGN_TRANSACTION)).rejects.toMatchObject({
      code: WalletErrorCode.UNSUPPORTED_METHOD,
    });
    expect(client.connect).not.toHaveBeenCalled();
    expect(xrpAppInstance.signTransaction).not.toHaveBeenCalled();
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
