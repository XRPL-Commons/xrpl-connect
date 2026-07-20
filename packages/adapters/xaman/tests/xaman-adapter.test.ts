import { describe, it, expect, expectTypeOf, vi, beforeEach } from 'vitest';
import { WalletErrorCode, type NetworkConfig, type Transaction } from '@xrpl-connect/core';
import { decode, encode, hashes, Wallet } from 'xrpl';

const mockXummInstance = {
  authorize: vi.fn(),
  logout: vi.fn(),
  user: {
    account: Promise.resolve<string | undefined>(undefined),
    networkEndpoint: Promise.resolve<string | undefined>(undefined),
    networkId: Promise.resolve<number | undefined>(undefined),
  },
  payload: {
    createAndSubscribe: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    cancel: vi.fn(),
  },
};

vi.mock('xumm', () => ({
  Xumm: vi.fn().mockImplementation(() => mockXummInstance),
}));

import { XamanAdapter } from '../src/xaman-adapter';

const SIGNING_WALLET = Wallet.fromSeed('snoPBrXtMeMyMHUVTgbuqAfg1SUTb');
const CONNECTED_ACCOUNT = SIGNING_WALLET.address;
const SIGNED_TRANSACTION = SIGNING_WALLET.sign({
  TransactionType: 'Payment',
  Account: CONNECTED_ACCOUNT,
  Destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
  Amount: '1000000',
  Fee: '10',
  Sequence: 1,
  Flags: 0,
});
const SIGNED_TX_HEX = SIGNED_TRANSACTION.tx_blob;
const SIGNED_TX_JSON = decode(SIGNED_TX_HEX) as Transaction;
const SIGNED_TX_HASH = hashes.hashSignedTx(SIGNED_TX_HEX);
const REQUESTED_TRANSACTION = {
  TransactionType: 'Payment',
  Account: CONNECTED_ACCOUNT,
  Destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
  Amount: '1000000',
  Fee: '10',
  Sequence: 1,
  Flags: 0,
} as Transaction;
const MULTISIGN_SOURCE = Wallet.generate();
const MULTISIGN_INPUT = {
  TransactionType: 'Payment',
  Account: MULTISIGN_SOURCE.address,
  Destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
  Amount: '1000000',
  Fee: '10',
  Sequence: 1,
  SigningPubKey: '',
} as Transaction;
const MULTISIGNED_TRANSACTION = SIGNING_WALLET.sign(MULTISIGN_INPUT, true);
const MULTISIGNED_TX_JSON = decode(MULTISIGNED_TRANSACTION.tx_blob) as Transaction;
const MULTISIGNED_TX_HASH = hashes.hashSignedTx(MULTISIGNED_TRANSACTION.tx_blob);
const EXISTING_MULTISIGNER = Wallet.generate();
const PARTIALLY_SIGNED_INPUT = decode(
  EXISTING_MULTISIGNER.sign(MULTISIGN_INPUT, true).tx_blob
) as Transaction;

function signedFixture(networkId = 0) {
  const input = {
    TransactionType: 'Payment',
    Account: CONNECTED_ACCOUNT,
    Destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
    Amount: '1000000',
    Fee: '10',
    Sequence: 1,
    Flags: 0,
    ...(networkId > 1024 ? { NetworkID: networkId } : {}),
  } as Transaction;
  const signed = SIGNING_WALLET.sign(input);
  return {
    input,
    blob: signed.tx_blob,
    hash: hashes.hashSignedTx(signed.tx_blob),
  };
}

type PayloadEventCallback = (event: {
  data: Record<string, unknown>;
  payload: { meta: { app_opened: boolean } };
}) => unknown | Promise<unknown>;

function createSubscriptionHarness() {
  let callback: PayloadEventCallback | undefined;
  let resolveOutcome: ((outcome: unknown) => void) | undefined;
  let markReady: (() => void) | undefined;
  let appOpened = false;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });
  const resolved = new Promise<unknown>((resolve) => {
    resolveOutcome = resolve;
  });
  const close = vi.fn(() => resolveOutcome?.(undefined));

  mockXummInstance.payload.createAndSubscribe.mockImplementation(async (_body, onEvent) => {
    callback = onEvent as PayloadEventCallback;
    markReady?.();
    return {
      created: {
        uuid: 'payload-uuid',
        next: { always: 'https://xaman.app/sign/payload-uuid' },
      },
      resolved,
      resolve: close,
    };
  });

  return {
    ready,
    close,
    async emit(data: Record<string, unknown>) {
      await ready;
      if (data.opened === true || data.pre_signed === true) appOpened = true;
      const outcome = await callback?.({ data, payload: { meta: { app_opened: appOpened } } });
      if (outcome !== undefined) resolveOutcome?.(outcome);
    },
  };
}

