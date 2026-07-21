import { createApp, defineComponent, h, nextTick } from 'vue';
import type { AccountInfo, WalletAdapter } from '@xrpl-connect/core';
import { createWalletError, MemoryStorageAdapter, WalletErrorCode } from '@xrpl-connect/core';
import { createXrplConnect, useSigner, useWallet, useWalletModal, WalletConnector } from '../src';

const ACCOUNT: AccountInfo = {
  address: 'rTEST',
  publicKey: 'EDTEST',
  network: { id: 'testnet', name: 'Testnet', rpcUrl: 'https://example.test' },
};

function makeAdapter(overrides: Partial<WalletAdapter> = {}): WalletAdapter {
  return {
    id: 'fake',
    name: 'Fake Wallet',
    isAvailable: async () => true,
    connect: async () => ACCOUNT,
    disconnect: async () => undefined,
    getAccount: async () => ACCOUNT,
    getNetwork: async () => ACCOUNT.network,
    sign: async () => ({ txBlob: 'signed' }),
    signAndSubmit: async () => ({ hash: 'hash' }),
    signMessage: async () => ({ signature: 'signature' }),
    ...overrides,
  };
}

function mountWithPlugin<T>(setup: () => T, adapters = [makeAdapter()]) {
  let exposed: T | undefined;
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp(
    defineComponent({
      setup() {
        exposed = setup();
        return () => null;
      },
    })
  );
  app.use(createXrplConnect({ adapters, storage: new MemoryStorageAdapter() }));
  app.mount(root);
  return {
    app,
    root,
    get exposed() {
      return exposed as T;
    },
  };
}

describe('Vue plugin and composables', () => {
  it('rejects composables used without the plugin', () => {
    const root = document.createElement('div');
    const app = createApp(
      defineComponent({
        setup() {
          useWallet();
          return () => null;
        },
      })
    );
    app.config.errorHandler = (error) => {
      throw error;
    };
    expect(() => app.mount(root)).toThrow(/app\.use\(createXrplConnect/);
  });

  it('reflects connection state and delegates signer actions', async () => {
    const mounted = mountWithPlugin(() => ({ wallet: useWallet(), signer: useSigner() }));

    expect(mounted.exposed.wallet.connected.value).toBe(false);
    await mounted.exposed.wallet.connect('fake');
    await nextTick();
    expect(mounted.exposed.wallet.connected.value).toBe(true);
    expect(mounted.exposed.wallet.account.value).toEqual(ACCOUNT);
    await expect(
      mounted.exposed.signer.sign({ TransactionType: 'Payment' } as never)
    ).resolves.toMatchObject({ txBlob: 'signed', signerAddress: ACCOUNT.address });

    await mounted.exposed.wallet.disconnect();
    await nextTick();
    expect(mounted.exposed.wallet.connected.value).toBe(false);
    expect(mounted.exposed.wallet.account.value).toBeNull();
    mounted.app.unmount();
  });

  it('keeps plugin instances isolated', async () => {
    const first = mountWithPlugin(() => useWallet());
    const second = mountWithPlugin(() => useWallet());

    await first.exposed.connect('fake');
    await nextTick();
    expect(first.exposed.connected.value).toBe(true);
    expect(second.exposed.connected.value).toBe(false);

    first.app.unmount();
    second.app.unmount();
  });

  it('attempts auto-connect once and releases listeners on teardown', async () => {
    const storage = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    };
    let wallet: ReturnType<typeof useWallet> | undefined;
    const root = document.createElement('div');
    const app = createApp(
      defineComponent({
        setup() {
          wallet = useWallet();
          return () => null;
        },
      })
    );
    app.use(createXrplConnect({ adapters: [makeAdapter()], autoConnect: true, storage }));
    app.mount(root);
    await vi.waitFor(() => expect(storage.get).toHaveBeenCalledTimes(1));
    expect(wallet!.manager.listenerCount('connect')).toBe(1);

    app.unmount();
    expect(wallet!.manager.listenerCount('connect')).toBe(0);
  });

  it('disconnects its owned manager when the app unmounts', async () => {
    const disconnect = vi.fn(async () => undefined);
    const mounted = mountWithPlugin(() => useWallet(), [makeAdapter({ disconnect })]);
    await mounted.exposed.connect('fake');

    mounted.app.unmount();
    await vi.waitFor(() => expect(disconnect).toHaveBeenCalledTimes(1));
    expect(mounted.exposed.manager.connected).toBe(false);
  });

  it('exposes typed connection errors and clears connecting', async () => {
    const error = createWalletError.connectionRejected('Fake Wallet');
    const mounted = mountWithPlugin(
      () => useWallet(),
      [makeAdapter({ connect: async () => Promise.reject(error) })]
    );

    await expect(mounted.exposed.connect('fake')).rejects.toBe(error);
    expect(mounted.exposed.connecting.value).toBe(false);
    expect(mounted.exposed.error.value?.code).toBe(WalletErrorCode.CONNECTION_REJECTED);
    mounted.app.unmount();
  });
});

describe('<WalletConnector>', () => {
  beforeAll(() => {
    if (customElements.get('xrpl-wallet-connector')) return;
    customElements.define(
      'xrpl-wallet-connector',
      class extends HTMLElement {
        manager: unknown = null;
        opened = false;
        setWalletManager(manager: unknown) {
          this.manager = manager;
        }
        open() {
          this.opened = true;
        }
        close() {
          this.opened = false;
        }
      }
    );
  });

  it('binds the manager, forwards attributes/events, and supports modal control', async () => {
    const onConnecting = vi.fn();
    const onConnect = vi.fn();
    const onError = vi.fn();
    let wallet: ReturnType<typeof useWallet> | undefined;
    let modal: ReturnType<typeof useWalletModal> | undefined;
    const root = document.createElement('div');
    const app = createApp(
      defineComponent({
        setup() {
          wallet = useWallet();
          modal = useWalletModal();
          return () =>
            h(WalletConnector, {
              primaryWallet: 'fake',
              wallets: ['fake'],
              theme: 'purple',
              class: 'connector',
              onConnecting,
              onConnect,
              onError,
            });
        },
      })
    );
    app.use(createXrplConnect({ adapters: [makeAdapter()], storage: new MemoryStorageAdapter() }));
    app.mount(root);
    const element = root.querySelector('xrpl-wallet-connector') as HTMLElement & {
      manager: unknown;
      opened: boolean;
    };
    await vi.waitFor(() => expect(element.manager).toBeTruthy());
    expect(element.getAttribute('primary-wallet')).toBe('fake');
    expect(element.getAttribute('wallets')).toBe('fake');
    expect(element.className).toBe('connector');
    expect(element.style.getPropertyValue('--xc-primary-color')).toBe('#a78bfa');

    element.dispatchEvent(new CustomEvent('connecting', { detail: { walletId: 'fake' } }));
    expect(wallet!.connecting.value).toBe(true);
    expect(onConnecting).toHaveBeenCalledWith('fake');

    const error = createWalletError.connectionRejected('Fake Wallet');
    element.dispatchEvent(new CustomEvent('error', { detail: { error } }));
    expect(wallet!.error.value).toBe(error);
    expect(onError).toHaveBeenCalledWith(error);

    await wallet!.connect('fake');
    expect(onConnect).toHaveBeenCalledWith(ACCOUNT);
    modal!.open();
    expect(element.opened).toBe(true);
    modal!.close();
    expect(element.opened).toBe(false);
    app.unmount();
  });
});
