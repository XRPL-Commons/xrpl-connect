import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vite-plus/test';
import EventEmitter from 'eventemitter3';
import { WalletManager } from '../src/wallet-manager';
import { createWalletError } from '../src/errors';
import { MemoryStorageAdapter, Storage } from '../src/storage';
import { TIME } from '../src/constants';
import { CAPABILITY_DEFAULTS, WalletErrorCode } from '../src/types';
import type {
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  ReconnectOptions,
  SignedMessage,
  SignedTransaction,
  StorageAdapter,
  StoredState,
  SubmittedTransaction,
  SupportsNetworkSwitch,
  Transaction,
  WalletAdapter,
  WalletAdapterEvent,
  WalletCapabilities,
  SupportsFetchAccount,
} from '../src/types';

const NETWORK: NetworkInfo = { id: 'testnet', name: 'Testnet', wss: 'wss://example' };
const MAINNET: NetworkInfo = { id: 'mainnet', name: 'Mainnet', wss: 'wss://mainnet' };
const ACCOUNT: AccountInfo = { address: 'rTestAddress00000000000000000000000', network: NETWORK };

afterEach(() => {
  vi.useRealTimers();
});

function createFakeAdapter(): WalletAdapter &
  SupportsFetchAccount & {
    emitAdapterEvent: (event: WalletAdapterEvent, data?: unknown) => void;
    listenerCount: (event: WalletAdapterEvent) => number;
  } {
  const bus = new EventEmitter();
  const account: AccountInfo = { ...ACCOUNT, network: { ...NETWORK } };
  return {
    id: 'fake',
    name: 'Fake Wallet',
    isAvailable: vi.fn(async () => true),
    connect: vi.fn(async () => account),
    disconnect: vi.fn(async () => {}),
    getAccount: vi.fn(async () => account),
    fetchAccount: vi.fn(async () => account),
    getNetwork: vi.fn(async () => account.network),
    sign: vi.fn(async () => ({ hash: '0xhash' }) as SignedTransaction),
    signAndSubmit: vi.fn(async () => ({ hash: '0xhash' }) as SubmittedTransaction),
    signMessage: vi.fn(async () => ({ signature: '0xsig' }) as SignedMessage),
    on(event, callback) {
      bus.on(event, callback);
    },
    off(event, callback) {
      bus.off(event, callback);
    },
    emitAdapterEvent(event, data) {
      bus.emit(event, data);
    },
    listenerCount(event) {
      return bus.listenerCount(event);
    },
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createTestStorage(): {
  adapter: StorageAdapter;
  read: () => string | null;
} {
  let value: string | null = null;
  return {
    adapter: {
      get: vi.fn(async () => value),
      set: vi.fn(async (_key, next) => {
        value = next;
      }),
      remove: vi.fn(async () => {
        value = null;
      }),
      clear: vi.fn(async () => {
        value = null;
      }),
    },
    read: () => value,
  };
}

function readStoredState(value: string | null): StoredState | null {
  if (!value) return null;
  return (JSON.parse(value) as { payload: StoredState }).payload;
}

describe('WalletManager.disconnect()', () => {
  it('rejects reconnecting while the current session is disconnecting', async () => {
    const released = deferred<void>();
    const adapter = {
      ...createFakeAdapter(),
      disconnect: vi.fn(() => released.promise),
    };
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    const disconnecting = manager.disconnect();
    await vi.waitFor(() => expect(adapter.disconnect).toHaveBeenCalledOnce());

    await expect(manager.connect('fake')).rejects.toMatchObject({ code: 'ALREADY_CONNECTED' });
    released.resolve(undefined);
    await disconnecting;

    expect(manager.connected).toBe(false);
  });

  it('persists account and network changes emitted by the adapter', async () => {
    const storageAdapter = new MemoryStorageAdapter();
    const adapter = createFakeAdapter();
    const manager = new WalletManager({ adapters: [adapter], storage: storageAdapter });
    await manager.connect('fake');

    const changedNetwork: NetworkInfo = {
      id: 'mainnet',
      name: 'Mainnet',
      wss: 'wss://mainnet.example',
    };
    const changedAccount: AccountInfo = {
      address: 'rChanged00000000000000000000000000',
      network: changedNetwork,
    };
    adapter.emitAdapterEvent('accountChanged', changedAccount);
    adapter.emitAdapterEvent('networkChanged', changedNetwork);

    const storage = new Storage(storageAdapter);
    await vi.waitFor(async () => {
      const stored = await storage.loadState();
      expect(stored?.account).toEqual(changedAccount);
      expect(stored?.network).toEqual(changedNetwork);
    });
  });

  it('finishes event persistence before disconnect clears storage', async () => {
    let value: string | null = null;
    let setCalls = 0;
    let releaseSet!: () => void;
    let markSetStarted!: () => void;
    const setStarted = new Promise<void>((resolve) => (markSetStarted = resolve));
    const delayedSet = new Promise<void>((resolve) => (releaseSet = resolve));
    const storage: StorageAdapter = {
      get: vi.fn(async () => value),
      set: vi.fn(async (_key, next) => {
        setCalls += 1;
        if (setCalls === 2) {
          markSetStarted();
          await delayedSet;
        }
        value = next;
      }),
      remove: vi.fn(async () => {
        value = null;
      }),
      clear: vi.fn(async () => {
        value = null;
      }),
    };
    const adapter = createFakeAdapter();
    const manager = new WalletManager({ adapters: [adapter], storage });
    await manager.connect('fake');

    adapter.emitAdapterEvent('accountChanged', { ...ACCOUNT, address: 'rChanged' });
    await setStarted;
    const disconnecting = manager.disconnect();
    releaseSet();

    await disconnecting;
    expect(manager.connected).toBe(false);
    expect(value).toBeNull();
  });

  it('waits for event-triggered cleanup when the adapter emits during disconnect', async () => {
    let value: string | null = null;
    let markRemoveStarted!: () => void;
    let releaseRemove!: () => void;
    const removeStarted = new Promise<void>((resolve) => (markRemoveStarted = resolve));
    const removeBlocked = new Promise<void>((resolve) => (releaseRemove = resolve));
    const storage: StorageAdapter = {
      get: vi.fn(async () => value),
      set: vi.fn(async (_key, next) => {
        value = next;
      }),
      remove: vi.fn(async () => {
        markRemoveStarted();
        await removeBlocked;
        value = null;
      }),
      clear: vi.fn(async () => {
        value = null;
      }),
    };
    const adapter = createFakeAdapter();
    adapter.disconnect = vi.fn(async () => {
      adapter.emitAdapterEvent('disconnect');
    });
    const manager = new WalletManager({ adapters: [adapter], storage });
    await manager.connect('fake');

    let disconnected = false;
    const disconnecting = manager.disconnect().then(() => {
      disconnected = true;
    });
    await removeStarted;
    await Promise.resolve();
    expect(disconnected).toBe(false);

    releaseRemove();
    await disconnecting;
    expect(disconnected).toBe(true);
    expect(value).toBeNull();
  });

  it('removes adapter event listeners so late events do not reach manager subscribers', async () => {
    const adapter = createFakeAdapter();
    const manager = new WalletManager({ adapters: [adapter] });

    await manager.connect('fake');
    expect(adapter.listenerCount('disconnect')).toBe(1);
    expect(adapter.listenerCount('accountChanged')).toBe(1);
    expect(adapter.listenerCount('networkChanged')).toBe(1);

    const onAccountChanged = vi.fn();
    const onNetworkChanged = vi.fn();
    const onDisconnect = vi.fn();
    manager.on('accountChanged', onAccountChanged);
    manager.on('networkChanged', onNetworkChanged);
    manager.on('disconnect', onDisconnect);

    await manager.disconnect();
    expect(onDisconnect).toHaveBeenCalledTimes(1);

    expect(adapter.listenerCount('disconnect')).toBe(0);
    expect(adapter.listenerCount('accountChanged')).toBe(0);
    expect(adapter.listenerCount('networkChanged')).toBe(0);

    adapter.emitAdapterEvent('disconnect');
    adapter.emitAdapterEvent('accountChanged', {
      address: 'rOther00000000000000000000000000000',
      network: NETWORK,
    } satisfies AccountInfo);
    adapter.emitAdapterEvent('networkChanged', NETWORK);

    expect(onAccountChanged).not.toHaveBeenCalled();
    expect(onNetworkChanged).not.toHaveBeenCalled();
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('does not leak listeners across reconnect cycles', async () => {
    const adapter = createFakeAdapter();
    const manager = new WalletManager({ adapters: [adapter] });

    for (let i = 0; i < 3; i++) {
      await manager.connect('fake');
      await manager.disconnect();
    }

    expect(adapter.listenerCount('disconnect')).toBe(0);
    expect(adapter.listenerCount('accountChanged')).toBe(0);
    expect(adapter.listenerCount('networkChanged')).toBe(0);
  });

  it('cancels a connection that is still pending', async () => {
    let resolveConnect!: (account: AccountInfo) => void;
    const adapter = createFakeAdapter();
    adapter.connect = vi.fn(
      () => new Promise<AccountInfo>((resolve) => (resolveConnect = resolve))
    );
    const manager = new WalletManager({
      adapters: [adapter],
      storage: new MemoryStorageAdapter(),
    });

    const connecting = manager.connect('fake');
    await vi.waitFor(() => expect(adapter.connect).toHaveBeenCalledTimes(1));
    await manager.disconnect();
    resolveConnect(ACCOUNT);

    await expect(connecting).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    expect(adapter.disconnect).toHaveBeenCalled();
    expect(manager.connected).toBe(false);
  });

  it('does not let a cancelled attempt tear down a newer connection', async () => {
    let resolveFirstConnect!: (account: AccountInfo) => void;
    const adapter = createFakeAdapter();
    adapter.connect = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<AccountInfo>((resolve) => (resolveFirstConnect = resolve))
      )
      .mockResolvedValueOnce(ACCOUNT);
    const manager = new WalletManager({
      adapters: [adapter],
      storage: new MemoryStorageAdapter(),
    });

    const firstConnection = manager.connect('fake');
    await vi.waitFor(() => expect(adapter.connect).toHaveBeenCalledTimes(1));
    await manager.disconnect();
    await manager.connect('fake');
    resolveFirstConnect(ACCOUNT);

    await expect(firstConnection).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    expect(adapter.disconnect).toHaveBeenCalledTimes(1);
    expect(manager.connected).toBe(true);
    expect(manager.account?.address).toBe(ACCOUNT.address);
  });
});

describe('WalletManager capabilities', () => {
  it('keeps global capability defaults immutable', () => {
    expect(Object.isFrozen(CAPABILITY_DEFAULTS)).toBe(true);
  });

  it('reports capability support for the connected wallet', async () => {
    const adapter: WalletAdapter = {
      ...createFakeAdapter(),
      capabilities: { signMessage: false } satisfies WalletCapabilities,
    };
    const manager = new WalletManager({ adapters: [adapter] });

    // Not connected yet → nothing supported.
    expect(manager.supports('signMessage')).toBe(false);

    await manager.connect('fake');
    expect(manager.supports('signMessage')).toBe(false); // explicitly declared false
    expect(manager.supports('sign')).toBe(true); // undefined → default true
    expect(manager.supports('signAndSubmit')).toBe(true);
  });

  it('throws a typed UNSUPPORTED_METHOD error for a declared-unsupported operation', async () => {
    const adapter: WalletAdapter = {
      ...createFakeAdapter(),
      capabilities: { signMessage: false },
    };
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    await expect(manager.signMessage('hello')).rejects.toMatchObject({
      code: WalletErrorCode.UNSUPPORTED_METHOD,
    });
    // The adapter's signMessage must not even be called.
    expect(adapter.signMessage).not.toHaveBeenCalled();
  });

  it('allows operations that are not declared unsupported', async () => {
    const adapter = createFakeAdapter();
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    await expect(manager.signMessage('hello')).resolves.toBeDefined();
    expect(adapter.signMessage).toHaveBeenCalled();
  });
});

describe('WalletManager signerAddress stamping', () => {
  it('stamps the connected account address on sign results when the adapter omits it', async () => {
    const adapter = createFakeAdapter();
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    const signed = await manager.sign({} as Transaction);
    const message = await manager.signMessage('hello');

    expect(signed.signerAddress).toBe(ACCOUNT.address);
    expect(message.signerAddress).toBe(ACCOUNT.address);
    expectTypeOf(signed.signerAddress).toEqualTypeOf<string>();
    expectTypeOf(message.signerAddress).toEqualTypeOf<string>();
  });

  it('does not overwrite a signerAddress the adapter already provided', async () => {
    const adapter: WalletAdapter = {
      ...createFakeAdapter(),
      sign: vi.fn(
        async () => ({ hash: '0xhash', signerAddress: 'rExplicit' }) as SignedTransaction
      ),
    };
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    const signed = await manager.sign({} as Transaction);
    expect(signed.signerAddress).toBe('rExplicit');
  });

  it('stamps the account that started the signing request when the account changes in flight', async () => {
    let resolveSign!: (value: SignedTransaction) => void;
    const adapter = createFakeAdapter();
    adapter.sign = vi.fn(
      () => new Promise<SignedTransaction>((resolve) => (resolveSign = resolve))
    );
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    const signing = manager.sign({} as Transaction);
    adapter.emitAdapterEvent('accountChanged', {
      ...ACCOUNT,
      address: 'rChanged00000000000000000000000000',
    });
    resolveSign({ hash: '0xhash' } as SignedTransaction);

    await expect(signing).resolves.toMatchObject({ signerAddress: ACCOUNT.address });
  });

  it('returns a new stamped result when an adapter result is frozen', async () => {
    const result = Object.freeze({ hash: '0xhash' }) as SignedTransaction;
    const adapter = createFakeAdapter();
    adapter.sign = vi.fn(async () => result);
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    const signed = await manager.sign({} as Transaction);

    expect(signed).not.toBe(result);
    expect(signed).toEqual({ hash: '0xhash', signerAddress: ACCOUNT.address });
    expect(result.signerAddress).toBeUndefined();
  });
});

describe('WalletManager.fetchAccount()', () => {
  it('re-fetches the live account and emits accountChanged when it differs', async () => {
    const CHANGED: AccountInfo = {
      address: 'rChanged00000000000000000000000000',
      network: NETWORK,
    };
    const adapter = createFakeAdapter();
    adapter.fetchAccount = vi.fn(async () => CHANGED);
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    const onAccountChanged = vi.fn();
    manager.on('accountChanged', onAccountChanged);

    const fetched = await manager.fetchAccount();

    expect(fetched).toEqual(CHANGED);
    expect(manager.account).toEqual(CHANGED);
    expect(onAccountChanged).toHaveBeenCalledWith(CHANGED);
  });

  it('throws when not connected', async () => {
    const manager = new WalletManager({ adapters: [createFakeAdapter()] });
    await expect(manager.fetchAccount()).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
  });

  it('throws UNSUPPORTED_METHOD when the adapter cannot query live state', async () => {
    const { fetchAccount: _fetchAccount, ...adapter } = createFakeAdapter();
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    await expect(manager.fetchAccount()).rejects.toMatchObject({
      code: WalletErrorCode.UNSUPPORTED_METHOD,
    });
  });

  it('emits networkChanged and refreshes the cache when only the network changes', async () => {
    const CHANGED_NETWORK: NetworkInfo = {
      id: 'mainnet',
      name: 'Mainnet',
      wss: 'wss://mainnet.example',
    };
    const adapter = createFakeAdapter();
    adapter.fetchAccount = vi.fn(async () => ({ ...ACCOUNT, network: CHANGED_NETWORK }));
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');
    const onAccountChanged = vi.fn();
    const onNetworkChanged = vi.fn();
    manager.on('accountChanged', onAccountChanged);
    manager.on('networkChanged', onNetworkChanged);

    await manager.fetchAccount();

    expect(manager.account?.network).toEqual(CHANGED_NETWORK);
    expect(onNetworkChanged).toHaveBeenCalledWith(CHANGED_NETWORK);
    expect(onAccountChanged).not.toHaveBeenCalled();
  });

  it('does not restore account state when disconnected while fetching', async () => {
    let resolveAccount!: (value: AccountInfo) => void;
    const adapter = createFakeAdapter();
    adapter.fetchAccount = vi.fn(
      () => new Promise<AccountInfo>((resolve) => (resolveAccount = resolve))
    );
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    const fetching = manager.fetchAccount();
    await manager.disconnect();
    resolveAccount(ACCOUNT);

    await expect(fetching).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    expect(manager.connected).toBe(false);
    expect(manager.account).toBeNull();
  });

  it('accepts a live adapter event emitted during the refresh without duplicating it', async () => {
    const CHANGED: AccountInfo = { ...ACCOUNT, address: 'rChanged' };
    const adapter = createFakeAdapter();
    adapter.fetchAccount = vi.fn(async () => {
      adapter.emitAdapterEvent('accountChanged', CHANGED);
      return CHANGED;
    });
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');
    const onAccountChanged = vi.fn();
    manager.on('accountChanged', onAccountChanged);

    await expect(manager.fetchAccount()).resolves.toEqual(CHANGED);
    expect(manager.connected).toBe(true);
    expect(manager.account).toEqual(CHANGED);
    expect(onAccountChanged).toHaveBeenCalledTimes(1);
  });

  it('keeps a newer network event when a stale refresh resolves later', async () => {
    let resolveAccount!: (value: AccountInfo) => void;
    const adapter = createFakeAdapter();
    adapter.fetchAccount = vi.fn(
      () => new Promise<AccountInfo>((resolve) => (resolveAccount = resolve))
    );
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');
    const refreshedNetwork = { ...NETWORK, id: 'mainnet', name: 'Mainnet' };

    const fetching = manager.fetchAccount();
    adapter.emitAdapterEvent('networkChanged', refreshedNetwork);
    resolveAccount(ACCOUNT);

    await expect(fetching).resolves.toMatchObject({ network: refreshedNetwork });
    expect(manager.account?.network).toEqual(refreshedNetwork);
  });

  it('clears the session when the live wallet reports no account', async () => {
    const storageAdapter = new MemoryStorageAdapter();
    const adapter = createFakeAdapter();
    adapter.fetchAccount = vi.fn(async () => null);
    const manager = new WalletManager({ adapters: [adapter], storage: storageAdapter });
    const onDisconnect = vi.fn();
    manager.on('disconnect', onDisconnect);
    await manager.connect('fake');

    await expect(manager.fetchAccount()).resolves.toBeNull();

    expect(manager.connected).toBe(false);
    expect(manager.account).toBeNull();
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    await expect(new Storage(storageAdapter).loadState()).resolves.toBeNull();
  });

  it('serializes a delayed refresh write before disconnect clears storage', async () => {
    let value: string | null = null;
    let setCalls = 0;
    let releaseSet!: () => void;
    let markSetStarted!: () => void;
    const setStarted = new Promise<void>((resolve) => (markSetStarted = resolve));
    const delayedSet = new Promise<void>((resolve) => (releaseSet = resolve));
    const storage: StorageAdapter = {
      get: vi.fn(async () => value),
      set: vi.fn(async (_key, next) => {
        setCalls += 1;
        if (setCalls === 2) {
          markSetStarted();
          await delayedSet;
        }
        value = next;
      }),
      remove: vi.fn(async () => {
        value = null;
      }),
      clear: vi.fn(async () => {
        value = null;
      }),
    };
    const adapter = createFakeAdapter();
    adapter.fetchAccount = vi.fn(async () => ({ ...ACCOUNT, address: 'rRefreshed' }));
    const manager = new WalletManager({ adapters: [adapter], storage });
    await manager.connect('fake');

    const fetching = manager.fetchAccount();
    await setStarted;
    const disconnecting = manager.disconnect();
    releaseSet();

    await disconnecting;
    await expect(fetching).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    expect(value).toBeNull();
  });
});

describe('WalletManager.getAvailableWallets()', () => {
  it('returns responsive wallets without waiting indefinitely for a hung adapter', async () => {
    vi.useFakeTimers();
    const available = {
      ...createFakeAdapter(),
      id: 'available',
      name: 'Available Wallet',
    };
    const unavailable = {
      ...createFakeAdapter(),
      id: 'unavailable',
      name: 'Unavailable Wallet',
      isAvailable: vi.fn(async () => false),
    };
    const hung = {
      ...createFakeAdapter(),
      id: 'hung',
      name: 'Hung Wallet',
      isAvailable: vi.fn(() => new Promise<boolean>(() => {})),
    };
    const manager = new WalletManager({ adapters: [available, unavailable, hung] });

    const result = manager.getAvailableWallets();
    expect(available.isAvailable).toHaveBeenCalledTimes(1);
    expect(unavailable.isAvailable).toHaveBeenCalledTimes(1);
    expect(hung.isAvailable).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(TIME.AVAILABILITY_TIMEOUT);

    await expect(result).resolves.toEqual([available]);
  });
});

describe('WalletManager.connect()', () => {
  it('is idempotent when the requested wallet is already connected without disturbing state', async () => {
    const storage = new MemoryStorageAdapter();
    const adapter = createFakeAdapter();
    adapter.disconnect = vi.fn(async () => {});
    const manager = new WalletManager({ adapters: [adapter], storage });

    const first = await manager.connect('fake');
    const storedBefore = await new Storage(storage).loadState();
    await expect(manager.connect('fake')).resolves.toEqual(first);

    expect(adapter.connect).toHaveBeenCalledOnce();
    expect(adapter.disconnect).not.toHaveBeenCalled();
    expect(manager.connected).toBe(true);
    expect(manager.account).toEqual(ACCOUNT);
    expect(await new Storage(storage).loadState()).toEqual(storedBefore);
  });

  it('rejects a concurrent connection before a second adapter is opened', async () => {
    let releaseFirst!: () => void;
    const firstCanConnect = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = {
      ...createFakeAdapter(),
      connect: vi.fn(async () => {
        await firstCanConnect;
        return ACCOUNT;
      }),
    };
    const second = {
      ...createFakeAdapter(),
      id: 'second',
      name: 'Second Wallet',
    };
    const manager = new WalletManager({ adapters: [first, second] });

    const firstConnection = manager.connect(first.id);
    await vi.waitFor(() => expect(first.isAvailable).toHaveBeenCalledOnce());

    await expect(manager.connect(second.id)).rejects.toMatchObject({
      code: WalletErrorCode.ALREADY_CONNECTED,
    });
    expect(second.isAvailable).not.toHaveBeenCalled();
    expect(second.connect).not.toHaveBeenCalled();

    releaseFirst();
    await expect(firstConnection).resolves.toEqual(ACCOUNT);
    expect(manager.wallet).toBe(first);
  });

  it('fails within the availability timeout when an adapter stops responding', async () => {
    vi.useFakeTimers();
    let resolveAvailability!: (available: boolean) => void;
    const availability = new Promise<boolean>((resolve) => {
      resolveAvailability = resolve;
    });
    const hung = {
      ...createFakeAdapter(),
      id: 'hung',
      name: 'Hung Wallet',
      isAvailable: vi.fn(() => availability),
    };
    const manager = new WalletManager({ adapters: [hung] });

    const rejection = expect(manager.connect('hung')).rejects.toMatchObject({
      code: WalletErrorCode.WALLET_NOT_AVAILABLE,
    });
    await vi.advanceTimersByTimeAsync(TIME.AVAILABILITY_TIMEOUT);

    await rejection;
    expect(hung.connect).not.toHaveBeenCalled();
    expect(manager.connected).toBe(false);

    resolveAvailability(true);
    await Promise.resolve();
    expect(hung.connect).not.toHaveBeenCalled();
    expect(manager.connected).toBe(false);
  });

  it('does not launch a connection cancelled while availability is pending', async () => {
    const availability = deferred<boolean>();
    const adapter = {
      ...createFakeAdapter(),
      isAvailable: vi.fn(() => availability.promise),
    };
    const manager = new WalletManager({ adapters: [adapter] });

    const connecting = manager.connect('fake');
    await vi.waitFor(() => expect(adapter.isAvailable).toHaveBeenCalledOnce());
    await manager.disconnect();
    availability.resolve(true);

    await expect(connecting).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
    expect(adapter.connect).not.toHaveBeenCalled();
    expect(manager.connected).toBe(false);
  });

  it('cancels and cleans up a connection whose storage commit is still pending', async () => {
    let value: string | null = null;
    const setStarted = deferred<void>();
    const setReleased = deferred<void>();
    const storage: StorageAdapter = {
      get: vi.fn(async () => value),
      set: vi.fn(async (_key, next) => {
        setStarted.resolve(undefined);
        await setReleased.promise;
        value = next;
      }),
      remove: vi.fn(async () => {
        value = null;
      }),
      clear: vi.fn(async () => {
        value = null;
      }),
    };
    const adapter = {
      ...createFakeAdapter(),
      disconnect: vi.fn(async () => {}),
    };
    const manager = new WalletManager({ adapters: [adapter], storage });
    const onConnect = vi.fn();
    manager.on('connect', onConnect);

    const connecting = manager.connect('fake');
    await setStarted.promise;
    const disconnecting = manager.disconnect();
    setReleased.resolve(undefined);

    await expect(connecting).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
    await disconnecting;
    expect(adapter.disconnect).toHaveBeenCalledOnce();
    expect(manager.connected).toBe(false);
    expect(onConnect).not.toHaveBeenCalled();
    expect(value).toBeNull();
  });

  it('lets a manual connection supersede constructor auto-reconnect', async () => {
    const storage = new MemoryStorageAdapter();
    await new Storage(storage).saveState({
      walletId: 'auto',
      account: { ...ACCOUNT, network: { ...NETWORK } },
      network: { ...NETWORK },
      timestamp: Date.now(),
    });
    const automatic = {
      ...createFakeAdapter(),
      id: 'auto',
      name: 'Automatic Wallet',
      connect: vi.fn(() => new Promise<AccountInfo>(() => {})),
      disconnect: vi.fn(async () => {}),
    };
    const manual = {
      ...createFakeAdapter(),
      id: 'manual',
      name: 'Manual Wallet',
    };
    const manager = new WalletManager({
      adapters: [automatic, manual],
      storage,
      autoConnect: true,
    });

    await vi.waitFor(() => expect(automatic.connect).toHaveBeenCalledOnce());
    await manager.connect('manual');

    expect(automatic.disconnect).toHaveBeenCalledOnce();
    expect(manual.connect).toHaveBeenCalledOnce();
    expect(manager.wallet?.id).toBe('manual');
    expect((await new Storage(storage).loadState())?.walletId).toBe('manual');
  });

  it('ignores a cancelled auto-connect result after the same adapter reconnects', async () => {
    const storage = new MemoryStorageAdapter();
    await new Storage(storage).saveState({
      walletId: 'fake',
      account: { ...ACCOUNT, network: { ...NETWORK } },
      network: { ...NETWORK },
      timestamp: Date.now(),
    });
    const automaticAccount = deferred<AccountInfo>();
    const manualAccount = deferred<AccountInfo>();
    const cancellationReleased = deferred<void>();
    const adapter = {
      ...createFakeAdapter(),
      connect: vi
        .fn()
        .mockImplementationOnce(() => automaticAccount.promise)
        .mockImplementationOnce(() => manualAccount.promise),
      disconnect: vi.fn(() => {
        automaticAccount.resolve({ ...ACCOUNT, network: { ...NETWORK } });
        return cancellationReleased.promise;
      }),
    };
    const manager = new WalletManager({ adapters: [adapter], storage, autoConnect: true });
    const onConnect = vi.fn();
    manager.on('connect', onConnect);

    await vi.waitFor(() => expect(adapter.connect).toHaveBeenCalledOnce());
    const connectingManually = manager.connect('fake');
    await vi.waitFor(() => expect(adapter.disconnect).toHaveBeenCalledOnce());
    expect(adapter.connect).toHaveBeenCalledOnce();

    cancellationReleased.resolve(undefined);
    await vi.waitFor(() => expect(adapter.connect).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(adapter.disconnect).toHaveBeenCalledOnce();

    manualAccount.resolve({ ...ACCOUNT, network: { ...NETWORK } });
    await connectingManually;

    expect(manager.wallet).toBe(adapter);
    expect(manager.connected).toBe(true);
    expect(adapter.disconnect).toHaveBeenCalledOnce();
    expect(onConnect).toHaveBeenCalledOnce();
    expect((await new Storage(storage).loadState())?.walletId).toBe('fake');
  });
});

describe('WalletManager.switchNetwork()', () => {
  it('rejects adapters without native switching instead of changing only local state', async () => {
    const adapter = createFakeAdapter();
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    await expect(manager.switchNetwork('mainnet')).rejects.toMatchObject({
      code: 'UNSUPPORTED_METHOD',
    });
    expect(manager.account?.network).toEqual(NETWORK);
  });

  it('delegates to an adapter that supports native network switching', async () => {
    const CUSTOM: NetworkInfo = { id: 'custom', name: 'Custom', wss: 'wss://custom' };
    const switchNetwork = vi.fn(async () => CUSTOM);
    const adapter = {
      ...createFakeAdapter(),
      switchNetwork,
    } satisfies WalletAdapter & SupportsNetworkSwitch;
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');
    const onNetworkChanged = vi.fn();
    manager.on('networkChanged', onNetworkChanged);

    const applied = await manager.switchNetwork('devnet');

    expect(switchNetwork).toHaveBeenCalledWith('devnet');
    expect(applied).toEqual(CUSTOM);
    expect(manager.account?.network).toEqual(CUSTOM);
    expect(onNetworkChanged).toHaveBeenCalledOnce();
    expect(onNetworkChanged).toHaveBeenCalledWith(CUSTOM);
  });

  it('emits when the adapter mutates its shared account object before returning', async () => {
    const applied: NetworkInfo = { id: 'mainnet', name: 'Mainnet', wss: 'wss://mainnet' };
    const account: AccountInfo = { ...ACCOUNT, network: { ...NETWORK } };
    const adapter = {
      ...createFakeAdapter(),
      connect: vi.fn(async () => account),
      getAccount: vi.fn(async () => account),
      getNetwork: vi.fn(async () => account.network),
      switchNetwork: vi.fn(async () => {
        account.network = applied;
        return applied;
      }),
    } satisfies WalletAdapter & SupportsNetworkSwitch;
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');
    const onNetworkChanged = vi.fn();
    manager.on('networkChanged', onNetworkChanged);

    await expect(manager.switchNetwork('mainnet')).resolves.toEqual(applied);

    expect(onNetworkChanged).toHaveBeenCalledOnce();
    expect(onNetworkChanged).toHaveBeenCalledWith(applied);
  });

  it('does not duplicate an adapter event emitted by the native switch', async () => {
    const applied: NetworkInfo = { id: 'mainnet', name: 'Mainnet', wss: 'wss://mainnet' };
    const eventSource = createFakeAdapter();
    const adapter = {
      ...eventSource,
      switchNetwork: vi.fn(async () => {
        eventSource.emitAdapterEvent('networkChanged', applied);
        return applied;
      }),
    } satisfies WalletAdapter & SupportsNetworkSwitch;
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');
    const onNetworkChanged = vi.fn();
    manager.on('networkChanged', onNetworkChanged);

    await expect(manager.switchNetwork('mainnet')).resolves.toEqual(applied);

    expect(onNetworkChanged).toHaveBeenCalledOnce();
    expect(onNetworkChanged).toHaveBeenCalledWith(applied);
  });

  it('emits once when the adapter mutates its account and emits during the switch', async () => {
    const applied: NetworkInfo = { id: 'mainnet', name: 'Mainnet', wss: 'wss://mainnet' };
    const account: AccountInfo = { ...ACCOUNT, network: { ...NETWORK } };
    const eventSource = createFakeAdapter();
    const adapter = {
      ...eventSource,
      connect: vi.fn(async () => account),
      getAccount: vi.fn(async () => account),
      getNetwork: vi.fn(async () => account.network),
      switchNetwork: vi.fn(async () => {
        account.network = applied;
        eventSource.emitAdapterEvent('networkChanged', applied);
        return applied;
      }),
    } satisfies WalletAdapter & SupportsNetworkSwitch;
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');
    const onNetworkChanged = vi.fn();
    manager.on('networkChanged', onNetworkChanged);

    await expect(manager.switchNetwork('mainnet')).resolves.toEqual(applied);

    expect(onNetworkChanged).toHaveBeenCalledOnce();
    expect(onNetworkChanged).toHaveBeenCalledWith(applied);
    expect(manager.account?.network).toEqual(applied);
  });

  it('applies the authoritative result after an intermediate adapter event', async () => {
    const intermediate: NetworkInfo = {
      id: 'testnet',
      name: 'Testnet',
      wss: 'wss://intermediate',
    };
    const applied: NetworkInfo = { id: 'mainnet', name: 'Mainnet', wss: 'wss://mainnet' };
    const eventSource = createFakeAdapter();
    const adapter = {
      ...eventSource,
      switchNetwork: vi.fn(async () => {
        eventSource.emitAdapterEvent('networkChanged', intermediate);
        return applied;
      }),
    } satisfies WalletAdapter & SupportsNetworkSwitch;
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');
    const onNetworkChanged = vi.fn();
    manager.on('networkChanged', onNetworkChanged);

    await expect(manager.switchNetwork('mainnet')).resolves.toEqual(applied);

    expect(manager.account?.network).toEqual(applied);
    expect(onNetworkChanged.mock.calls).toEqual([[intermediate], [applied]]);
  });

  it('continues a switch when the account changes in the same session', async () => {
    const pending = deferred<NetworkInfo>();
    const applied: NetworkInfo = { id: 'mainnet', name: 'Mainnet', wss: 'wss://mainnet' };
    const eventSource = createFakeAdapter();
    const adapter = {
      ...eventSource,
      switchNetwork: vi.fn(() => pending.promise),
    } satisfies WalletAdapter & SupportsNetworkSwitch;
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    const switching = manager.switchNetwork('mainnet');
    await vi.waitFor(() => expect(adapter.switchNetwork).toHaveBeenCalledOnce());
    eventSource.emitAdapterEvent('accountChanged', {
      ...ACCOUNT,
      address: 'rNewAccount',
      network: { ...NETWORK },
    });
    pending.resolve(applied);

    await expect(switching).resolves.toEqual(applied);
    expect(manager.account).toMatchObject({ address: 'rNewAccount', network: applied });
  });

  it('serializes concurrent native switches in invocation order', async () => {
    const first = deferred<NetworkInfo>();
    const second = deferred<NetworkInfo>();
    const firstNetwork: NetworkInfo = { id: 'mainnet', name: 'Mainnet', wss: 'wss://mainnet' };
    const secondNetwork: NetworkInfo = { id: 'devnet', name: 'Devnet', wss: 'wss://devnet' };
    const switchNetwork = vi
      .fn<[], Promise<NetworkInfo>>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const adapter = {
      ...createFakeAdapter(),
      switchNetwork,
    } satisfies WalletAdapter & SupportsNetworkSwitch;
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');
    const onNetworkChanged = vi.fn();
    manager.on('networkChanged', onNetworkChanged);

    const switchingFirst = manager.switchNetwork('mainnet');
    const switchingSecond = manager.switchNetwork('devnet');
    await vi.waitFor(() => expect(switchNetwork).toHaveBeenCalledTimes(1));

    first.resolve(firstNetwork);
    await expect(switchingFirst).resolves.toEqual(firstNetwork);
    await vi.waitFor(() => expect(switchNetwork).toHaveBeenCalledTimes(2));

    second.resolve(secondNetwork);
    await expect(switchingSecond).resolves.toEqual(secondNetwork);

    expect(switchNetwork.mock.calls).toEqual([['mainnet'], ['devnet']]);
    expect(onNetworkChanged.mock.calls).toEqual([[firstNetwork], [secondNetwork]]);
    expect(manager.account?.network).toEqual(secondNetwork);
  });

  it('continues the switch queue after an adapter rejection', async () => {
    const applied: NetworkInfo = { id: 'devnet', name: 'Devnet', wss: 'wss://devnet' };
    const switchNetwork = vi
      .fn<[], Promise<NetworkInfo>>()
      .mockRejectedValueOnce(new Error('rejected'))
      .mockResolvedValueOnce(applied);
    const adapter = {
      ...createFakeAdapter(),
      switchNetwork,
    } satisfies WalletAdapter & SupportsNetworkSwitch;
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    const rejected = manager.switchNetwork('mainnet');
    const succeeded = manager.switchNetwork('devnet');

    await expect(rejected).rejects.toMatchObject({ code: 'UNKNOWN_ERROR' });
    await expect(succeeded).resolves.toEqual(applied);
    expect(manager.account?.network).toEqual(applied);
  });

  it('throws when not connected', async () => {
    const manager = new WalletManager({ adapters: [createFakeAdapter()] });
    await expect(manager.switchNetwork('testnet')).rejects.toMatchObject({
      code: 'NOT_CONNECTED',
    });
  });

  it('does not apply or emit a switch that finishes after disconnect', async () => {
    let resolveSwitch!: (network: NetworkInfo) => void;
    const switchNetwork = vi.fn(
      () => new Promise<NetworkInfo>((resolve) => (resolveSwitch = resolve))
    );
    const adapter: WalletAdapter = { ...createFakeAdapter(), switchNetwork };
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');
    const onNetworkChanged = vi.fn();
    manager.on('networkChanged', onNetworkChanged);

    const switching = manager.switchNetwork('devnet');
    await vi.waitFor(() => expect(switchNetwork).toHaveBeenCalledOnce());
    await manager.disconnect();
    resolveSwitch({ id: 'devnet', name: 'Devnet', wss: 'wss://devnet' });

    await expect(switching).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
    expect(manager.account).toBeNull();
    expect(onNetworkChanged).not.toHaveBeenCalled();
  });

  it('wraps an invalid adapter response in a typed error', async () => {
    const adapter: WalletAdapter = {
      ...createFakeAdapter(),
      switchNetwork: vi.fn(async () => undefined as never),
    };
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    await expect(manager.switchNetwork('devnet')).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
    });
  });

  it('rejects malformed optional fields in an adapter response', async () => {
    const adapter = {
      ...createFakeAdapter(),
      switchNetwork: vi.fn(async () => ({
        id: 'devnet',
        name: 'Devnet',
        wss: 'wss://devnet',
        rpc: 42,
      })),
    } as unknown as WalletAdapter & SupportsNetworkSwitch;
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    await expect(manager.switchNetwork('devnet')).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
    });
  });

  it('keeps a newer adapter event authoritative while switch persistence is delayed', async () => {
    let value: string | null = null;
    let blockSet = false;
    const setStarted = deferred<void>();
    const setReleased = deferred<void>();
    const storage: StorageAdapter = {
      get: vi.fn(async () => value),
      set: vi.fn(async (_key, next) => {
        if (blockSet) {
          setStarted.resolve(undefined);
          await setReleased.promise;
        }
        value = next;
      }),
      remove: vi.fn(async () => {
        value = null;
      }),
      clear: vi.fn(async () => {
        value = null;
      }),
    };
    const applied: NetworkInfo = { id: 'mainnet', name: 'Mainnet', wss: 'wss://mainnet' };
    const newer: NetworkInfo = { id: 'devnet', name: 'Devnet', wss: 'wss://devnet' };
    const eventSource = createFakeAdapter();
    const adapter = {
      ...eventSource,
      switchNetwork: vi.fn(async () => applied),
    } satisfies WalletAdapter & SupportsNetworkSwitch;
    const manager = new WalletManager({ adapters: [adapter], storage });
    await manager.connect('fake');
    const onNetworkChanged = vi.fn();
    manager.on('networkChanged', onNetworkChanged);

    blockSet = true;
    const switching = manager.switchNetwork('mainnet');
    await setStarted.promise;
    eventSource.emitAdapterEvent('networkChanged', newer);
    setReleased.resolve(undefined);

    await expect(switching).resolves.toEqual(newer);
    expect(manager.account?.network).toEqual(newer);
    expect(onNetworkChanged.mock.calls).toEqual([[applied], [newer]]);
    expect(readStoredState(value)?.network).toEqual(newer);
  });

  it('clears storage after a pending switch save when disconnecting', async () => {
    let value: string | null = null;
    let blockSet = false;
    const setStarted = deferred<void>();
    const setReleased = deferred<void>();
    const storage: StorageAdapter = {
      get: vi.fn(async () => value),
      set: vi.fn(async (_key, next) => {
        if (blockSet) {
          setStarted.resolve(undefined);
          await setReleased.promise;
        }
        value = next;
      }),
      remove: vi.fn(async () => {
        value = null;
      }),
      clear: vi.fn(async () => {
        value = null;
      }),
    };
    const applied: NetworkInfo = { id: 'devnet', name: 'Devnet', wss: 'wss://devnet' };
    const adapter = {
      ...createFakeAdapter(),
      switchNetwork: vi.fn(async () => applied),
    } satisfies WalletAdapter & SupportsNetworkSwitch;
    const manager = new WalletManager({ adapters: [adapter], storage });
    await manager.connect('fake');

    blockSet = true;
    const switching = manager.switchNetwork('devnet');
    await setStarted.promise;
    const disconnecting = manager.disconnect();
    await vi.waitFor(() => expect(manager.connected).toBe(false));
    setReleased.resolve(undefined);

    await expect(switching).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
    await disconnecting;
    expect(value).toBeNull();
  });

  it('does not let an old switch affect a reconnected session using the same objects', async () => {
    const pending = deferred<NetworkInfo>();
    const initial: NetworkInfo = { id: 'testnet', name: 'Testnet', wss: 'wss://testnet' };
    const applied: NetworkInfo = { id: 'devnet', name: 'Devnet', wss: 'wss://devnet' };
    const account: AccountInfo = { ...ACCOUNT, network: initial };
    const adapter = {
      ...createFakeAdapter(),
      connect: vi.fn(async () => account),
      getAccount: vi.fn(async () => account),
      getNetwork: vi.fn(async () => account.network),
      switchNetwork: vi.fn(async () => {
        const result = await pending.promise;
        account.network = result;
        return result;
      }),
    } satisfies WalletAdapter & SupportsNetworkSwitch;
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    const switching = manager.switchNetwork('devnet');
    await vi.waitFor(() => expect(adapter.switchNetwork).toHaveBeenCalledOnce());
    await manager.disconnect();
    await manager.connect('fake');
    pending.resolve(applied);

    await expect(switching).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
    expect(manager.account?.network).toEqual(initial);
  });

  it('reconnects with the persisted switched network instead of the manager default', async () => {
    const storage = createTestStorage();
    const mainnet: NetworkInfo = { id: 'mainnet', name: 'Mainnet', wss: 'wss://mainnet' };
    const devnet: NetworkInfo = { id: 'devnet', name: 'Devnet', wss: 'wss://devnet' };
    const firstAdapter = {
      ...createFakeAdapter(),
      switchNetwork: vi.fn(async () => devnet),
    } satisfies WalletAdapter & SupportsNetworkSwitch;
    const firstManager = new WalletManager({
      adapters: [firstAdapter],
      network: mainnet,
      storage: storage.adapter,
    });
    await firstManager.connect('fake');
    await firstManager.switchNetwork(devnet);

    const reconnect = vi.fn(async (options?: ConnectOptions) => ({
      ...ACCOUNT,
      network: typeof options?.network === 'object' ? options.network : mainnet,
    }));
    const secondAdapter: WalletAdapter = { ...createFakeAdapter(), connect: reconnect };
    const secondManager = new WalletManager({
      adapters: [secondAdapter],
      network: mainnet,
      storage: storage.adapter,
    });

    await secondManager.reconnect();

    expect(reconnect).toHaveBeenCalledWith({ network: devnet, autoReconnect: true });
    expect(secondManager.account?.network).toEqual(devnet);
    expect(readStoredState(storage.read())?.network).toEqual(devnet);
  });
});