function resolvedPayload(
  submit: boolean,
  responseOverrides: Record<string, unknown> = {},
  metaOverrides: Record<string, unknown> = {},
  requestJson: Transaction = REQUESTED_TRANSACTION
) {
  return {
    meta: {
      resolved: true,
      signed: true,
      submit,
      multisign: false,
      signers: [CONNECTED_ACCOUNT],
      ...metaOverrides,
    },
    payload: {
      request_json: requestJson,
    },
    response: {
      hex: SIGNED_TX_HEX,
      txid: SIGNED_TX_HASH,
      signer_pubkey: SIGNED_TX_JSON.SigningPubKey,
      dispatched_to_node: submit ? true : null,
      dispatched_result: submit ? 'tesSUCCESS' : null,
      dispatched_nodetype: submit ? 'MAINNET' : null,
      environment_networkid: 0,
      environment_nodetype: 'MAINNET',
      account: CONNECTED_ACCOUNT,
      multisign_account: null,
      ...responseOverrides,
    },
  };
}

function confirmedCancellation() {
  return {
    result: { cancelled: true, reason: 'OK' },
    meta: {
      cancelled: true,
      expired: true,
      app_opened: false,
      resolved: false,
      signed: false,
    },
  };
}

beforeEach(() => {
  mockXummInstance.authorize.mockReset();
  mockXummInstance.logout.mockReset();
  mockXummInstance.user.account = Promise.resolve(undefined);
  mockXummInstance.user.networkEndpoint = Promise.resolve(undefined);
  mockXummInstance.user.networkId = Promise.resolve(undefined);
  mockXummInstance.payload.createAndSubscribe.mockReset();
  mockXummInstance.payload.create.mockReset();
  mockXummInstance.payload.get.mockReset();
  mockXummInstance.payload.cancel.mockReset();
});

async function signedAdapter(network: NetworkConfig = 'mainnet') {
  mockXummInstance.authorize.mockResolvedValue({ me: { account: CONNECTED_ACCOUNT } });
  const adapter = new XamanAdapter({ apiKey: 'test-key' });
  // Without an onQRCode callback, openSignWindow() falls back to window.open(),
  // which doesn't exist in this (Node) test environment — supply a no-op so
  // signing proceeds straight to the subscription wait, same as a headless caller.
  await adapter.connect({ network, onQRCode: () => {} });

  return { adapter, subscription: createSubscriptionHarness() };
}

describe('XamanAdapter.isAvailable', () => {
  it('is always available regardless of options', async () => {
    await expect(new XamanAdapter().isAvailable()).resolves.toBe(true);
    await expect(new XamanAdapter({ apiKey: 'key' }).isAvailable()).resolves.toBe(true);
  });
});

describe('XamanAdapter.checkXamanState', () => {
  it.each([
    [0, 'mainnet', 'MAINNET'],
    [1, 'testnet', 'TESTNET'],
    [2, 'devnet', 'DEVNET'],
    [21337, 'xahau', 'XAHAU'],
    [21338, 'xahau-testnet', 'XAHAUTESTNET'],
    [31338, 'jshooks-testnet', 'JSHOOKS'],
  ])('restores Xaman network ID %s as %s', async (networkId, expectedId, _rail) => {
    mockXummInstance.user.account = Promise.resolve(CONNECTED_ACCOUNT);
    mockXummInstance.user.networkEndpoint = Promise.resolve('wss://custom-node.example');
    mockXummInstance.user.networkId = Promise.resolve(networkId);
    const adapter = new XamanAdapter({ apiKey: 'test-key' });

    const account = await adapter.checkXamanState();

    expect(account).toMatchObject({
      address: CONNECTED_ACCOUNT,
      network: {
        id: expectedId,
        wss: 'wss://custom-node.example',
        walletConnectId: `xrpl:${networkId}`,
      },
    });
  });

  it('rejects an unsupported restored Xaman network ID', async () => {
    mockXummInstance.user.account = Promise.resolve(CONNECTED_ACCOUNT);
    mockXummInstance.user.networkEndpoint = Promise.resolve('wss://custom-node.example');
    mockXummInstance.user.networkId = Promise.resolve(999);
    const adapter = new XamanAdapter({ apiKey: 'test-key' });

    await expect(adapter.checkXamanState()).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_NOT_SUPPORTED,
    });
    expect(mockXummInstance.logout).toHaveBeenCalledTimes(1);
  });

  it('adopts a restored session without authorizing or logging out again', async () => {
    mockXummInstance.user.account = Promise.resolve(CONNECTED_ACCOUNT);
    mockXummInstance.user.networkEndpoint = Promise.resolve('wss://xrplcluster.com');
    mockXummInstance.user.networkId = Promise.resolve(0);
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    const restored = await adapter.checkXamanState();
    const onQRCode = vi.fn();

    const connected = await adapter.connect({ onQRCode });

    expect(connected).toBe(restored);
    expect(mockXummInstance.authorize).not.toHaveBeenCalled();
    expect(mockXummInstance.logout).not.toHaveBeenCalled();

    const subscription = createSubscriptionHarness();
    mockXummInstance.payload.get.mockResolvedValue(resolvedPayload(false));
    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    await subscription.ready;
    await vi.waitFor(() =>
      expect(onQRCode).toHaveBeenCalledWith('https://xaman.app/sign/payload-uuid')
    );
    await subscription.emit({ signed: true });
    await expect(signPromise).resolves.toMatchObject({ hash: SIGNED_TX_HASH });
  });

  it('logs out and clears the temporary client when no session exists', async () => {
    mockXummInstance.user.account = Promise.resolve(undefined);
    mockXummInstance.logout.mockResolvedValue(undefined);
    const adapter = new XamanAdapter({ apiKey: 'test-key' });

    await expect(adapter.checkXamanState()).resolves.toBeNull();
    expect(mockXummInstance.logout).toHaveBeenCalledTimes(1);
    await expect(adapter.getAccount()).resolves.toBeNull();
  });
});

