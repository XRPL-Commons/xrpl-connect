import { describe, it, expect, vi } from 'vitest';
import EventEmitter from 'eventemitter3';
import { WalletManager } from '../src/wallet-manager';
import type {
  AccountInfo,
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

describe('WalletManager.getPlatformWrapper()', () => {
  it('returns the adapter reporting it is the in-app browser', async () => {
    const other: WalletAdapter = { ...createFakeAdapter(), id: 'other', name: 'Other' };
    const wrapper: WalletAdapter = {
      ...createFakeAdapter(),
      id: 'wrap',
      name: 'Wrap',
      isPlatformWrapper: async () => true,
    };
    const manager = new WalletManager({ adapters: [other, wrapper] });

    expect(await manager.getPlatformWrapper()).toBe(wrapper);
  });

  it('returns null when no adapter reports being the in-app browser', async () => {
    const a: WalletAdapter = {
      ...createFakeAdapter(),
      id: 'a',
      isPlatformWrapper: async () => false,
    };
    const b: WalletAdapter = { ...createFakeAdapter(), id: 'b' }; // no method at all
    const manager = new WalletManager({ adapters: [a, b] });

    expect(await manager.getPlatformWrapper()).toBeNull();
  });

  it('treats a hung isPlatformWrapper() as "not the wrapper" after the timeout', async () => {
    vi.useFakeTimers();
    const hang: WalletAdapter = {
      ...createFakeAdapter(),
      id: 'hang',
      isPlatformWrapper: () => new Promise<boolean>(() => {}),
    };
    const manager = new WalletManager({ adapters: [hang] });

    const pending = manager.getPlatformWrapper();
    await vi.advanceTimersByTimeAsync(500);

    await expect(pending).resolves.toBeNull();
    vi.useRealTimers();
  });
});
