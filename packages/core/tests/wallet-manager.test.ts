import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import EventEmitter from 'eventemitter3';
import { WalletManager } from '../src/wallet-manager';
import { MemoryStorageAdapter, Storage } from '../src/storage';
import { TIME } from '../src/constants';
import { CAPABILITY_DEFAULTS, WalletErrorCode } from '../src/types';
import type {
  AccountInfo,
  NetworkInfo,
  SignedMessage,
  SignedTransaction,
  SubmittedTransaction,
  Transaction,
  WalletAdapter,
  WalletAdapterEvent,
  WalletCapabilities,
  SupportsFetchAccount,
  StorageAdapter,
} from '../src/types';

const NETWORK: NetworkInfo = { id: 'testnet', name: 'Testnet', wss: 'wss://example' };
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
  return {
    id: 'fake',
    name: 'Fake Wallet',
    isAvailable: vi.fn(async () => true),
    connect: vi.fn(async () => ACCOUNT),
    disconnect: vi.fn(async () => {}),
    getAccount: vi.fn(async () => ACCOUNT),
    fetchAccount: vi.fn(async () => ACCOUNT),
    getNetwork: vi.fn(async () => NETWORK),
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

describe('WalletManager.disconnect()', () => {
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
    let getCalls = 0;
    let releaseGet!: () => void;
    let markGetStarted!: () => void;
    const getStarted = new Promise<void>((resolve) => (markGetStarted = resolve));
    const delayedGet = new Promise<void>((resolve) => (releaseGet = resolve));
    const storage: StorageAdapter = {
      get: vi.fn(async () => {
        getCalls += 1;
        if (getCalls === 2) {
          markGetStarted();
          await delayedGet;
        }
        return value;
      }),
      set: vi.fn(async (_key, next) => {
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
    await getStarted;
    const disconnecting = manager.disconnect();
    releaseGet();

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
});
