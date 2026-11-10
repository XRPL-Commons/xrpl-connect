// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { webcrypto } from 'node:crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { deriveAddress, verifyKeypairSignature, encodeForSigning } from 'xrpl';
import {
  createWalletError,
  MemoryStorageAdapter,
  WalletErrorCode,
  WalletManager,
  type Transaction,
} from 'xrpl-connect';
import { PrivyAdapter } from '../src/privy-adapter';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  signHash: vi.fn(),
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
const options = {
  appId: 'app',
  redirectUri: 'http://localhost/callback',
  loginMethods: [{ id: 'google', oauthProvider: 'google' as const }],
};
const transaction: Transaction = {
  TransactionType: 'AccountSet',
  Account: wallet.address,
  Fee: '12',
  Sequence: 1,
  LastLedgerSequence: 100,
};

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
  mocks.submit.mockResolvedValue({
    result: { hash: 'validated-hash', meta: { TransactionResult: 'tesSUCCESS' } },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('PrivyAdapter', () => {
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
    expect(adapter.onAuthPrompt(listener)).toBe(unsubscribe);
    expect(mocks.onAuthPrompt).toHaveBeenCalledWith(listener);
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
    expect(mocks.clientDisconnect).toHaveBeenCalledTimes(1);
    await adapter.disconnect();
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
    expect(mocks.clientDisconnect).toHaveBeenCalledTimes(2);
    await adapter.disconnect();
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
});
