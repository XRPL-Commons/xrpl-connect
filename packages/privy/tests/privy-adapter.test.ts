// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { webcrypto } from 'node:crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import {
  decode,
  deriveAddress,
  encodeForMultiSigning,
  encodeForSigning,
  encodeForSigningBatch,
  hashes,
  verifyKeypairSignature,
} from 'xrpl';
import {
  createWalletError,
  MemoryStorageAdapter,
  WalletErrorCode,
  WalletManager,
  type Transaction,
  type WalletAuthPrompt,
} from 'xrpl-connect';
import {
  PrivyAdapter,
  type PrivyAdapterOptions,
  type PrivyTransactionReviewOption,
} from '../src/privy-adapter';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  signHash: vi.fn(),
  getAccessToken: vi.fn(),
  pending: vi.fn(),
  onAuthPrompt: vi.fn(),
  lost: undefined as (() => void) | undefined,
  clientConnect: vi.fn(),
  clientDisconnect: vi.fn(),
  autofill: vi.fn(),
  submit: vi.fn(),
}));

vi.mock('../src/session', () => ({
  PrivySession: class {
    connect = mocks.connect;
    disconnect = mocks.disconnect;
    signHash = mocks.signHash;
    getAccessToken = mocks.getAccessToken;
    hasPendingConnection = mocks.pending;
    onAuthPrompt = mocks.onAuthPrompt;
    onSessionLost(callback: () => void) {
      mocks.lost = callback;
      return () => {};
    }
  },
}));
vi.mock('xrpl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xrpl')>();
  return {
    ...actual,
    Client: class {
      connect = mocks.clientConnect;
      disconnect = mocks.clientDisconnect;
      autofill = mocks.autofill;
      submitAndWait = mocks.submit;
    },
  };
});

const privateKey = '1'.padStart(64, '0');
const publicKey = Array.from(secp256k1.getPublicKey(privateKey), (v) =>
  v.toString(16).padStart(2, '0')
)
  .join('')
  .toUpperCase();
const wallet = {
  id: 'wallet-1',
  userId: 'did:privy:one',
  publicKey,
  address: deriveAddress(publicKey),
};
const reviewedOptions: PrivyAdapterOptions = {
  appId: 'app',
  redirectUri: 'http://localhost/callback',
  loginMethods: [{ id: 'google', oauthProvider: 'google' as const }],
};
// Lifecycle and signing-mechanics tests sign headlessly; the transaction
// review, which is on by default, has its own tests below.
const options: PrivyAdapterOptions = { ...reviewedOptions, transactionReview: 'none' };
const transaction: Transaction = {
  TransactionType: 'AccountSet',
  Account: wallet.address,
  Fee: '12',
  Sequence: 1,
  LastLedgerSequence: 100,
};

const otherAddress = deriveAddress(
  Array.from(secp256k1.getPublicKey('2'.padStart(64, '0')), (v) =>
    v.toString(16).padStart(2, '0')
  ).join('')
);

