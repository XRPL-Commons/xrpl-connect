import { afterEach, describe, it, expect, vi } from 'vitest';
import EventEmitter from 'eventemitter3';
import { WalletManager } from '../src/wallet-manager';
import { TIME } from '../src/constants';
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
    const adapter: WalletAdapter = { ...createFakeAdapter(), switchNetwork };
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    const applied = await manager.switchNetwork('devnet');

    expect(switchNetwork).toHaveBeenCalledWith('devnet');
    expect(applied).toEqual(CUSTOM);
    expect(manager.account?.network).toEqual(CUSTOM);
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
});

describe('WalletManager.getNetwork()', () => {
  it('returns the live network from the connected adapter', async () => {
    const adapter = createFakeAdapter();
    const manager = new WalletManager({ adapters: [adapter] });
    await manager.connect('fake');

    await expect(manager.getNetwork()).resolves.toEqual(NETWORK);
    expect(adapter.getNetwork).toHaveBeenCalled();
  });
});