describe('XamanAdapter.connect', () => {
  it('returns account info on a successful authorize', async () => {
    mockXummInstance.authorize.mockResolvedValue({ me: { account: CONNECTED_ACCOUNT } });
    const adapter = new XamanAdapter({ apiKey: 'test-key' });

    const account = await adapter.connect();

    expect(account.address).toBe(CONNECTED_ACCOUNT);
    expect(account.network.id).toBe('mainnet');
  });

  it('throws a wrapped connection error when no API key is given', async () => {
    const adapter = new XamanAdapter();
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
    expect(mockXummInstance.authorize).not.toHaveBeenCalled();
  });

  it('wraps an authorization error returned by the SDK', async () => {
    mockXummInstance.authorize.mockResolvedValue(new Error('User rejected'));
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
    expect(mockXummInstance.logout).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported and malformed Xaman network rails before authorization', async () => {
    const adapter = new XamanAdapter({ apiKey: 'test-key' });

    await expect(
      adapter.connect({
        network: {
          id: 'custom',
          name: 'Custom',
          wss: 'wss://example.test',
          walletConnectId: 'xrpl:9',
        },
      })
    ).rejects.toMatchObject({ code: WalletErrorCode.NETWORK_NOT_SUPPORTED });
    await expect(
      adapter.connect({
        network: {
          id: 'custom',
          name: 'Custom',
          wss: 'wss://example.test',
          walletConnectId: 'xrpl:not-a-number',
        },
      })
    ).rejects.toMatchObject({ code: WalletErrorCode.NETWORK_NOT_SUPPORTED });
    expect(mockXummInstance.authorize).not.toHaveBeenCalled();
  });

  it('rejects conflicting textual and numeric network identities', async () => {
    const adapter = new XamanAdapter({ apiKey: 'test-key' });

    await expect(
      adapter.connect({
        network: {
          id: 'mainnet',
          name: 'Mainnet',
          wss: 'wss://example.test',
          walletConnectId: 'xrpl:1',
        },
      })
    ).rejects.toMatchObject({ code: WalletErrorCode.NETWORK_MISMATCH });
    expect(mockXummInstance.authorize).not.toHaveBeenCalled();
  });

  it('does not restore a connection whose authorization finishes after disconnect', async () => {
    let resolveAuthorization: ((value: { me: { account: string } }) => void) | undefined;
    mockXummInstance.authorize.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAuthorization = resolve;
        })
    );
    mockXummInstance.logout.mockResolvedValue(undefined);
    const adapter = new XamanAdapter({ apiKey: 'test-key' });

    const connectPromise = adapter.connect();
    await vi.waitFor(() => expect(mockXummInstance.authorize).toHaveBeenCalledTimes(1));
    let disconnected = false;
    const disconnectPromise = adapter.disconnect().then(() => {
      disconnected = true;
    });
    await Promise.resolve();
    expect(disconnected).toBe(false);
    resolveAuthorization?.({ me: { account: CONNECTED_ACCOUNT } });

    await expect(connectPromise).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
    await disconnectPromise;
    expect(mockXummInstance.logout).toHaveBeenCalledTimes(2);
    await expect(adapter.getAccount()).resolves.toBeNull();
  });

  it('rejects a concurrent connection attempt without replacing the active authorization', async () => {
    let resolveAuthorization: ((value: { me: { account: string } }) => void) | undefined;
    mockXummInstance.authorize.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAuthorization = resolve;
        })
    );
    const adapter = new XamanAdapter({ apiKey: 'test-key' });

    const firstConnect = adapter.connect();
    await vi.waitFor(() => expect(mockXummInstance.authorize).toHaveBeenCalledTimes(1));
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
    expect(mockXummInstance.authorize).toHaveBeenCalledTimes(1);

    resolveAuthorization?.({ me: { account: CONNECTED_ACCOUNT } });
    await expect(firstConnect).resolves.toMatchObject({ address: CONNECTED_ACCOUNT });
  });

  it('reuses an existing connection without authorizing again', async () => {
    mockXummInstance.authorize.mockResolvedValue({ me: { account: CONNECTED_ACCOUNT } });
    mockXummInstance.logout.mockResolvedValue(undefined);
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await adapter.connect();

    await expect(adapter.connect()).resolves.toMatchObject({ address: CONNECTED_ACCOUNT });

    expect(mockXummInstance.logout).not.toHaveBeenCalled();
    expect(mockXummInstance.authorize).toHaveBeenCalledTimes(1);
  });
});

