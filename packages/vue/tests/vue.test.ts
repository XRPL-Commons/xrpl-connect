import {
  Comment,
  createApp,
  createSSRApp,
  defineComponent,
  h,
  KeepAlive,
  nextTick,
  ref,
} from 'vue';
import { renderToString } from 'vue/server-renderer';
import type { AccountInfo, WalletAdapter } from '@xrpl-connect/core';
import { createWalletError, MemoryStorageAdapter, WalletErrorCode } from '@xrpl-connect/core';
import {
  createXrplConnect,
  useSigner,
  useWallet,
  useWalletModal,
  WalletConnector,
  type WalletConnectorElement,
} from '../src';

const ACCOUNT: AccountInfo = {
  address: 'rTEST',
  publicKey: 'EDTEST',
  network: { id: 'testnet', name: 'Testnet', rpcUrl: 'https://example.test' },
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

interface TestWalletConnectorElement extends HTMLElement {
  manager: unknown;
  opened: boolean;
  openError: Error | null;
  resolveConnection(account: AccountInfo): void;
}

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

function mountModal(renderConnector: () => ReturnType<typeof h>) {
  let modal: ReturnType<typeof useWalletModal> | undefined;
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp(
    defineComponent({
      setup() {
        modal = useWalletModal();
        return renderConnector;
      },
    })
  );
  app.use(createXrplConnect({ adapters: [makeAdapter()], storage: new MemoryStorageAdapter() }));
  app.mount(root);
  return {
    app,
    root,
    get modal() {
      return modal!;
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
    const signed = await mounted.exposed.signer.sign({ TransactionType: 'Payment' } as never);
    const signedMessage = await mounted.exposed.signer.signMessage('hello');
    expectTypeOf(signed.signerAddress).toEqualTypeOf<string>();
    expectTypeOf(signedMessage.signerAddress).toEqualTypeOf<string>();
    expect(signed).toMatchObject({ txBlob: 'signed', signerAddress: ACCOUNT.address });
    expect(signedMessage).toMatchObject({ signature: 'signature', signerAddress: ACCOUNT.address });

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

  it('keeps connecting true until every concurrent connection attempt settles', async () => {
    const pending = deferred<AccountInfo>();
    const connect = vi.fn(() => pending.promise);
    const mounted = mountWithPlugin(() => useWallet(), [makeAdapter({ connect })]);

    const first = mounted.exposed.connect('fake');
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    await expect(mounted.exposed.connect('fake')).rejects.toMatchObject({
      code: WalletErrorCode.ALREADY_CONNECTED,
    });
    expect(mounted.exposed.connecting.value).toBe(true);

    pending.resolve(ACCOUNT);
    await expect(first).resolves.toEqual(ACCOUNT);
    expect(mounted.exposed.connecting.value).toBe(false);
    expect(mounted.exposed.error.value).toBeNull();
    mounted.app.unmount();
  });

  it('clears connection state when a pending connection is cancelled', async () => {
    const pending = deferred<AccountInfo>();
    const connect = vi.fn(() => pending.promise);
    const disconnect = vi.fn(async () => undefined);
    const mounted = mountWithPlugin(() => useWallet(), [makeAdapter({ connect, disconnect })]);

    const connection = mounted.exposed.connect('fake');
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    await mounted.exposed.disconnect();
    expect(mounted.exposed.connecting.value).toBe(false);
    expect(mounted.exposed.error.value).toBeNull();

    pending.resolve(ACCOUNT);
    await expect(connection).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    expect(mounted.exposed.connecting.value).toBe(false);
    expect(mounted.exposed.error.value).toBeNull();
    mounted.app.unmount();
  });

  it('tracks auto-connect and suppresses a stale reconnect race error', async () => {
    const storedState = deferred<string | null>();
    const pendingConnection = deferred<AccountInfo>();
    const connect = vi.fn(() => pendingConnection.promise);
    const storage = {
      get: vi.fn(() => storedState.promise),
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
    app.use(
      createXrplConnect({ adapters: [makeAdapter({ connect })], autoConnect: true, storage })
    );
    app.mount(root);

    expect(wallet!.connecting.value).toBe(true);
    await vi.waitFor(() => expect(storage.get).toHaveBeenCalledTimes(1));
    const manualConnection = wallet!.connect('fake');
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    storedState.resolve(
      JSON.stringify({
        walletId: 'fake',
        account: ACCOUNT,
        network: ACCOUNT.network,
        timestamp: Date.now(),
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wallet!.connecting.value).toBe(true);
    expect(wallet!.error.value).toBeNull();

    pendingConnection.resolve(ACCOUNT);
    await expect(manualConnection).resolves.toEqual(ACCOUNT);
    await vi.waitFor(() => expect(wallet!.connecting.value).toBe(false));
    expect(wallet!.connected.value).toBe(true);
    expect(wallet!.error.value).toBeNull();
    app.unmount();
  });
});

describe('client-only SSR boundaries', () => {
  const ServerClientOnly = defineComponent({
    setup() {
      return () => h(Comment);
    },
  });

  it('still executes setup when only the template content is client-only', async () => {
    const universalWalletControls = defineComponent({
      setup() {
        useWallet();
        return () => h(ServerClientOnly);
      },
    });

    await expect(renderToString(createSSRApp(universalWalletControls))).rejects.toThrow(
      /app\.use\(createXrplConnect/
    );
  });

  it('does not execute composables in a child below the client-only boundary', async () => {
    const walletSetup = vi.fn();
    const clientWalletControls = defineComponent({
      setup() {
        walletSetup();
        useWallet();
        return () => null;
      },
    });
    const universalPage = defineComponent({
      setup() {
        return () =>
          h(ServerClientOnly, null, {
            default: () => h(clientWalletControls),
          });
      },
    });

    await expect(renderToString(createSSRApp(universalPage))).resolves.toBe('<!---->');
    expect(walletSetup).not.toHaveBeenCalled();
  });
});

describe('<WalletConnector>', () => {
  it('exposes the complete custom-element control contract', () => {
    expectTypeOf<WalletConnectorElement['open']>().toEqualTypeOf<() => Promise<void>>();
    expectTypeOf<WalletConnectorElement['openAndWait']>().toEqualTypeOf<
      () => Promise<AccountInfo>
    >();
    expectTypeOf<WalletConnectorElement['toggle']>().toEqualTypeOf<() => void>();
    type WalletModal = ReturnType<typeof useWalletModal>;
    expectTypeOf<WalletModal['ready']['value']>().toEqualTypeOf<boolean>();
    expectTypeOf<WalletModal['open']>().toEqualTypeOf<() => Promise<void>>();
    expectTypeOf<WalletModal['openAndWait']>().toEqualTypeOf<() => Promise<AccountInfo>>();
    expectTypeOf<WalletModal['close']>().toEqualTypeOf<() => void>();
  });

  beforeAll(() => {
    if (customElements.get('xrpl-wallet-connector')) return;
    customElements.define(
      'xrpl-wallet-connector',
      class extends HTMLElement {
        manager: unknown = null;
        opened = false;
        openError: Error | null = null;
        private waiters = new Set<{
          resolve: (account: AccountInfo) => void;
          reject: (error: Error) => void;
        }>();
        setWalletManager(manager: unknown) {
          this.manager = manager;
        }
        open(): Promise<void> {
          if (this.openError) return Promise.reject(this.openError);
          this.opened = true;
          return Promise.resolve();
        }
        openAndWait(): Promise<AccountInfo> {
          const opening = this.open();
          return new Promise<AccountInfo>((resolve, reject) => {
            const waiter = { resolve, reject };
            this.waiters.add(waiter);
            void opening.catch((error: unknown) => {
              if (!this.waiters.delete(waiter)) return;
              reject(error instanceof Error ? error : new Error(String(error)));
            });
          });
        }
        close() {
          this.opened = false;
          this.rejectWaiters(new Error('Modal closed before a wallet was connected.'));
        }
        resolveConnection(account: AccountInfo) {
          for (const waiter of this.waiters) waiter.resolve(account);
          this.waiters.clear();
        }
        disconnectedCallback() {
          this.rejectWaiters(new Error('Wallet connector disconnected.'));
        }
        private rejectWaiters(error: Error) {
          for (const waiter of this.waiters) waiter.reject(error);
          this.waiters.clear();
        }
      }
    );
  });

  it('rejects modal calls until a connector is registered', async () => {
    const mounted = mountWithPlugin(() => useWalletModal());

    expect(mounted.exposed.ready.value).toBe(false);
    await expect(mounted.exposed.open()).rejects.toThrow(/no <WalletConnector> is registered/);
    await expect(mounted.exposed.openAndWait()).rejects.toThrow(
      /no <WalletConnector> is registered/
    );
    expect(() => mounted.exposed.close()).not.toThrow();
    mounted.app.unmount();
  });

  it('tracks asynchronous connector registration and unmount', async () => {
    const registration = deferred<CustomElementConstructor>();
    const whenDefined = vi
      .spyOn(customElements, 'whenDefined')
      .mockReturnValueOnce(registration.promise);
    const mounted = mountModal(() => h(WalletConnector));

    expect(mounted.modal.ready.value).toBe(false);
    await expect(mounted.modal.open()).rejects.toThrow(/no <WalletConnector> is registered/);

    registration.resolve(customElements.get('xrpl-wallet-connector')!);
    await vi.waitFor(() => expect(mounted.modal.ready.value).toBe(true));

    mounted.app.unmount();
    expect(mounted.modal.ready.value).toBe(false);
    whenDefined.mockRestore();
  });

  it('tracks connector deactivation and reactivation through KeepAlive', async () => {
    const showConnector = ref(true);
    const Placeholder = defineComponent(() => () => null);
    const mounted = mountModal(() =>
      h(KeepAlive, null, {
        default: () => (showConnector.value ? h(WalletConnector) : h(Placeholder)),
      })
    );
    await vi.waitFor(() => expect(mounted.modal.ready.value).toBe(true));
    const element = mounted.root.querySelector(
      'xrpl-wallet-connector'
    ) as TestWalletConnectorElement;

    showConnector.value = false;
    await nextTick();
    expect(element.isConnected).toBe(false);
    expect(mounted.modal.ready.value).toBe(false);
    await expect(mounted.modal.openAndWait()).rejects.toThrow(/no <WalletConnector> is registered/);

    showConnector.value = true;
    await nextTick();
    await vi.waitFor(() => expect(mounted.modal.ready.value).toBe(true));
    expect(mounted.root.querySelector('xrpl-wallet-connector')).toBe(element);
    await mounted.modal.open();
    expect(element.opened).toBe(true);

    mounted.app.unmount();
    expect(mounted.modal.ready.value).toBe(false);
  });

  it('forwards open failures from the active connector', async () => {
    const mounted = mountModal(() => h(WalletConnector));
    await vi.waitFor(() => expect(mounted.modal.ready.value).toBe(true));
    const element = mounted.root.querySelector(
      'xrpl-wallet-connector'
    ) as TestWalletConnectorElement;
    const failure = new Error('availability check failed');
    element.openError = failure;

    await expect(mounted.modal.open()).rejects.toBe(failure);
    mounted.app.unmount();
  });

  it('forwards openAndWait success and close-before-connect rejection', async () => {
    const mounted = mountModal(() => h(WalletConnector));
    await vi.waitFor(() => expect(mounted.modal.ready.value).toBe(true));
    const element = mounted.root.querySelector(
      'xrpl-wallet-connector'
    ) as TestWalletConnectorElement;

    const failure = new Error('availability check failed');
    element.openError = failure;
    await expect(mounted.modal.openAndWait()).rejects.toBe(failure);
    element.openError = null;

    const closed = mounted.modal.openAndWait();
    mounted.modal.close();
    await expect(closed).rejects.toThrow(/closed/i);

    const connected = mounted.modal.openAndWait();
    await vi.waitFor(() => expect(element.opened).toBe(true));
    element.resolveConnection(ACCOUNT);
    await expect(connected).resolves.toEqual(ACCOUNT);
    mounted.app.unmount();
  });

  it('uses the newest connector and falls back while it is deactivated', async () => {
    const showSecond = ref(true);
    const Placeholder = defineComponent(() => () => null);
    const mounted = mountModal(() =>
      h('div', [
        h(WalletConnector, { key: 'first' }),
        h(KeepAlive, null, {
          default: () =>
            showSecond.value
              ? h(WalletConnector, { key: 'second' })
              : h(Placeholder, { key: 'placeholder' }),
        }),
      ])
    );
    await vi.waitFor(() =>
      expect(mounted.root.querySelectorAll('xrpl-wallet-connector')).toHaveLength(2)
    );
    await vi.waitFor(() => expect(mounted.modal.ready.value).toBe(true));
    const [first, second] = [
      ...mounted.root.querySelectorAll<TestWalletConnectorElement>('xrpl-wallet-connector'),
    ];

    await mounted.modal.open();
    expect(first.opened).toBe(false);
    expect(second.opened).toBe(true);

    showSecond.value = false;
    await nextTick();
    expect(second.isConnected).toBe(false);
    expect(mounted.modal.ready.value).toBe(true);
    first.opened = false;
    await mounted.modal.open();
    expect(first.opened).toBe(true);

    showSecond.value = true;
    await nextTick();
    await Promise.resolve();
    first.opened = false;
    second.opened = false;
    await mounted.modal.open();
    expect(first.opened).toBe(false);
    expect(second.opened).toBe(true);

    mounted.app.unmount();
    expect(mounted.modal.ready.value).toBe(false);
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
              cssVars: {
                '--xc-primary-button-hover-background': '#112233',
                '--xc-connect-button-hover-background': '#223344',
                '--xc-account-address-button-hover-color': '#334455',
              },
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
    expect(element.style.getPropertyValue('--xc-primary-button-hover-background')).toBe('#112233');
    expect(element.style.getPropertyValue('--xc-connect-button-hover-background')).toBe('#223344');
    expect(element.style.getPropertyValue('--xc-account-address-button-hover-color')).toBe(
      '#334455'
    );

    element.dispatchEvent(new CustomEvent('connecting', { detail: { walletId: 'fake' } }));
    expect(wallet!.connecting.value).toBe(true);
    expect(onConnecting).toHaveBeenCalledWith('fake');

    const error = createWalletError.connectionRejected('Fake Wallet');
    element.dispatchEvent(new CustomEvent('error', { detail: { error } }));
    expect(wallet!.error.value).toBe(error);
    expect(onError).toHaveBeenCalledWith(error);

    await wallet!.connect('fake');
    expect(onConnect).toHaveBeenCalledWith(ACCOUNT);
    await modal!.open();
    expect(element.opened).toBe(true);
    modal!.close();
    expect(element.opened).toBe(false);
    app.unmount();
  });
});
