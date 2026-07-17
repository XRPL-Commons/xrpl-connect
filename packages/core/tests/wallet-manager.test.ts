import { describe, it, expect, vi } from 'vitest';
import EventEmitter from 'eventemitter3';
import { WalletManager } from '../src/wallet-manager';
import { MemoryStorageAdapter, Storage } from '../src/storage';
import { WalletErrorCode } from '../src/types';
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
} from '../src/types';

const NETWORK: NetworkInfo = { id: 'testnet', name: 'Testnet', wss: 'wss://example' };
const ACCOUNT: AccountInfo = { address: 'rTestAddress00000000000000000000000', network: NETWORK };

function createFakeAdapter(): WalletAdapter & {
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
});

describe('WalletManager.fetchAccount()', () => {
  it('re-fetches the live account and emits accountChanged when it differs', async () => {
    const CHANGED: AccountInfo = {
      address: 'rChanged00000000000000000000000000',
      network: NETWORK,
    };
    const adapter: WalletAdapter = {
      ...createFakeAdapter(),
      getAccount: vi.fn(async () => CHANGED),
    };
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

  it('emits networkChanged and refreshes the cache when only the network changes', async () => {
    const CHANGED_NETWORK: NetworkInfo = {
      id: 'mainnet',
      name: 'Mainnet',
      wss: 'wss://mainnet.example',
    };
    const adapter: WalletAdapter = {
      ...createFakeAdapter(),
      getAccount: vi.fn(async () => ({ ...ACCOUNT, network: CHANGED_NETWORK })),
    };
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
    const adapter: WalletAdapter = {
      ...createFakeAdapter(),
      getAccount: vi.fn(() => new Promise<AccountInfo>((resolve) => (resolveAccount = resolve))),
    };
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    const fetching = manager.fetchAccount();
    await manager.disconnect();
    resolveAccount(ACCOUNT);

    await expect(fetching).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    expect(manager.connected).toBe(false);
    expect(manager.account).toBeNull();
  });

  it('does not restore account state when disconnected while persisting a refresh', async () => {
    let resolveLoad!: (value: string | null) => void;
    const storage = {
      get: vi.fn(() => new Promise<string | null>((resolve) => (resolveLoad = resolve))),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
      clear: vi.fn(async () => {}),
    };
    const adapter: WalletAdapter = {
      ...createFakeAdapter(),
      getAccount: vi.fn(async () => ({ ...ACCOUNT, address: 'rRefreshed' })),
    };
    const manager = new WalletManager({ adapters: [adapter], storage });
    await manager.connect('fake');

    const fetching = manager.fetchAccount();
    await vi.waitFor(() => expect(storage.get).toHaveBeenCalled());
    await manager.disconnect();
    resolveLoad(null);

    await expect(fetching).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    expect(manager.connected).toBe(false);
    expect(manager.account).toBeNull();
  });
});