describe('XamanAdapter.sign', () => {
  it('preserves a not-connected error when called before connect', async () => {
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
  });

  it('maps a rejected payload to a sign-rejected error', async () => {
    const { adapter, subscription } = await signedAdapter();
    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });

    await subscription.emit({ signed: false });
    await rejection;
    expect(mockXummInstance.payload.get).not.toHaveBeenCalled();
    expect(subscription.close).toHaveBeenCalledTimes(1);
  });

  it('closes an expired subscription and reports a sign failure', async () => {
    const { adapter, subscription } = await signedAdapter();
    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });

    await subscription.emit({ expired: true });
    await rejection;
    expect(mockXummInstance.payload.get).not.toHaveBeenCalled();
    expect(subscription.close).toHaveBeenCalledTimes(1);
  });

  it('keeps an opened payload alive through expiration and the pre-open timeout', async () => {
    vi.useFakeTimers();
    try {
      const { adapter, subscription } = await signedAdapter();
      mockXummInstance.payload.get.mockResolvedValue(resolvedPayload(false, {}, { expired: true }));

      const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
      await subscription.emit({ opened: true });
      await subscription.emit({ expired: true });
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(subscription.close).not.toHaveBeenCalled();

      await subscription.emit({ signed: true });
      await expect(signPromise).resolves.toMatchObject({ hash: SIGNED_TX_HASH });
      expect(subscription.close).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses one SDK subscription and returns authoritative signed data without submitting', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(resolvedPayload(false));

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    await subscription.emit({ opened: true });
    expect(subscription.close).not.toHaveBeenCalled();
    await subscription.emit({ signed: true, txid: 'UNTRUSTED_WEBSOCKET_HASH' });
    const result = await signPromise;

    expect(mockXummInstance.payload.createAndSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          submit: false,
          force_network: 'MAINNET',
          signers: [CONNECTED_ACCOUNT],
        }),
      }),
      expect.any(Function)
    );
    expect(mockXummInstance.payload.get).toHaveBeenCalledWith('payload-uuid', true);
    expect(result.hash).toBe(SIGNED_TX_HASH);
    expect(result.tx_blob).toBe(SIGNED_TX_HEX);
    expect(result.signature).toBe(SIGNED_TX_JSON.TxnSignature);
    expect(result.tx_json).toMatchObject({
      TransactionType: 'Payment',
      TxnSignature: SIGNED_TX_JSON.TxnSignature,
    });
    expect(subscription.close).toHaveBeenCalledTimes(1);
    expectTypeOf(result.tx_blob).toEqualTypeOf<string | undefined>();
    expectTypeOf(result.signature).toEqualTypeOf<string | undefined>();
    expectTypeOf(result.tx_json).toEqualTypeOf<Transaction | undefined>();
  });

  it('rejects a resolved payload from a different network', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(false, {
        environment_networkid: 1,
        environment_nodetype: 'TESTNET',
      })
    );

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_MISMATCH,
    });
    await subscription.emit({ signed: true });

    await rejection;
    expect(subscription.close).toHaveBeenCalledTimes(1);
  });

  it('forces and validates testnet signing', async () => {
    const { adapter, subscription } = await signedAdapter('testnet');
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(false, {
        environment_networkid: 1,
        environment_nodetype: 'TESTNET',
      })
    );

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    await subscription.emit({ signed: true });

    await expect(signPromise).resolves.toMatchObject({ hash: SIGNED_TX_HASH });
    expect(mockXummInstance.payload.createAndSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          submit: false,
          force_network: 'TESTNET',
          signers: [CONNECTED_ACCOUNT],
        }),
      }),
      expect.any(Function)
    );
  });

  it.each([
    ['production', 0, 'MAINNET'],
    ['testnet', 1, 'TESTNET'],
    ['devnet', 2, 'DEVNET'],
    ['xahau', 21337, 'XAHAU'],
    ['xahau-testnet', 21338, 'XAHAUTESTNET'],
    ['jshooks-testnet', 31338, 'JSHOOKS'],
  ])('maps %s to Xaman network rail %s', async (networkId, numericId, forceNetwork) => {
    const network: NetworkConfig = {
      id: networkId,
      name: networkId,
      wss: 'wss://example.test',
      walletConnectId: `xrpl:${numericId}`,
    };
    const fixture = signedFixture(numericId);
    const { adapter, subscription } = await signedAdapter(network);
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(
        false,
        {
          hex: fixture.blob,
          txid: fixture.hash,
          environment_networkid: numericId,
          environment_nodetype: forceNetwork,
        },
        {},
        fixture.input
      )
    );

    const signPromise = adapter.sign(fixture.input);
    await subscription.emit({ signed: true });

    await expect(signPromise).resolves.toMatchObject({ hash: fixture.hash });
    expect(mockXummInstance.payload.createAndSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ force_network: forceNetwork }),
      }),
      expect.any(Function)
    );
  });

  it('rejects a signed transaction carrying a different high-numbered NetworkID', async () => {
    const expectedNetwork: NetworkConfig = {
      id: 'xahau-testnet',
      name: 'Xahau Testnet',
      wss: 'wss://example.test',
      walletConnectId: 'xrpl:21338',
    };
    const wrongNetworkFixture = signedFixture(21337);
    const { adapter, subscription } = await signedAdapter(expectedNetwork);
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(false, {
        hex: wrongNetworkFixture.blob,
        txid: wrongNetworkFixture.hash,
        environment_networkid: 21338,
        environment_nodetype: 'XAHAUTESTNET',
      })
    );

    const signPromise = adapter.sign({
      ...wrongNetworkFixture.input,
      NetworkID: 21338,
    } as Transaction);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    await subscription.emit({ signed: true });

    await rejection;
  });

  it('fails closed when Xaman omits resolved network information', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(false, {
        environment_networkid: null,
        environment_nodetype: null,
      })
    );

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_MISMATCH,
    });
    await subscription.emit({ signed: true });

    await rejection;
  });

  it('rejects a transaction hash that does not match the signed blob', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(false, { txid: '0'.repeat(64) })
    );

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    await subscription.emit({ signed: true });

    await rejection;
    expect(subscription.close).toHaveBeenCalledTimes(1);
  });

  it('rejects a signed transaction whose requested fields were changed', async () => {
    const requested = {
      ...REQUESTED_TRANSACTION,
      Destination: Wallet.generate().address,
      Amount: '5000000',
    } as Transaction;
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(resolvedPayload(false, {}, {}, requested));

    const signPromise = adapter.sign(requested);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    await subscription.emit({ signed: true });

    await rejection;
  });

  it('rejects a resolved payload whose request differs from the original transaction', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(false, {}, {}, { ...REQUESTED_TRANSACTION, Amount: '5000000' } as Transaction)
    );

    const signPromise = adapter.sign(REQUESTED_TRANSACTION);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    await subscription.emit({ signed: true });

    await rejection;
  });

  it('rejects a resolved payload signed for a different account', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(false, { account: MULTISIGN_SOURCE.address })
    );

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    await subscription.emit({ signed: true });

    await rejection;
  });

  it('cryptographically rejects a corrupted single signature', async () => {
    const corrupted = { ...SIGNED_TX_JSON } as Transaction;
    const signature = corrupted.TxnSignature as string;
    corrupted.TxnSignature = `${signature.slice(0, -1)}${signature.endsWith('0') ? '1' : '0'}`;
    const corruptedBlob = encode(corrupted);
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(false, {
        hex: corruptedBlob,
        txid: hashes.hashSignedTx(corruptedBlob),
      })
    );

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    await subscription.emit({ signed: true });

    await rejection;
  });

  it('requests and verifies a valid multi-signature from the connected account', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(
        false,
        {
          hex: MULTISIGNED_TRANSACTION.tx_blob,
          txid: MULTISIGNED_TX_HASH,
          account: MULTISIGN_SOURCE.address,
          multisign_account: CONNECTED_ACCOUNT,
        },
        { multisign: true },
        MULTISIGN_INPUT
      )
    );

    const signPromise = adapter.sign(MULTISIGN_INPUT);
    await subscription.emit({ signed: true });

    await expect(signPromise).resolves.toMatchObject({
      hash: MULTISIGNED_TX_HASH,
      signature: undefined,
    });
    expect(mockXummInstance.payload.createAndSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          multisign: true,
          signers: [CONNECTED_ACCOUNT],
        }),
      }),
      expect.any(Function)
    );
  });

  it('cryptographically rejects a corrupted multi-signature', async () => {
    const corrupted = JSON.parse(JSON.stringify(MULTISIGNED_TX_JSON)) as Transaction;
    const signature = corrupted.Signers![0].Signer.TxnSignature;
    corrupted.Signers![0].Signer.TxnSignature = `${signature.slice(0, -1)}${
      signature.endsWith('0') ? '1' : '0'
    }`;
    const corruptedBlob = encode(corrupted);
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(
        false,
        {
          hex: corruptedBlob,
          txid: hashes.hashSignedTx(corruptedBlob),
          account: MULTISIGN_SOURCE.address,
          multisign_account: CONNECTED_ACCOUNT,
        },
        { multisign: true },
        MULTISIGN_INPUT
      )
    );

    const signPromise = adapter.sign(MULTISIGN_INPUT);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    await subscription.emit({ signed: true });

    await rejection;
  });

  it('rejects a multi-signed result that drops an existing signature', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(
        false,
        {
          hex: MULTISIGNED_TRANSACTION.tx_blob,
          txid: MULTISIGNED_TX_HASH,
          account: MULTISIGN_SOURCE.address,
          multisign_account: CONNECTED_ACCOUNT,
        },
        { multisign: true },
        PARTIALLY_SIGNED_INPUT
      )
    );

    const signPromise = adapter.sign(PARTIALLY_SIGNED_INPUT);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    await subscription.emit({ signed: true });

    await rejection;
  });

  it.each([
    ['a missing resolved payload', null],
    ['an unresolved payload', resolvedPayload(false, {}, { resolved: false })],
    ['a missing signed blob', resolvedPayload(false, { hex: null })],
    ['a malformed signed blob', resolvedPayload(false, { hex: 'NOT_HEX' })],
    ['a missing transaction hash', resolvedPayload(false, { txid: null })],
  ])('fails when payload.get() returns %s', async (_description, resolved) => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(resolved);

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    await subscription.emit({ signed: true });

    await rejection;
    expect(subscription.close).toHaveBeenCalledTimes(1);
  });

  it('fails if Xaman dispatches a sign-only transaction', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(false, { dispatched_to_node: true, dispatched_result: 'tesSUCCESS' })
    );

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    await subscription.emit({ signed: true });

    await rejection;
    expect(subscription.close).toHaveBeenCalledTimes(1);
  });
});

