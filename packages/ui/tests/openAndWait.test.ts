import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import '../src/wallet-connector';
import { MemoryStorageAdapter, WalletManager } from '@xrpl-connect/core';
import type { AccountInfo, NetworkInfo, WalletAdapter } from '@xrpl-connect/core';

const NETWORK: NetworkInfo = { id: 'testnet', name: 'Testnet', wss: 'wss://example' };
const ACCOUNT: AccountInfo = { address: 'rTestAddress00000000000000000000000', network: NETWORK };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function fakeAdapter(
  id = 'fake',
  account: AccountInfo = ACCOUNT,
  isAvailable: WalletAdapter['isAvailable'] = async () => true
): WalletAdapter {
  return {
    id,
    name: `Fake Wallet ${id}`,
    isAvailable,
    connect: async () => account,
    disconnect: async () => {},
    getAccount: async () => account,
    getNetwork: async () => NETWORK,
    sign: async () => ({ hash: '' }),
    signAndSubmit: async () => ({ hash: '' }),
    signMessage: async () => ({ message: '', signature: '', publicKey: '' }),
  };
}

function createManager(adapters: WalletAdapter[]): WalletManager {
  return new WalletManager({ adapters, storage: new MemoryStorageAdapter() });
}

function mountConnector(manager: WalletManager) {
  const element = document.createElement('xrpl-wallet-connector');
  document.body.appendChild(element);
  element.setWalletManager(manager);
  return element;
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
}

describe('<xrpl-wallet-connector>.openAndWait()', () => {
  afterEach(() => {
    document
      .querySelectorAll(
        'xrpl-wallet-connector, [data-xrpl-overlay-portal], [data-xrpl-account-modal-portal]'
      )
      .forEach((element) => element.remove());
  });

  it('resolves with the account once a wallet connects', async () => {
    const manager = createManager([fakeAdapter()]);
    const element = mountConnector(manager);

    const pending = element.openAndWait();
    await manager.connect('fake');

    await expect(pending).resolves.toEqual(ACCOUNT);
  });

  it('rejects when the modal closes and does not emit a late open event', async () => {
    const availability = deferred<boolean>();
    const isAvailable = vi.fn<WalletAdapter['isAvailable']>(() => availability.promise);
    const element = mountConnector(createManager([fakeAdapter('fake', ACCOUNT, isAvailable)]));
    const onOpen = vi.fn();
    element.addEventListener('open', onOpen);

    const pending = element.openAndWait();
    element.close();
    await expect(pending).rejects.toThrow(/closed/i);

    availability.resolve(true);
    await flushPromises();
    expect(onOpen).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('');
  });

  it('resolves immediately when a wallet is already connected', async () => {
    const manager = createManager([fakeAdapter()]);
    await manager.connect('fake');
    const element = mountConnector(manager);

    await expect(element.openAndWait()).resolves.toEqual(ACCOUNT);
  });

  it('rejects immediately when no WalletManager has been set', async () => {
    const element = document.createElement('xrpl-wallet-connector');
    document.body.appendChild(element);

    await expect(element.openAndWait()).rejects.toThrow(/WalletManager/i);
  });

  it('follows a replacement manager and ignores the detached manager', async () => {
    const oldAccount = { ...ACCOUNT, address: 'rOldManager' };
    const newAccount = { ...ACCOUNT, address: 'rNewManager' };
    const oldManager = createManager([fakeAdapter('old', oldAccount)]);
    const newManager = createManager([fakeAdapter('new', newAccount)]);
    const element = mountConnector(oldManager);

    const pending = element.openAndWait();
    element.setWalletManager(newManager);
    expect(oldManager.listenerCount('connect')).toBe(0);
    await newManager.connect('new');

    await expect(pending).resolves.toEqual(newAccount);
    await oldManager.connect('old');
    expect(oldManager.listenerCount('connect')).toBe(0);
  });

  it('resolves when the replacement manager is already connected', async () => {
    const replacementAccount = { ...ACCOUNT, address: 'rReplacement' };
    const oldManager = createManager([fakeAdapter('old')]);
    const replacement = createManager([fakeAdapter('replacement', replacementAccount)]);
    await replacement.connect('replacement');
    const element = mountConnector(oldManager);

    const pending = element.openAndWait();
    element.setWalletManager(replacement);

    await expect(pending).resolves.toEqual(replacementAccount);
  });

  it('rejects on unmount, releases handlers, and works after remount', async () => {
    const manager = createManager([fakeAdapter()]);
    const element = mountConnector(manager);
    const pending = element.openAndWait();

    element.remove();

    await expect(pending).rejects.toThrow(/disconnected/i);
    expect(manager.listenerCount('connect')).toBe(0);

    document.body.appendChild(element);
    const resumed = element.openAndWait();
    expect(manager.listenerCount('connect')).toBe(1);
    await manager.connect('fake');
    await expect(resumed).resolves.toEqual(ACCOUNT);
  });

  it('coalesces concurrent waits into one modal open and resolves all callers', async () => {
    const availability = deferred<boolean>();
    const isAvailable = vi
      .fn<WalletAdapter['isAvailable']>()
      .mockReturnValueOnce(availability.promise)
      .mockResolvedValue(true);
    const manager = createManager([fakeAdapter('fake', ACCOUNT, isAvailable)]);
    const element = mountConnector(manager);
    const onOpen = vi.fn();
    element.addEventListener('open', onOpen);

    const first = element.openAndWait();
    const second = element.openAndWait();
    expect(isAvailable).toHaveBeenCalledTimes(1);

    availability.resolve(true);
    await flushPromises();
    expect(onOpen).toHaveBeenCalledTimes(1);
    await manager.connect('fake');

    await expect(first).resolves.toEqual(ACCOUNT);
    await expect(second).resolves.toEqual(ACCOUNT);
  });

  it('resolves a connection that completes while availability is still pending', async () => {
    const availability = deferred<boolean>();
    const isAvailable = vi
      .fn<WalletAdapter['isAvailable']>()
      .mockReturnValueOnce(availability.promise)
      .mockResolvedValue(true);
    const manager = createManager([fakeAdapter('fake', ACCOUNT, isAvailable)]);
    const element = mountConnector(manager);
    const onOpen = vi.fn();
    element.addEventListener('open', onOpen);

    const pending = element.openAndWait();
    await manager.connect('fake');
    await expect(pending).resolves.toEqual(ACCOUNT);

    availability.resolve(true);
    await flushPromises();
    expect(onOpen).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('');
  });
});