const batchTransaction: Transaction = {
  TransactionType: 'Batch',
  Account: wallet.address,
  Fee: '12',
  Sequence: 7,
  Flags: 0,
  RawTransactions: [
    {
      RawTransaction: {
        TransactionType: 'AccountSet',
        Account: wallet.address,
        Fee: '0',
        Sequence: 1,
        Flags: 0x40000000,
        SigningPubKey: '',
      },
    },
  ],
} as Transaction;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', {});
  mocks.connect.mockResolvedValue(wallet);
  mocks.disconnect.mockResolvedValue(undefined);
  mocks.clientConnect.mockResolvedValue(undefined);
  mocks.clientDisconnect.mockResolvedValue(undefined);
  mocks.autofill.mockImplementation(async (tx) => ({
    ...tx,
    Fee: '12',
    Sequence: 1,
    LastLedgerSequence: 100,
  }));
  mocks.signHash.mockImplementation(
    async (_wallet, hash: string) => `0x${secp256k1.sign(hash.slice(2), privateKey).toCompactHex()}`
  );
  mocks.getAccessToken.mockResolvedValue(null);
  mocks.submit.mockResolvedValue({
    result: { hash: 'validated-hash', meta: { TransactionResult: 'tesSUCCESS' } },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('PrivyAdapter', () => {
  it('exposes the active Privy access token without exposing the session', async () => {
    mocks.getAccessToken.mockResolvedValue('privy-access-token');
    const adapter = new PrivyAdapter(options);
    await adapter.connect();

    await expect(adapter.getAccessToken()).resolves.toBe('privy-access-token');
    await adapter.disconnect();
    await expect(adapter.getAccessToken()).resolves.toBeNull();
  });

  it.each([
    ['mfa_required', WalletErrorCode.SIGN_FAILED],
    ['mfa_cancelled', WalletErrorCode.SIGN_REJECTED],
    ['mfa_timeout', WalletErrorCode.OPERATION_TIMEOUT],
  ] as const)('preserves the top-level MFA reason (%s)', async (reason, code) => {
    const adapter = new PrivyAdapter(options);
    await adapter.connect();
    mocks.signHash.mockRejectedValueOnce(Object.assign(new Error('MFA failed'), { reason }));

    await expect(adapter.sign(transaction)).rejects.toMatchObject({ code, reason });
    await adapter.disconnect();
  });

  it('discards a token refresh that completes after signing in again', async () => {
    const adapter = new PrivyAdapter(options);
    await adapter.connect();
    const refreshed = deferred<string>();
    mocks.getAccessToken.mockReturnValueOnce(refreshed.promise);
    const token = adapter.getAccessToken();
    await adapter.disconnect();
    await adapter.connect();
    refreshed.resolve('previous-session');
    await expect(token).resolves.toBeNull();
    await adapter.disconnect();
  });

  it('connects only once the session has a validated XRPL wallet and saves identity only', async () => {
    const ready = deferred<typeof wallet>();
    mocks.connect.mockReturnValueOnce(ready.promise);
    const adapter = new PrivyAdapter(options);
    const connecting = adapter.connect({ network: 'testnet', loginMethod: 'google' });
    expect(await adapter.getAccount()).toBeNull();
    ready.resolve(wallet);
    const account = await connecting;
    expect(account.address).toBe(wallet.address);
    expect(account.network.id).toBe('testnet');
    expect(adapter.serializeReconnectOptions()).toEqual({
      privyWalletId: wallet.id,
      privyUserId: wallet.userId,
    });
    account.network.id = 'mutated';
    expect((await adapter.getNetwork()).id).toBe('testnet');
    await adapter.disconnect();
  });

  it('does not connect after cancellation, even if wallet creation completes late', async () => {
    const ready = deferred<typeof wallet>();
    mocks.connect.mockReturnValueOnce(ready.promise);
    const adapter = new PrivyAdapter(options);
    const connecting = adapter.connect();
    const rejection = expect(connecting).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
    await vi.waitFor(() => expect(mocks.connect).toHaveBeenCalled());
    await adapter.disconnect();
    ready.resolve(wallet);
    await rejection;
    expect(await adapter.getAccount()).toBeNull();
  });

  it('keeps the provider error visible after cleaning up a failed login', async () => {
    const failure = Object.assign(new Error('Origin not allowed'), {
      status: 403,
      code: 'invalid_origin',
    });
    mocks.connect.mockRejectedValueOnce(failure);
    const adapter = new PrivyAdapter(options);
    await expect(adapter.connect({ loginMethod: 'google' })).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
      message: expect.stringContaining('Origin not allowed'),
      originalError: failure,
    });
    expect(await adapter.getAccount()).toBeNull();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(mocks.disconnect).toHaveBeenCalledWith({ preserveProviderSession: false });

    await expect(adapter.connect({ loginMethod: 'google' })).resolves.toMatchObject({
      address: wallet.address,
    });
    await adapter.disconnect();
  });

  it('restores the same wallet without persisting login credentials', async () => {
    const adapter = new PrivyAdapter(options);
    await adapter.connect({ privyWalletId: wallet.id, privyUserId: wallet.userId });
    expect(mocks.connect).toHaveBeenCalledWith(undefined, expect.any(AbortSignal), {
      walletId: wallet.id,
      userId: wallet.userId,
    });
    await adapter.disconnect();
  });

  it('keeps the Privy session and the saved state when a restore times out', async () => {
    const adapter = new PrivyAdapter(options);
    const storage = new MemoryStorageAdapter();
    const manager = new WalletManager({ adapters: [adapter], autoConnect: false, storage });
    await manager.connect('privy', { loginMethod: 'google' });
    // Simulate a page reload: the saved state remains, the adapter is fresh.
    const reloaded = new PrivyAdapter(options);
    const restored = new WalletManager({ adapters: [reloaded], autoConnect: false, storage });
    mocks.connect.mockClear();
    mocks.disconnect.mockClear();

    mocks.connect.mockRejectedValueOnce(createWalletError.operationTimeout('Privy user restore'));
    await expect(restored.reconnect()).resolves.toBeNull();
    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(mocks.disconnect).toHaveBeenCalledWith({ preserveProviderSession: true });

    await expect(restored.reconnect()).resolves.toMatchObject({ address: wallet.address });
    expect(mocks.connect).toHaveBeenLastCalledWith(undefined, expect.any(AbortSignal), {
      walletId: wallet.id,
      userId: wallet.userId,
    });
    await restored.disconnect();
    expect(mocks.disconnect).toHaveBeenLastCalledWith({ preserveProviderSession: false });
  });

  it('subscribes auth prompt listeners on the session so it knows when nobody listens', () => {
    const unsubscribe = vi.fn();
    mocks.onAuthPrompt.mockReturnValue(unsubscribe);
    const adapter = new PrivyAdapter(options);
    expect(mocks.onAuthPrompt).not.toHaveBeenCalled();

    const listener = vi.fn();
    const stop = adapter.onAuthPrompt(listener);
    expect(mocks.onAuthPrompt).toHaveBeenCalledWith(listener);
    expect(unsubscribe).not.toHaveBeenCalled();
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('cancels a new login that is still waiting for a previous logout', async () => {
    const logout = deferred<void>();
    const adapter = new PrivyAdapter(options);
    await adapter.connect();
    mocks.disconnect.mockReturnValueOnce(logout.promise);
    const firstLogout = adapter.disconnect();
    const reconnecting = adapter.connect();
    const rejected = expect(reconnecting).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
    const secondLogout = adapter.disconnect();
    logout.resolve();
    await Promise.all([firstLogout, secondLogout, rejected]);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(await adapter.getAccount()).toBeNull();
  });

  it('rejects unknown networks and malformed account identity', async () => {
    const adapter = new PrivyAdapter(options);
    await expect(adapter.connect({ network: 'invalid' as 'testnet' })).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_NOT_SUPPORTED,
    });
    mocks.connect.mockResolvedValueOnce({ ...wallet, publicKey: 'bad' });
    await expect(adapter.connect()).rejects.toThrow('public key');
    expect(await adapter.getAccount()).toBeNull();
    expect(mocks.disconnect).toHaveBeenCalled();
  });

  it('rejects a different valid wallet or user returned during restoration', async () => {
    const adapter = new PrivyAdapter(options);
    await expect(
      adapter.connect({ privyWalletId: 'other-wallet', privyUserId: wallet.userId })
    ).rejects.toThrow('does not match the saved');
    await expect(
      adapter.connect({ privyWalletId: wallet.id, privyUserId: 'other-user' })
    ).rejects.toThrow('does not match the saved');
    expect(await adapter.getAccount()).toBeNull();
  });

  it('signs prepared transactions offline and autofills incomplete transactions', async () => {
    const adapter = new PrivyAdapter(options);
    await adapter.connect({ network: 'testnet' });
    const signed = await adapter.sign(transaction);
    expect(
      verifyKeypairSignature(encodeForSigning(signed.tx_json!), signed.signature!, publicKey)
    ).toBe(true);
    expect(mocks.clientConnect).not.toHaveBeenCalled();
    await adapter.sign({ TransactionType: 'AccountSet', Account: wallet.address });
    expect(mocks.autofill).toHaveBeenCalledTimes(1);
    await adapter.disconnect();
    expect(mocks.clientDisconnect).toHaveBeenCalledTimes(1);
  });

  it('returns validated ledger results, including tec failures, with their hash', async () => {
    const adapter = new PrivyAdapter(options);
    await adapter.connect();
    expect(await adapter.signAndSubmit(transaction)).toMatchObject({
      hash: 'validated-hash',
      signerAddress: wallet.address,
      transactionResult: 'tesSUCCESS',
    });
    mocks.submit.mockResolvedValueOnce({
      result: { hash: 'failed', meta: { TransactionResult: 'tecUNFUNDED_PAYMENT' } },
    });
    await expect(adapter.signAndSubmit(transaction)).resolves.toMatchObject({
      hash: 'failed',
      id: 'failed',
      transactionResult: 'tecUNFUNDED_PAYMENT',
    });
    expect(mocks.clientConnect).toHaveBeenCalledTimes(1);
    expect(mocks.clientDisconnect).not.toHaveBeenCalled();
    await adapter.disconnect();
    expect(mocks.clientDisconnect).toHaveBeenCalledTimes(1);
  });

  it('never submits a signature that finishes after disconnect', async () => {
    const signature = deferred<string>();
    mocks.signHash.mockReturnValueOnce(signature.promise);
    const adapter = new PrivyAdapter(options);
    await adapter.connect();
    const signing = adapter.signAndSubmit(transaction);
    const rejection = expect(signing).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
    await vi.waitFor(() => expect(mocks.signHash).toHaveBeenCalled());
    const hash = mocks.signHash.mock.calls[0][1] as string;
    await adapter.disconnect();
    signature.resolve(`0x${secp256k1.sign(hash.slice(2), privateKey).toCompactHex()}`);
    await rejection;
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('does not start autofill when a network connection completes after logout', async () => {
    const connected = deferred<void>();
    mocks.clientConnect.mockReturnValueOnce(connected.promise);
    const adapter = new PrivyAdapter(options);
    await adapter.connect();
    const signing = adapter.sign({ TransactionType: 'AccountSet', Account: wallet.address });
    const rejected = expect(signing).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    await adapter.disconnect();
    connected.resolve();
    await rejected;
    expect(mocks.autofill).not.toHaveBeenCalled();
    expect(mocks.signHash).not.toHaveBeenCalled();
    expect(mocks.clientDisconnect).toHaveBeenCalledOnce();
  });

  it('fills the ledger bound before submitting an otherwise prepared transaction', async () => {
    const adapter = new PrivyAdapter(options);
    await adapter.connect();
    const { LastLedgerSequence: _lastLedgerSequence, ...unbounded } = transaction;
    const result = await adapter.signAndSubmit(unbounded as Transaction);
    expect(result.tx_json?.LastLedgerSequence).toBe(100);
    expect(mocks.autofill).toHaveBeenCalledTimes(1);
    await adapter.disconnect();
  });

  it('retains the validated result when logout occurs after submission', async () => {
    const submitted = deferred<{ result: { hash: string; meta: { TransactionResult: string } } }>();
    mocks.submit.mockReturnValueOnce(submitted.promise);
    const adapter = new PrivyAdapter(options);
    await adapter.connect();
    const signing = adapter.signAndSubmit(transaction);
    await vi.waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));
    await adapter.disconnect();
    submitted.resolve({
      result: { hash: 'validated-hash', meta: { TransactionResult: 'tesSUCCESS' } },
    });
    expect(await signing).toMatchObject({ hash: 'validated-hash' });
    expect(await adapter.getAccount()).toBeNull();
  });

  it('reports session expiry through the manager and disables unsupported signing', async () => {
    const adapter = new PrivyAdapter(options);
    const manager = new WalletManager({ adapters: [adapter], autoConnect: false });
    await manager.connect('privy');
    mocks.lost?.();
    await vi.waitFor(() => expect(manager.connected).toBe(false));
    await expect(adapter.signMessage('message')).rejects.toMatchObject({
      code: WalletErrorCode.UNSUPPORTED_METHOD,
    });
    await expect(adapter.sign(transaction)).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
  });

  it('reports a failed login without waiting for its teardown', async () => {
    const teardown = deferred<void>();
    mocks.connect.mockRejectedValueOnce(createWalletError.operationTimeout('Privy login'));
    mocks.disconnect.mockReturnValueOnce(teardown.promise);
    const adapter = new PrivyAdapter(options);

    await expect(adapter.connect({ loginMethod: 'google' })).rejects.toMatchObject({
      code: WalletErrorCode.OPERATION_TIMEOUT,
    });

    // The next login still waits for the teardown to finish.
    const retry = adapter.connect({ loginMethod: 'google' });
    await Promise.resolve();
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    teardown.resolve();
    await expect(retry).resolves.toMatchObject({ address: wallet.address });
    await adapter.disconnect();
  });

  it('keeps the Privy session when a restore is rejected for an incomplete identity', async () => {
    const adapter = new PrivyAdapter(options);
    await expect(adapter.connect({ privyWalletId: wallet.id })).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.disconnect).toHaveBeenCalledWith({ preserveProviderSession: true });
  });

  it('logs out when a disconnect joins a teardown that preserves the session', async () => {
    const teardown = deferred<void>();
    mocks.connect.mockRejectedValueOnce(createWalletError.operationTimeout('Privy user restore'));
    mocks.disconnect.mockReturnValueOnce(teardown.promise);
    const adapter = new PrivyAdapter(options);
    await expect(
      adapter.connect({ privyWalletId: wallet.id, privyUserId: wallet.userId })
    ).rejects.toMatchObject({ code: WalletErrorCode.OPERATION_TIMEOUT });
    expect(mocks.disconnect).toHaveBeenLastCalledWith({ preserveProviderSession: true });

    const disconnecting = adapter.disconnect();
    expect(mocks.disconnect).toHaveBeenCalledTimes(2);
    expect(mocks.disconnect).toHaveBeenLastCalledWith();
    teardown.resolve();
    await disconnecting;
  });

  it('returns a validated submission even when closing the ledger connection fails', async () => {
    mocks.clientDisconnect.mockRejectedValueOnce(new Error('websocket close failed'));
    const adapter = new PrivyAdapter(options);
    await adapter.connect();
    await expect(adapter.signAndSubmit(transaction)).resolves.toMatchObject({
      hash: 'validated-hash',
      transactionResult: 'tesSUCCESS',
    });
    await adapter.disconnect();
  });

  it('closes an idle ledger connection and opens a new one for the next signature', async () => {
    vi.useFakeTimers();
    try {
      const adapter = new PrivyAdapter(options);
      await adapter.connect();
      await adapter.signAndSubmit(transaction);
      await adapter.signAndSubmit(transaction);
      expect(mocks.clientConnect).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(mocks.clientDisconnect).toHaveBeenCalledTimes(1);

      await adapter.signAndSubmit(transaction);
      expect(mocks.clientConnect).toHaveBeenCalledTimes(2);
      await adapter.disconnect();
      expect(mocks.clientDisconnect).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens a new ledger connection after one fails', async () => {
    mocks.clientConnect.mockRejectedValueOnce(new Error('websocket unreachable'));
    const adapter = new PrivyAdapter(options);
    await adapter.connect();
    await expect(adapter.signAndSubmit(transaction)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    await expect(adapter.signAndSubmit(transaction)).resolves.toMatchObject({
      hash: 'validated-hash',
    });
    expect(mocks.clientConnect).toHaveBeenCalledTimes(2);
    await adapter.disconnect();
  });

  it('does not reuse a ledger connection across a lost session and a network change', async () => {
    const adapter = new PrivyAdapter(options);
    await adapter.connect({ network: 'testnet' });
    await adapter.signAndSubmit(transaction);
    expect(mocks.clientConnect).toHaveBeenCalledTimes(1);

    mocks.lost?.();
    expect(mocks.clientDisconnect).toHaveBeenCalledTimes(1);

    await adapter.connect({ network: 'mainnet' });
    await adapter.signAndSubmit(transaction);
    expect(mocks.clientConnect).toHaveBeenCalledTimes(2);
    await adapter.disconnect();
  });
});

describe('PrivyAdapter transaction review', () => {
  const destination = deriveAddress(
    Array.from(secp256k1.getPublicKey('2'.padStart(64, '0')), (v) =>
      v.toString(16).padStart(2, '0')
    ).join('')
  );
  const payment: Transaction = {
    TransactionType: 'Payment',
    Account: wallet.address,
    Destination: destination,
    DestinationTag: 42,
    Amount: '1500000',
    Fee: '12',
    Sequence: 7,
    LastLedgerSequence: 100,
  };

  beforeEach(() => {
    mocks.onAuthPrompt.mockReturnValue(() => undefined);
  });

  function watchPrompts(adapter: PrivyAdapter) {
    const prompts: (WalletAuthPrompt | null)[] = [];
    const stop = adapter.onAuthPrompt((prompt) => prompts.push(prompt));
    const reviews = () => prompts.filter((prompt): prompt is WalletAuthPrompt => !!prompt);
    const nextReview = async (count: number) => {
      await vi.waitFor(() => expect(reviews()).toHaveLength(count));
      return reviews()[count - 1];
    };
    return { prompts, stop, nextReview };
  }

  async function connected(adapterOptions: PrivyAdapterOptions = reviewedOptions) {
    const adapter = new PrivyAdapter(adapterOptions);
    await adapter.connect({ network: 'testnet' });
    return adapter;
  }

  it('shows the exact transaction and signs only after approval', async () => {
    const adapter = await connected();
    const { prompts, nextReview } = watchPrompts(adapter);
    const signing = adapter.sign(payment);

    const prompt = await nextReview(1);
    expect(mocks.signHash).not.toHaveBeenCalled();
    expect(prompt).toMatchObject({ title: 'Review transaction', submitLabel: 'Approve' });
    expect(prompt.review?.action).toBe('sign');
    expect(prompt.review?.network.id).toBe('testnet');
    expect(prompt.review?.transaction).toMatchObject({ ...payment, SigningPubKey: publicKey });
    expect(prompt.review?.details.slice(0, 7)).toEqual([
      { name: 'TransactionType', label: 'Transaction type', value: 'Payment' },
      { name: 'Amount', label: 'Amount', value: '1.5 XRP' },
      { name: 'Destination', label: 'Destination', value: destination },
      { name: 'DestinationTag', label: 'Destination tag', value: '42' },
      { name: 'Fee', label: 'Fee', value: '0.000012 XRP' },
      { name: 'network', label: 'Network', value: 'Testnet' },
      { name: 'Account', label: 'Account', value: wallet.address },
    ]);
    expect(prompt.review?.details.map(({ name }) => name).slice(7)).toEqual([
      'Sequence',
      'LastLedgerSequence',
      'SigningPubKey',
    ]);
    expect(Object.isFrozen(prompt) && Object.isFrozen(prompt.review?.details[0])).toBe(true);

    await prompt.submit!({});
    const signed = await signing;
    expect(mocks.signHash).toHaveBeenCalledOnce();
    expect(signed.tx_json).toMatchObject(payment);
    expect(prompts.at(-1)).toBeNull();
    await adapter.disconnect();
  });

  it('manages an ordinary multisign contribution and labels its signing role', async () => {
    const adapter = new PrivyAdapter(reviewedOptions);
    const manager = new WalletManager({ adapters: [adapter], autoConnect: false });
    await manager.connect('privy', { network: 'testnet' });
    const { nextReview } = watchPrompts(adapter);
    const multisigned = {
      ...payment,
      Account: otherAddress,
      SigningPubKey: '',
    } as Transaction;
    const signing = manager.sign(multisigned);
    const prompt = await nextReview(1);

    expect(prompt.review?.signingRole).toBe('multisign');
    expect(prompt.review?.details[0]).toEqual({
      name: 'signingRole',
      label: 'Signing role',
      value: 'Ordinary multisignature',
    });
    expect(prompt.description).toContain('multisignature contribution');
    await prompt.submit!({});

    const signed = await signing;
    expect(signed.hash).toBe('');
    expect(signed.signerAddress).toBe(wallet.address);
    expect(signed.tx_json).toMatchObject({ Account: otherAddress, SigningPubKey: '' });
    expect(signed.tx_json?.TxnSignature).toBeUndefined();
    expect(signed.tx_json?.Signers).toHaveLength(1);
    expect(
      verifyKeypairSignature(
        encodeForMultiSigning(signed.tx_json!, wallet.address),
        signed.signature!,
        publicKey
      )
    ).toBe(true);

    await expect(manager.signAndSubmit(multisigned)).rejects.toMatchObject({
      code: WalletErrorCode.UNSUPPORTED_METHOD,
    });
    await manager.disconnect();
  });

  it('creates an explicit BatchSigner contribution without changing outer Batch signing', async () => {
    const adapter = await connected();
    const { nextReview } = watchPrompts(adapter);
    const contributionPromise = adapter.signBatch(batchTransaction);
    const contributionPrompt = await nextReview(1);

    expect(contributionPrompt.review?.signingRole).toBe('batch');
    expect(contributionPrompt.review?.details[0]).toEqual({
      name: 'signingRole',
      label: 'Signing role',
      value: 'BatchSigner',
    });
    expect(contributionPrompt.review?.batchAccount).toBe(wallet.address);
    expect(contributionPrompt.review?.signerAccount).toBeUndefined();
    expect(contributionPrompt.review?.details[1]).toEqual({
      name: 'batchAccount',
      label: 'Batch account',
      value: wallet.address,
    });
    expect(contributionPrompt.review?.details.find(({ name }) => name === 'RawTransactions')).toBeDefined();
    await contributionPrompt.submit!({});

    const contribution = await contributionPromise;
    expect(contribution.hash).toBe('');
    expect(contribution.tx_json?.BatchSigners).toHaveLength(1);
    expect(decode(contribution.tx_blob!).BatchSigners).toHaveLength(1);
    const contributionPreimage = encodeForSigningBatch({
      account: batchTransaction.Account,
      sequence: batchTransaction.Sequence,
      flags: batchTransaction.Flags,
      txIDs: [hashes.hashSignedTx(batchTransaction.RawTransactions![0].RawTransaction as never)],
      batchAccount: wallet.address,
    });
    expect(
      verifyKeypairSignature(contributionPreimage, contribution.signature!, publicKey)
    ).toBe(true);

    const outerPromise = adapter.sign(batchTransaction);
    const outerPrompt = await nextReview(2);
    await outerPrompt.submit!({});
    const outer = await outerPromise;
    expect(outer.hash).not.toBe('');
    expect(outer.tx_json).toMatchObject({
      TransactionType: 'Batch',
      SigningPubKey: publicKey,
    });
    const submitting = adapter.signAndSubmit(batchTransaction);
    const submitPrompt = await nextReview(3);
    await submitPrompt.submit!({});
    await expect(submitting).resolves.toMatchObject({
      hash: 'validated-hash',
      tx_json: { TransactionType: 'Batch' },
    });
    await adapter.disconnect();
  });

  it('distinguishes BatchSigner account contexts in sequential prompts', async () => {
    const adapter = await connected();
    const { nextReview } = watchPrompts(adapter);
    const first = adapter.signBatch(batchTransaction);
    const firstPrompt = await nextReview(1);
    expect(firstPrompt.review?.batchAccount).toBe(wallet.address);
    firstPrompt.cancel();
    await expect(first).rejects.toMatchObject({ code: WalletErrorCode.SIGN_REJECTED });

    const foreignBatch = {
      ...batchTransaction,
      RawTransactions: [
        {
          RawTransaction: {
            ...(batchTransaction.RawTransactions![0].RawTransaction as Record<string, unknown>),
            Account: otherAddress,
          },
        },
      ],
    } as Transaction;
    const second = adapter.signBatch(foreignBatch, {
      batchAccount: otherAddress,
      multisign: true,
    });
    const secondPrompt = await nextReview(2);
    expect(secondPrompt.review?.batchAccount).toBe(otherAddress);
    expect(secondPrompt.review?.signerAccount).toBe(wallet.address);
    expect(secondPrompt.review?.details).toEqual(
      expect.arrayContaining([
        { name: 'batchAccount', label: 'Batch account', value: otherAddress },
        { name: 'signerAccount', label: 'Nested signer account', value: wallet.address },
      ])
    );
    secondPrompt.cancel();
    await expect(second).rejects.toMatchObject({ code: WalletErrorCode.SIGN_REJECTED });
    await adapter.disconnect();
  });

  it('serializes the full review-to-sign operation with transactionReview none', async () => {
    const adapter = await connected({ ...reviewedOptions, transactionReview: 'none' });
    const firstSign = deferred<string>();
    const secondSign = deferred<string>();
    mocks.signHash.mockReset();
    mocks.signHash.mockReturnValueOnce(firstSign.promise).mockReturnValueOnce(secondSign.promise);

    const first = adapter.sign(payment);
    await vi.waitFor(() => expect(mocks.signHash).toHaveBeenCalledOnce());
    const second = adapter.sign({ ...payment, Sequence: 8 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.signHash).toHaveBeenCalledOnce();

    const firstHash = mocks.signHash.mock.calls[0][1] as string;
    firstSign.resolve(`0x${secp256k1.sign(firstHash.slice(2), privateKey).toCompactHex()}`);
    await first;
    await vi.waitFor(() => expect(mocks.signHash).toHaveBeenCalledTimes(2));
    const secondHash = mocks.signHash.mock.calls[1][1] as string;
    secondSign.resolve(`0x${secp256k1.sign(secondHash.slice(2), privateKey).toCompactHex()}`);
    await second;
    await adapter.disconnect();
  });

  it('does not submit a partial foreign-account BatchSigner payload', async () => {
    const adapter = await connected({ ...reviewedOptions, transactionReview: 'none' });
    const partial = {
      ...batchTransaction,
      RawTransactions: [
        {
          RawTransaction: {
            ...(batchTransaction.RawTransactions![0].RawTransaction as Record<string, unknown>),
            Account: otherAddress,
          },
        },
      ],
    } as Transaction;

    await expect(adapter.signAndSubmit(partial)).rejects.toMatchObject({
      code: WalletErrorCode.UNSUPPORTED_METHOD,
    });
    expect(mocks.autofill).not.toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();
    await adapter.disconnect();
  });

  it('submits a complete foreign-account BatchSigner payload as an outer Batch', async () => {
    const adapter = await connected({ ...reviewedOptions, transactionReview: 'none' });
    const complete = {
      ...batchTransaction,
      RawTransactions: [
        {
          RawTransaction: {
            ...(batchTransaction.RawTransactions![0].RawTransaction as Record<string, unknown>),
            Account: otherAddress,
          },
        },
      ],
      BatchSigners: [
        {
          BatchSigner: {
            Account: otherAddress,
            SigningPubKey: publicKey,
            TxnSignature: 'A'.repeat(128),
          },
        },
      ],
    } as Transaction;

    await expect(adapter.signAndSubmit(complete)).resolves.toMatchObject({
      hash: 'validated-hash',
      tx_json: { TransactionType: 'Batch' },
    });
    await adapter.disconnect();
  });

  it('reviews the autofilled transaction before submitting it', async () => {
    const adapter = await connected();
    const { nextReview } = watchPrompts(adapter);
    const { Fee: _fee, Sequence: _sequence, LastLedgerSequence: _bound, ...partial } = payment;
    const submitting = adapter.signAndSubmit(partial as Transaction);

    const prompt = await nextReview(1);
    expect(prompt.review?.action).toBe('signAndSubmit');
    expect(prompt.description).toContain('submits it to the XRP Ledger');
    expect(prompt.review?.transaction).toMatchObject({
      Fee: '12',
      Sequence: 1,
      LastLedgerSequence: 100,
    });
    expect(mocks.submit).not.toHaveBeenCalled();
    await prompt.submit!({});
    await expect(submitting).resolves.toMatchObject({ hash: 'validated-hash' });
    expect(mocks.submit).toHaveBeenCalledOnce();
    await adapter.disconnect();
  });

  it('rejects as a user rejection without signing or submitting', async () => {
    const adapter = await connected();
    const { prompts, nextReview } = watchPrompts(adapter);
    const signing = adapter.signAndSubmit(payment);
    const rejected = expect(signing).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });

    (await nextReview(1)).cancel();
    await rejected;
    expect(prompts.at(-1)).toBeNull();
    expect(mocks.signHash).not.toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();

    // A rejection keeps the shared ledger connection for the next transaction.
    const next = adapter.signAndSubmit(payment);
    await (
      await nextReview(2)
    ).submit!({});
    await expect(next).resolves.toMatchObject({ hash: 'validated-hash' });
    expect(mocks.clientConnect).toHaveBeenCalledOnce();
    await adapter.disconnect();
  });

  it('fails closed when nothing can show the review', async () => {
    const adapter = await connected();
    const failure = {
      code: WalletErrorCode.SIGN_FAILED,
      reason: 'no_reviewer',
      message: expect.stringContaining('subscribe with onAuthPrompt() first'),
    };
    await expect(adapter.sign(payment)).rejects.toMatchObject(failure);

    const { stop } = watchPrompts(adapter);
    stop();
    await expect(adapter.signAndSubmit(payment)).rejects.toMatchObject(failure);
    expect(mocks.signHash).not.toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();
    await adapter.disconnect();
  });

  it("signs headlessly with transactionReview 'none'", async () => {
    const adapter = await connected({ ...reviewedOptions, transactionReview: 'none' });
    const { prompts } = watchPrompts(adapter);
    await expect(adapter.sign(payment)).resolves.toMatchObject({ signerAddress: wallet.address });
    expect(prompts).toEqual([]);
    expect(mocks.signHash).toHaveBeenCalledOnce();
    await adapter.disconnect();
  });

  it('lets an application review approve only with an explicit true', async () => {
    const reviewer = vi.fn<Exclude<PrivyTransactionReviewOption, string>>();
    const adapter = await connected({ ...reviewedOptions, transactionReview: reviewer });
    const { prompts } = watchPrompts(adapter);

    reviewer.mockResolvedValueOnce(true);
    await expect(adapter.sign(payment)).resolves.toMatchObject({ signerAddress: wallet.address });
    const [review, signal] = reviewer.mock.calls[0];
    expect(review.details[0]).toEqual({
      name: 'TransactionType',
      label: 'Transaction type',
      value: 'Payment',
    });
    expect(Object.isFrozen(review.transaction)).toBe(true);
    expect(signal.aborted).toBe(false);
    expect(mocks.signHash).toHaveBeenCalledOnce();

    for (const answer of [false, undefined, 'yes']) {
      reviewer.mockResolvedValueOnce(answer as boolean);
      await expect(adapter.sign(payment)).rejects.toMatchObject({
        code: WalletErrorCode.SIGN_REJECTED,
      });
    }
    reviewer.mockRejectedValueOnce(new Error('review service unavailable'));
    await expect(adapter.sign(payment)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
      message: expect.stringContaining('review service unavailable'),
    });
    expect(mocks.signHash).toHaveBeenCalledOnce();
    expect(prompts).toEqual([]);
    await adapter.disconnect();
  });

  it('rejects a review pending at disconnect and ignores its later answer', async () => {
    const adapter = await connected();
    const { prompts, nextReview } = watchPrompts(adapter);
    const signing = adapter.sign(payment);
    const rejected = expect(signing).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
    const prompt = await nextReview(1);

    await adapter.disconnect();
    await rejected;
    expect(prompts.at(-1)).toBeNull();
    await prompt.submit!({});
    expect(mocks.signHash).not.toHaveBeenCalled();

    const pendingReview = deferred<boolean>();
    const reviewer = vi.fn((_review: unknown, _signal: AbortSignal) => pendingReview.promise);
    const custom = await connected({ ...reviewedOptions, transactionReview: reviewer });
    const customSigning = custom.sign(payment);
    const customRejected = expect(customSigning).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
    await vi.waitFor(() => expect(reviewer).toHaveBeenCalledOnce());
    await custom.disconnect();
    await customRejected;
    expect(reviewer.mock.calls[0][1].aborted).toBe(true);
    pendingReview.resolve(true);
    await Promise.resolve();
    expect(mocks.signHash).not.toHaveBeenCalled();
  });

  it('reviews concurrent requests one at a time and never applies a stale answer', async () => {
    const adapter = await connected();
    const { prompts, nextReview } = watchPrompts(adapter);
    const larger: Transaction = { ...payment, Amount: '25000000', Sequence: 8 };
    const first = adapter.sign(payment);
    const second = adapter.sign(larger);
    const secondRejected = expect(second).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });

    const firstPrompt = await nextReview(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(prompts).toHaveLength(1);

    await firstPrompt.submit!({});
    const secondPrompt = await nextReview(2);
    expect(prompts[1]).toBeNull();
    expect(secondPrompt.review?.details.find(({ name }) => name === 'Amount')?.value).toBe(
      '25 XRP'
    );
    await expect(first).resolves.toMatchObject({ tx_json: { Amount: '1500000' } });

    // Answering the first review again cannot approve the second transaction.
    await firstPrompt.submit!({});
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.signHash).toHaveBeenCalledOnce();

    secondPrompt.cancel();
    await secondRejected;
    expect(mocks.signHash).toHaveBeenCalledOnce();
    await adapter.disconnect();
  });

  it('applies the autofill fee limit to supplied fees before any review', async () => {
    const adapter = await connected();
    const { prompts, nextReview } = watchPrompts(adapter);
    const limit = {
      code: WalletErrorCode.SIGN_FAILED,
      message: expect.stringContaining('exceeds the 2 XRP limit'),
    };

    await expect(adapter.sign({ ...payment, Fee: '2000001' })).rejects.toMatchObject(limit);
    // Autofill keeps a supplied fee; the limit still applies before submission.
    mocks.autofill.mockImplementationOnce(async (tx) => ({
      Sequence: 1,
      LastLedgerSequence: 100,
      ...tx,
    }));
    await expect(adapter.signAndSubmit({ ...payment, Fee: '5000000' })).rejects.toMatchObject(
      limit
    );
    await expect(adapter.sign({ ...payment, Fee: '1e6' })).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    expect(prompts).toEqual([]);
    expect(mocks.signHash).not.toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();

    // The limit is inclusive, and reserve-priced types keep xrpl.js's exemption.
    const atLimit = adapter.sign({ ...payment, Fee: '2000000' });
    await (
      await nextReview(1)
    ).submit!({});
    await expect(atLimit).resolves.toMatchObject({ tx_json: { Fee: '2000000' } });
    const deletion = adapter.sign({
      TransactionType: 'AccountDelete',
      Account: wallet.address,
      Destination: destination,
      Fee: '5000000',
      Sequence: 9,
    });
    const deletionPrompt = await nextReview(2);
    expect(deletionPrompt.review?.details.find(({ name }) => name === 'Fee')?.value).toBe('5 XRP');
    deletionPrompt.cancel();
    await expect(deletion).rejects.toMatchObject({ code: WalletErrorCode.SIGN_REJECTED });
    await adapter.disconnect();
  });
});