describe('XamanAdapter.signMessage', () => {
  it('reports arbitrary message signing as unsupported without creating a payload', async () => {
    const adapter = new XamanAdapter({ apiKey: 'test-key' });

    await expect(adapter.signMessage('message')).rejects.toMatchObject({
      code: WalletErrorCode.UNSUPPORTED_METHOD,
    });
    expect(mockXummInstance.payload.create).not.toHaveBeenCalled();
  });
});

describe('XamanAdapter.signAndSubmit', () => {
  it('returns signed data only after Xaman reports a successful node dispatch', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(resolvedPayload(true));

    const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
    await subscription.emit({ signed: true, txid: 'UNTRUSTED_WEBSOCKET_HASH' });
    const result = await submitPromise;

    expect(mockXummInstance.payload.createAndSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          submit: true,
          force_network: 'MAINNET',
          signers: [CONNECTED_ACCOUNT],
        }),
      }),
      expect.any(Function)
    );
    expect(result.hash).toBe(SIGNED_TX_HASH);
    expect(result.tx_blob).toBe(SIGNED_TX_HEX);
    expect(result.signature).toBe(SIGNED_TX_JSON.TxnSignature);
    expect(result.tx_json).toMatchObject({ TransactionType: 'Payment' });
    expect(subscription.close).toHaveBeenCalledTimes(1);
    expectTypeOf(result.tx_blob).toEqualTypeOf<string | undefined>();
    expectTypeOf(result.signature).toEqualTypeOf<string | undefined>();
    expectTypeOf(result.tx_json).toEqualTypeOf<Transaction | undefined>();
  });

  it('retries authoritative result retrieval after a signed submission', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce(resolvedPayload(true));

    const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
    await subscription.emit({ signed: true });

    await expect(submitPromise).resolves.toMatchObject({ hash: SIGNED_TX_HASH });
    expect(mockXummInstance.payload.get).toHaveBeenCalledTimes(2);
  });

  it('stops retrying authoritative result retrieval after the retry deadline', async () => {
    vi.useFakeTimers();
    try {
      const { adapter, subscription } = await signedAdapter();
      mockXummInstance.payload.get.mockRejectedValue(new Error('persistent network failure'));

      const submitPromise = adapter.signAndSubmit(REQUESTED_TRANSACTION);
      const rejection = expect(submitPromise).rejects.toMatchObject({
        code: WalletErrorCode.SIGN_FAILED,
      });
      await subscription.emit({ signed: true });
      await vi.advanceTimersByTimeAsync(30_000);

      await rejection;
      expect(mockXummInstance.payload.get.mock.calls.length).toBeGreaterThan(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('times out an authoritative result request that never responds', async () => {
    vi.useFakeTimers();
    try {
      const { adapter, subscription } = await signedAdapter();
      mockXummInstance.payload.get.mockImplementation(() => new Promise(() => {}));

      const submitPromise = adapter.signAndSubmit(REQUESTED_TRANSACTION);
      const rejection = expect(submitPromise).rejects.toMatchObject({
        code: WalletErrorCode.SIGN_FAILED,
      });
      await subscription.emit({ signed: true });
      await vi.advanceTimersByTimeAsync(30_000);

      await rejection;
      expect(mockXummInstance.payload.get).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a submission dispatched to a different network', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(true, { dispatched_nodetype: 'TESTNET' })
    );

    const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
    const rejection = expect(submitPromise).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_MISMATCH,
    });
    await subscription.emit({ signed: true });

    await rejection;
  });

  it.each(['terQUEUED', 'tecPATH_DRY'])(
    'preserves the transaction hash for an accepted %s result',
    async (dispatchResult) => {
      const { adapter, subscription } = await signedAdapter();
      mockXummInstance.payload.get.mockResolvedValue(
        resolvedPayload(true, { dispatched_result: dispatchResult })
      );

      const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
      await subscription.emit({ signed: true });

      await expect(submitPromise).resolves.toMatchObject({ hash: SIGNED_TX_HASH });
      expect(subscription.close).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    ['no node dispatch', false, null],
    ['a tef failure', true, 'tefPAST_SEQ'],
    ['a malformed transaction', true, 'temBAD_FEE'],
    ['a non-queued retry result', true, 'terPRE_SEQ'],
  ])(
    'fails submission after %s even when a txid exists',
    async (_description, dispatched, result) => {
      const { adapter, subscription } = await signedAdapter();
      mockXummInstance.payload.get.mockResolvedValue(
        resolvedPayload(true, {
          dispatched_to_node: dispatched,
          dispatched_result: result,
        })
      );

      const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
      const rejection = expect(submitPromise).rejects.toMatchObject({
        code: WalletErrorCode.SIGN_FAILED,
      });
      await subscription.emit({ signed: true });

      await rejection;
      expect(subscription.close).toHaveBeenCalledTimes(1);
    }
  );
});

