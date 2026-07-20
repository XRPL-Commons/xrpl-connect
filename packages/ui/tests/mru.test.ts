import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { MemoryStorageAdapter, WalletManager } from '@xrpl-connect/core';
import type { AccountInfo, NetworkInfo, WalletAdapter } from '@xrpl-connect/core';
import '../src/wallet-connector';
import { orderWalletsByMru } from '../src/utils';

const wallets = [{ id: 'xaman' }, { id: 'crossmark' }, { id: 'gemwallet' }, { id: 'ledger' }];

describe('orderWalletsByMru', () => {
  it('returns the input unchanged when there is no history', () => {
    expect(orderWalletsByMru(wallets, [])).toEqual(wallets);
  });

  it('surfaces the most-recently-used wallets first', () => {
    const ordered = orderWalletsByMru(wallets, ['ledger', 'gemwallet']);
    expect(ordered.map((w) => w.id)).toEqual(['ledger', 'gemwallet', 'xaman', 'crossmark']);
  });

  it('keeps the original relative order for wallets with no history (stable)', () => {
    const ordered = orderWalletsByMru(wallets, ['crossmark']);
    expect(ordered.map((w) => w.id)).toEqual(['crossmark', 'xaman', 'gemwallet', 'ledger']);
  });

  it('ignores history entries for wallets that are not present', () => {
    const ordered = orderWalletsByMru(wallets, ['not-a-wallet', 'ledger']);
    expect(ordered.map((w) => w.id)).toEqual(['ledger', 'xaman', 'crossmark', 'gemwallet']);
  });
});

const NETWORK: NetworkInfo = { id: 'testnet', name: 'Testnet', wss: 'wss://example' };

function createAdapter(id: string): WalletAdapter {
  const account: AccountInfo = { address: `r-${id}`, network: NETWORK };
  return {
    id,
    name: id,
    isAvailable: async () => true,
    connect: async () => account,
    disconnect: async () => {},
    getAccount: async () => account,
    getNetwork: async () => NETWORK,
    sign: async () => ({ hash: '' }),
    signAndSubmit: async () => ({ hash: '' }),
    signMessage: async () => ({ message: '', signature: '', publicKey: '' }),
  };
}

function createManager(): WalletManager {
  return new WalletManager({
    adapters: [createAdapter('first'), createAdapter('second')],
    storage: new MemoryStorageAdapter(),
  });
}

function mountConnector(manager: WalletManager) {
  const element = document.createElement('xrpl-wallet-connector');
  document.body.appendChild(element);
  element.setWalletManager(manager);
  return element;
}

function getRenderedWalletIds(): string[] {
  const portal = document.querySelector('[data-xrpl-overlay-portal]');
  return Array.from(
    portal?.shadowRoot?.querySelectorAll<HTMLElement>('[data-wallet-id]') ?? []
  ).map((element) => element.dataset.walletId ?? '');
}

describe('wallet connector MRU integration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document
      .querySelectorAll(
        'xrpl-wallet-connector, [data-xrpl-overlay-portal], [data-xrpl-account-modal-portal]'
      )
      .forEach((element) => element.remove());
  });

  function stubLocalStorage(): void {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
  }

  it('reorders the cached list after connect, disconnect, and reopen', async () => {
    stubLocalStorage();
    const manager = createManager();
    const element = mountConnector(manager);

    await element.open();
    expect(getRenderedWalletIds()).toEqual(['first', 'second']);
    await manager.connect('second');
    await manager.disconnect();
    await element.open();

    expect(getRenderedWalletIds()).toEqual(['second', 'first']);
  });

  it("reads another connector instance's MRU update when reopened", async () => {
    stubLocalStorage();
    const cachedElement = mountConnector(createManager());
    await cachedElement.open();
    expect(getRenderedWalletIds()).toEqual(['first', 'second']);
    cachedElement.close();

    const writerManager = createManager();
    mountConnector(writerManager);
    await writerManager.connect('second');
    await cachedElement.open();

    expect(getRenderedWalletIds()).toEqual(['second', 'first']);
  });
});
