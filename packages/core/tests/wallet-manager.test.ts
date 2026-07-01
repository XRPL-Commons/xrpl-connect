import { afterEach, describe, it, expect, vi } from 'vitest';
import EventEmitter from 'eventemitter3';
import { WalletManager } from '../src/wallet-manager';
import { TIME } from '../src/constants';
import { WalletErrorCode } from '../src/types';
import { MemoryStorageAdapter } from '../src/storage';
import type {
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  SignedMessage,
  SignedTransaction,
  SubmittedTransaction,
  Transaction,
  WalletAdapter,
  WalletAdapterEvent,
} from '../src/types';

const NETWORK: NetworkInfo = { id: 'testnet', name: 'Testnet', wss: 'wss://example' };
const ACCOUNT: AccountInfo = { address: 'rTestAddress00000000000000000000000', network: NETWORK };

afterEach(() => {
  vi.useRealTimers();
});

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

describe('WalletManager.reconnect()', () => {
  /**
   * Build an adapter that records every ConnectOptions it receives, so a test
   * can assert what reconnect() replayed. Mirrors a hardware wallet where the
   * derivation path / account index selects which account is returned.
   */
  function createRecordingAdapter(received: Array<ConnectOptions | undefined>): WalletAdapter {
    return {
      id: 'ledger',
      name: 'Ledger',
      isAvailable: async () => true,
      connect: async (options) => {
        received.push(options);
        return ACCOUNT;
      },
      disconnect: async () => {},
      getAccount: async () => ACCOUNT,
      getNetwork: async () => NETWORK,
      sign: async () => ({ hash: '' }) as SignedTransaction,
      signAndSubmit: async () => ({ hash: '' }) as SubmittedTransaction,
      signMessage: async () => ({ signature: '' }) as SignedMessage,
    };
  }

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
});