describe('XamanAdapter.disconnect', () => {
  it('aborts authoritative result retrieval before logging out', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockImplementation(() => new Promise(() => {}));
    mockXummInstance.logout.mockResolvedValue(undefined);

    const submitPromise = adapter.signAndSubmit(REQUESTED_TRANSACTION);
    await subscription.emit({ signed: true });
    await vi.waitFor(() => expect(mockXummInstance.payload.get).toHaveBeenCalledTimes(1));

    const disconnectPromise = adapter.disconnect();

    await expect(submitPromise).rejects.toMatchObject({ code: WalletErrorCode.SIGN_FAILED });
    await disconnectPromise;
    expect(mockXummInstance.logout).toHaveBeenCalledTimes(1);
  });

  it('authoritatively cancels a payload that finishes creating after disconnect', async () => {
    const { adapter } = await signedAdapter();
    let resolveCreation: ((payload: Record<string, unknown>) => void) | undefined;
    const creation = new Promise<Record<string, unknown>>((resolve) => {
      resolveCreation = resolve;
    });
    const lateClose = vi.fn();
    mockXummInstance.payload.cancel.mockResolvedValue(confirmedCancellation());
    mockXummInstance.logout.mockResolvedValue(undefined);
    mockXummInstance.payload.createAndSubscribe.mockImplementationOnce(() => creation);

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    await vi.waitFor(() => expect(mockXummInstance.payload.createAndSubscribe).toHaveBeenCalled());
    const disconnectPromise = adapter.disconnect();

    resolveCreation?.({
      created: {
        uuid: 'late-payload',
        next: { always: 'https://xaman.app/sign/late-payload' },
      },
      resolved: new Promise(() => {}),
      resolve: lateClose,
    });

    await expect(signPromise).rejects.toMatchObject({ code: WalletErrorCode.SIGN_FAILED });
    await disconnectPromise;
    expect(lateClose).toHaveBeenCalledTimes(1);
    expect(mockXummInstance.payload.cancel).toHaveBeenCalledWith('late-payload', true);
    expect(mockXummInstance.logout).toHaveBeenCalledTimes(1);
  });

  it('cancels an active signing subscription before logging out', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.cancel.mockResolvedValue(confirmedCancellation());
    mockXummInstance.logout.mockResolvedValue(undefined);

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    await subscription.ready;
    const disconnectPromise = adapter.disconnect();

    await expect(signPromise).rejects.toMatchObject({ code: WalletErrorCode.SIGN_FAILED });
    expect(subscription.close).toHaveBeenCalledTimes(1);
    expect(mockXummInstance.payload.get).not.toHaveBeenCalled();
    expect(mockXummInstance.payload.cancel).toHaveBeenCalledWith('payload-uuid', true);
    await disconnectPromise;
    expect(mockXummInstance.logout).toHaveBeenCalledTimes(1);
  });

  it('locally closes an opened sign-only payload before logging out', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.logout.mockResolvedValue(undefined);

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    await subscription.emit({ opened: true });
    const disconnectPromise = adapter.disconnect();

    await expect(signPromise).rejects.toMatchObject({ code: WalletErrorCode.SIGN_FAILED });
    await disconnectPromise;
    expect(subscription.close).toHaveBeenCalledTimes(1);
    expect(mockXummInstance.payload.cancel).not.toHaveBeenCalled();
    expect(mockXummInstance.logout).toHaveBeenCalledTimes(1);
  });

  it('makes concurrent disconnects wait for an opened submission before logging out', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(resolvedPayload(true));
    mockXummInstance.logout.mockResolvedValue(undefined);

    const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
    await subscription.emit({ opened: true });
    let disconnected = false;
    const disconnectPromise = adapter.disconnect().then(() => {
      disconnected = true;
    });
    let secondDisconnectFinished = false;
    const secondDisconnect = adapter.disconnect().then(() => {
      secondDisconnectFinished = true;
    });
    await Promise.resolve();

    expect(disconnected).toBe(false);
    expect(secondDisconnectFinished).toBe(false);
    expect(mockXummInstance.payload.cancel).not.toHaveBeenCalled();
    expect(mockXummInstance.logout).not.toHaveBeenCalled();
    expect(subscription.close).not.toHaveBeenCalled();

    await subscription.emit({ signed: true });
    await expect(submitPromise).resolves.toMatchObject({ hash: SIGNED_TX_HASH });
    await Promise.all([disconnectPromise, secondDisconnect]);
    expect(mockXummInstance.logout).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting when cancellation reports that the payload was already opened', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.cancel.mockResolvedValue({
      result: { cancelled: false, reason: 'ALREADY_OPENED' },
      meta: { app_opened: true, resolved: false, signed: false },
    });
    mockXummInstance.payload.get.mockResolvedValue(resolvedPayload(true));
    mockXummInstance.logout.mockResolvedValue(undefined);

    const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
    await subscription.ready;
    const disconnectPromise = adapter.disconnect();
    await vi.waitFor(() => expect(mockXummInstance.payload.cancel).toHaveBeenCalledTimes(1));

    expect(subscription.close).not.toHaveBeenCalled();
    expect(mockXummInstance.logout).not.toHaveBeenCalled();

    await subscription.emit({ signed: true });
    await expect(submitPromise).resolves.toMatchObject({ hash: SIGNED_TX_HASH });
    await disconnectPromise;
    expect(mockXummInstance.logout).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting when cancellation fails ambiguously', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.cancel.mockRejectedValue(new Error('network unavailable'));
    mockXummInstance.payload.get.mockResolvedValue(resolvedPayload(true));
    mockXummInstance.logout.mockResolvedValue(undefined);

    const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
    await subscription.ready;
    const disconnectPromise = adapter.disconnect();
    await vi.waitFor(() => expect(mockXummInstance.payload.cancel).toHaveBeenCalledTimes(1));

    expect(subscription.close).not.toHaveBeenCalled();
    expect(mockXummInstance.logout).not.toHaveBeenCalled();

    await subscription.emit({ signed: true });
    await expect(submitPromise).resolves.toMatchObject({ hash: SIGNED_TX_HASH });
    await disconnectPromise;
  });

  it('fetches an already-resolved payload instead of waiting for a missed event', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.cancel.mockResolvedValue({
      result: { cancelled: false, reason: 'ALREADY_RESOLVED' },
      meta: { app_opened: false, resolved: true, signed: true },
    });
    mockXummInstance.payload.get.mockResolvedValue(resolvedPayload(true));
    mockXummInstance.logout.mockResolvedValue(undefined);

    const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
    await subscription.ready;
    const disconnectPromise = adapter.disconnect();

    await expect(submitPromise).resolves.toMatchObject({ hash: SIGNED_TX_HASH });
    await disconnectPromise;
    expect(mockXummInstance.payload.get).toHaveBeenCalledWith('payload-uuid', true);
    expect(mockXummInstance.logout).toHaveBeenCalledTimes(1);
  });

  it('rejects reconnect while a payload is still active', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(resolvedPayload(false));
    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    await subscription.emit({ opened: true });

    await expect(adapter.connect({ onQRCode: () => {} })).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });

    await subscription.emit({ signed: true });
    await expect(signPromise).resolves.toMatchObject({ hash: SIGNED_TX_HASH });
  });

  it('rejects state restoration while a payload is still active', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(resolvedPayload(false));
    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    await subscription.emit({ opened: true });

    await expect(adapter.checkXamanState()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });

    await subscription.emit({ signed: true });
    await expect(signPromise).resolves.toMatchObject({ hash: SIGNED_TX_HASH });
  });

  it('logs out and clears local state', async () => {
    mockXummInstance.authorize.mockResolvedValue({ me: { account: CONNECTED_ACCOUNT } });
    mockXummInstance.logout.mockResolvedValue(undefined);
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await adapter.connect();
    expect(await adapter.getAccount()).not.toBeNull();

    await adapter.disconnect();

    expect(mockXummInstance.logout).toHaveBeenCalled();
    expect(await adapter.getAccount()).toBeNull();
  });

  it('still clears state when logout throws', async () => {
    mockXummInstance.authorize.mockResolvedValue({ me: { account: CONNECTED_ACCOUNT } });
    mockXummInstance.logout.mockRejectedValue(new Error('already logged out'));
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await adapter.connect();

    await adapter.disconnect();

    expect(await adapter.getAccount()).toBeNull();
  });
});