describe('WalletManager.getNetwork()', () => {
  it('returns the current network reported by the connected adapter', async () => {
    const adapter = createFakeAdapter();
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    await expect(manager.getNetwork()).resolves.toEqual(NETWORK);
    expect(adapter.getNetwork).toHaveBeenCalled();
  });

  it('throws when not connected', async () => {
    const manager = new WalletManager({ adapters: [createFakeAdapter()] });
    await expect(manager.getNetwork()).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it('continues when the account changes in the same session', async () => {
    const pending = deferred<NetworkInfo>();
    const eventSource = createFakeAdapter();
    const adapter: WalletAdapter = {
      ...eventSource,
      getNetwork: vi.fn(() => pending.promise),
    };
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    const gettingNetwork = manager.getNetwork();
    eventSource.emitAdapterEvent('accountChanged', {
      ...ACCOUNT,
      address: 'rNewAccount',
      network: { ...NETWORK },
    });
    pending.resolve(NETWORK);

    await expect(gettingNetwork).resolves.toEqual(NETWORK);
    expect(manager.account?.address).toBe('rNewAccount');
  });

  it('rejects malformed adapter responses', async () => {
    const adapter = {
      ...createFakeAdapter(),
      getNetwork: vi.fn(async () => ({ id: 'mainnet' }) as NetworkInfo),
    };
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    await expect(manager.getNetwork()).rejects.toMatchObject({ code: 'UNKNOWN_ERROR' });
  });

  it('wraps untyped adapter errors and preserves typed wallet errors', async () => {
    const rawError = new Error('network unavailable');
    const adapter = {
      ...createFakeAdapter(),
      getNetwork: vi.fn(async (): Promise<NetworkInfo> => {
        throw rawError;
      }),
    };
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    await expect(manager.getNetwork()).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
      originalError: rawError,
    });

    const typedError = createWalletError.unsupportedMethod('not supported');
    adapter.getNetwork.mockRejectedValueOnce(typedError);
    await expect(manager.getNetwork()).rejects.toBe(typedError);
  });
});

describe('WalletManager.reconnect()', () => {
  /**
   * Build an adapter that records every ConnectOptions it receives, so a test
   * can assert what reconnect() replayed. Mirrors a hardware wallet where the
   * derivation path / account index selects which account is returned.
   */
  function createRecordingAdapter(
    received: Array<ConnectOptions | undefined>,
    account: AccountInfo = ACCOUNT
  ): WalletAdapter {
    return {
      id: 'ledger',
      name: 'Ledger',
      serializeReconnectOptions: (options: ConnectOptions) => {
        const derivationPath = (options as ConnectOptions & { derivationPath?: string })
          .derivationPath;
        return derivationPath ? { derivationPath } : undefined;
      },
      isAvailable: async () => true,
      connect: async (options) => {
        received.push(options);
        return account;
      },
      disconnect: async () => {},
      getAccount: async () => account,
      getNetwork: async () => account.network,
      sign: async () => ({ hash: '' }) as SignedTransaction,
      signAndSubmit: async () => ({ hash: '' }) as SubmittedTransaction,
      signMessage: async () => ({ signature: '' }) as SignedMessage,
    };
  }

  it('preserves stored state when reconnect is called during an active session', async () => {
    const storage = new MemoryStorageAdapter();
    const received: Array<ConnectOptions | undefined> = [];
    const manager = new WalletManager({ adapters: [createRecordingAdapter(received)], storage });
    const derivationPath = "44'/144'/3'/0/0";

    await manager.connect('ledger', { derivationPath } as ConnectOptions);
    const storedBefore = await new Storage(storage).loadState();
    await expect(manager.reconnect()).resolves.toBeNull();

    expect(storedBefore).toMatchObject({
      walletId: 'ledger',
      connectOptions: { derivationPath },
    });
    expect(await new Storage(storage).loadState()).toEqual(storedBefore);
  });

  it('does not reconnect after disconnect while storage is still loading', async () => {
    const backingStorage = new MemoryStorageAdapter();
    await new Storage(backingStorage).saveState({
      walletId: 'ledger',
      account: { ...ACCOUNT, network: { ...NETWORK } },
      network: { ...NETWORK },
      timestamp: Date.now(),
    });
    const readStarted = deferred<void>();
    const readReleased = deferred<void>();
    const storage: StorageAdapter = {
      get: vi.fn(async (key) => {
        readStarted.resolve(undefined);
        await readReleased.promise;
        return backingStorage.get(key);
      }),
      set: (key, value) => backingStorage.set(key, value),
      remove: (key) => backingStorage.remove(key),
      clear: () => backingStorage.clear(),
    };
    const adapter = createRecordingAdapter([]);
    adapter.connect = vi.fn(adapter.connect);
    const manager = new WalletManager({ adapters: [adapter], storage });

    const reconnecting = manager.reconnect();
    await readStarted.promise;
    await manager.disconnect();
    readReleased.resolve(undefined);

    await expect(reconnecting).resolves.toBeNull();
    expect(adapter.connect).not.toHaveBeenCalled();
    expect(manager.connected).toBe(false);
  });

  it('replays the wallet-specific connect options (e.g. Ledger derivation path) on reconnect', async () => {
    // Shared storage models persistence surviving a page reload.
    const storage = new MemoryStorageAdapter();
    const received: Array<ConnectOptions | undefined> = [];

    // First session: user picks a non-default derivation path.
    const manager1 = new WalletManager({ adapters: [createRecordingAdapter(received)], storage });
    await manager1.connect('ledger', { derivationPath: "44'/144'/3'/0/0" });

    // Fresh manager + adapter (page reload), same storage.
    const manager2 = new WalletManager({ adapters: [createRecordingAdapter(received)], storage });
    const account = await manager2.reconnect();

    expect(account).toEqual(ACCOUNT);
    // The reconnect must carry the original path, not fall back to the default.
    expect(received[received.length - 1]).toMatchObject({ derivationPath: "44'/144'/3'/0/0" });
  });

  it('reconnects without wallet-specific options when none were provided', async () => {
    const storage = new MemoryStorageAdapter();
    const received: Array<ConnectOptions | undefined> = [];

    const manager1 = new WalletManager({ adapters: [createRecordingAdapter(received)], storage });
    await manager1.connect('ledger');

    const manager2 = new WalletManager({ adapters: [createRecordingAdapter(received)], storage });
    await manager2.reconnect();

    const replayed = received[received.length - 1] as
      | (ConnectOptions & { derivationPath?: string })
      | undefined;
    expect(replayed?.derivationPath).toBeUndefined();
  });

  it('does not persist arbitrary options for adapters that do not opt in', async () => {
    const storage = new MemoryStorageAdapter();
    const adapter = createRecordingAdapter([]);
    delete (adapter as Partial<typeof adapter>).serializeReconnectOptions;
    const manager = new WalletManager({ adapters: [adapter], storage });

    await manager.connect('ledger', { secret: 'must-not-be-stored' });

    const stored = await new Storage(storage).loadState();
    expect(stored?.connectOptions).toBeUndefined();
  });

  it('rejects and cleans up a restored account that differs from stored state', async () => {
    const storage = new MemoryStorageAdapter();
    await new WalletManager({ adapters: [createRecordingAdapter([])], storage }).connect('ledger', {
      derivationPath: "44'/144'/3'/0/0",
    });

    const restoredAdapter = createRecordingAdapter([], {
      ...ACCOUNT,
      address: 'rDifferentLedgerDevice0000000000000000',
    });
    restoredAdapter.disconnect = vi.fn(async () => {});
    const manager = new WalletManager({ adapters: [restoredAdapter], storage });
    const onConnect = vi.fn();
    manager.on('connect', onConnect);

    await expect(manager.reconnect()).resolves.toBeNull();
    expect(manager.connected).toBe(false);
    expect(restoredAdapter.disconnect).toHaveBeenCalledOnce();
    expect(onConnect).not.toHaveBeenCalled();
    expect(await new Storage(storage).loadState()).toBeNull();
  });

  it('rejects and cleans up a restored network that differs from stored state', async () => {
    const storage = new MemoryStorageAdapter();
    await new WalletManager({ adapters: [createRecordingAdapter([])], storage }).connect('ledger');

    const restoredAdapter = createRecordingAdapter([], { ...ACCOUNT, network: MAINNET });
    restoredAdapter.disconnect = vi.fn(async () => {});
    const manager = new WalletManager({ adapters: [restoredAdapter], storage });

    await expect(manager.reconnect()).resolves.toBeNull();
    expect(manager.connected).toBe(false);
    expect(restoredAdapter.disconnect).toHaveBeenCalledOnce();
    expect(await new Storage(storage).loadState()).toBeNull();
  });

  it('rolls back a connection when reconnect option serialization throws', async () => {
    const storage = new MemoryStorageAdapter();
    const adapter = createRecordingAdapter([]);
    adapter.serializeReconnectOptions = () => {
      throw new Error('serializer failed');
    };
    adapter.disconnect = vi.fn(async () => {});
    const manager = new WalletManager({ adapters: [adapter], storage });

    await expect(manager.connect('ledger')).rejects.toMatchObject({
      message: expect.stringContaining('serializer failed'),
    });
    expect(manager.connected).toBe(false);
    expect(manager.wallet).toBeNull();
    expect(manager.account).toBeNull();
    expect(adapter.disconnect).toHaveBeenCalledOnce();
    expect(await new Storage(storage).loadState()).toBeNull();
  });

  it('keeps stored network state authoritative over malformed adapter options', async () => {
    const storage = new MemoryStorageAdapter();
    const initialAdapter = createRecordingAdapter([]);
    initialAdapter.serializeReconnectOptions = () =>
      ({ network: MAINNET }) as unknown as ReconnectOptions;
    await new WalletManager({ adapters: [initialAdapter], storage }).connect('ledger');

    const received: Array<ConnectOptions | undefined> = [];
    const restoredAdapter = createRecordingAdapter(received);
    await new WalletManager({ adapters: [restoredAdapter], storage }).reconnect();

    expect(received.at(-1)?.network).toEqual(NETWORK);
  });

  it('preserves adapter reconnect options when a runtime switch updates storage', async () => {
    const storage = new MemoryStorageAdapter();
    const adapter = {
      ...createRecordingAdapter([]),
      switchNetwork: vi.fn(async () => MAINNET),
    } satisfies WalletAdapter & SupportsNetworkSwitch;
    const manager = new WalletManager({ adapters: [adapter], storage });

    await manager.connect('ledger', { derivationPath: "44'/144'/3'/0/0" });
    await manager.switchNetwork('mainnet');

    const stored = await new Storage(storage).loadState();
    expect(stored?.network).toEqual(MAINNET);
    expect(stored?.connectOptions).toEqual({ derivationPath: "44'/144'/3'/0/0" });
  });

  it('drops stale reconnect selectors after the adapter changes account', async () => {
    const storage = new MemoryStorageAdapter();
    const eventSource = createFakeAdapter();
    const adapter = {
      ...eventSource,
      id: 'ledger',
      name: 'Ledger',
      serializeReconnectOptions: () => ({ derivationPath: "44'/144'/3'/0/0" }),
      switchNetwork: vi.fn(async () => MAINNET),
    } satisfies WalletAdapter & SupportsNetworkSwitch;
    const manager = new WalletManager({ adapters: [adapter], storage });

    await manager.connect('ledger');
    eventSource.emitAdapterEvent('accountChanged', {
      ...ACCOUNT,
      address: 'rChangedAccount',
      network: { ...NETWORK },
    });
    await manager.switchNetwork('mainnet');

    expect(await new Storage(storage).loadState()).toMatchObject({
      account: { address: 'rChangedAccount' },
      network: MAINNET,
    });
    expect((await new Storage(storage).loadState())?.connectOptions).toBeUndefined();
  });
});
