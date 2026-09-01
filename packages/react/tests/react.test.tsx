import { describe, it, expect, expectTypeOf, beforeAll, vi } from 'vite-plus/test';
import { render, act, waitFor, renderHook } from '@testing-library/react';
import { StrictMode, useRef } from 'react';
import { renderToString } from 'react-dom/server';
import {
  WalletManager,
  STANDARD_NETWORKS,
  createWalletError,
  type WalletAdapter,
  type AccountInfo,
  type StorageAdapter,
} from '@xrpl-connect/core';
import {
  XrplConnectProvider,
  useWallet,
  useSigner,
  useWalletModal,
  WalletConnector,
  WalletErrorCode,
} from '../src';

const ACCOUNT: AccountInfo = { address: 'rTEST', network: STANDARD_NETWORKS.testnet };

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function makeAdapter(overrides: Partial<WalletAdapter> = {}): WalletAdapter {
  return {
    id: 'fake',
    name: 'Fake',
    isAvailable: async () => true,
    connect: async () => ACCOUNT,
    disconnect: async () => {},
    getAccount: async () => null,
    getNetwork: async () => STANDARD_NETWORKS.testnet,
    sign: async () => ({ hash: 'H' }),
    signAndSubmit: async () => ({ hash: 'H' }),
    signMessage: async () => ({ message: 'm', signature: 's', publicKey: 'p' }),
    ...overrides,
  } as WalletAdapter;
}

function wrapper(adapters: WalletAdapter[]) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <XrplConnectProvider config={{ adapters, autoConnect: false }}>
        {children}
      </XrplConnectProvider>
    );
  };
}

describe('XrplConnectProvider + hooks', () => {
  it('renders on the server without accessing browser-only globals', () => {
    expect(() =>
      renderToString(
        <XrplConnectProvider config={{ adapters: [makeAdapter()], autoConnect: false }}>
          <div>SSR</div>
        </XrplConnectProvider>
      )
    ).not.toThrow();
  });

  it('throws when a hook is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useWallet())).toThrow(/XrplConnectProvider/);
    spy.mockRestore();
  });

  it('keeps one committed WalletManager across re-renders in StrictMode', () => {
    const managers: WalletManager[] = [];
    function Probe() {
      const { manager } = useWallet();
      const seen = useRef(false);
      if (!seen.current) {
        seen.current = true;
        managers.push(manager);
      }
      return null;
    }
    const adapters = [makeAdapter()];
    const { rerender } = render(
      <StrictMode>
        <XrplConnectProvider config={{ adapters, autoConnect: false }}>
          <Probe />
        </XrplConnectProvider>
      </StrictMode>
    );
    rerender(
      <StrictMode>
        <XrplConnectProvider config={{ adapters, autoConnect: false }}>
          <Probe />
        </XrplConnectProvider>
      </StrictMode>
    );
    const unique = new Set(managers);
    expect(unique.size).toBe(1);
  });

  it('starts auto-connect only once in StrictMode', async () => {
    const storage: StorageAdapter = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
      clear: vi.fn(async () => {}),
    };

    render(
      <StrictMode>
        <XrplConnectProvider config={{ adapters: [makeAdapter()], autoConnect: true, storage }}>
          <div />
        </XrplConnectProvider>
      </StrictMode>
    );

    await waitFor(() => expect(storage.get).toHaveBeenCalledTimes(1));
  });

  it('tracks auto-connect without surfacing an expected manual overlap error', async () => {
    const storedState = deferred<string | null>();
    const pendingConnection = deferred<AccountInfo>();
    const connect = vi.fn(() => pendingConnection.promise);
    const storage: StorageAdapter = {
      get: vi.fn(() => storedState.promise),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
      clear: vi.fn(async () => {}),
    };
    const adapters = [makeAdapter({ connect })];
    const { result, unmount } = renderHook(() => useWallet(), {
      wrapper: ({ children }) => (
        <XrplConnectProvider config={{ adapters, autoConnect: true, storage }}>
          {children}
        </XrplConnectProvider>
      ),
    });

    await waitFor(() => expect(storage.get).toHaveBeenCalledTimes(1));
    expect(result.current.connecting).toBe(true);

    let manualConnection!: Promise<AccountInfo>;
    act(() => {
      manualConnection = result.current.connect('fake');
    });
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));

    await act(async () => {
      storedState.resolve(
        JSON.stringify({
          version: 1,
          payload: {
            walletId: 'fake',
            account: ACCOUNT,
            network: ACCOUNT.network,
            timestamp: Date.now(),
          },
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.connecting).toBe(true);
    expect(result.current.error).toBeNull();

    await act(async () => {
      pendingConnection.resolve(ACCOUNT);
      await expect(manualConnection).resolves.toEqual(ACCOUNT);
    });
    await waitFor(() => expect(result.current.connecting).toBe(false));
    expect(result.current.connected).toBe(true);
    expect(result.current.error).toBeNull();
    unmount();
  });

  it('cancels auto-connect while persisted state is still loading', async () => {
    const storedState = deferred<string | null>();
    const connect = vi.fn(async () => ACCOUNT);
    const storage: StorageAdapter = {
      get: vi.fn(() => storedState.promise),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
      clear: vi.fn(async () => {}),
    };
    const { result } = renderHook(() => useWallet(), {
      wrapper: ({ children }) => (
        <XrplConnectProvider
          config={{ adapters: [makeAdapter({ connect })], autoConnect: true, storage }}
        >
          {children}
        </XrplConnectProvider>
      ),
    });

    await waitFor(() => expect(storage.get).toHaveBeenCalledTimes(1));
    expect(result.current.connecting).toBe(true);

    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.connecting).toBe(false);

    await act(async () => {
      storedState.resolve(
        JSON.stringify({
          version: 1,
          payload: {
            walletId: 'fake',
            account: ACCOUNT,
            network: ACCOUNT.network,
            timestamp: Date.now(),
          },
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(connect).not.toHaveBeenCalled();
    expect(result.current.connected).toBe(false);
    expect(result.current.connecting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('reflects connect/disconnect state through useWallet', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: wrapper([makeAdapter()]) });

    expect(result.current.connected).toBe(false);
    expect(result.current.account).toBeNull();

    await act(async () => {
      await result.current.connect('fake');
    });
    await waitFor(() => expect(result.current.connected).toBe(true));
    expect(result.current.account?.address).toBe('rTEST');

    await act(async () => {
      await result.current.disconnect();
    });
    await waitFor(() => expect(result.current.connected).toBe(false));
    expect(result.current.account).toBeNull();
  });

  it('keeps connecting true until every concurrent connection attempt settles', async () => {
    const pending = deferred<AccountInfo>();
    const connect = vi.fn(() => pending.promise);
    const { result, unmount } = renderHook(() => useWallet(), {
      wrapper: wrapper([makeAdapter({ connect })]),
    });

    let firstConnection!: Promise<AccountInfo>;
    act(() => {
      firstConnection = result.current.connect('fake');
    });
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));

    await act(async () => {
      await expect(result.current.connect('fake')).rejects.toMatchObject({
        code: WalletErrorCode.ALREADY_CONNECTED,
      });
    });
    expect(result.current.connecting).toBe(true);

    await act(async () => {
      pending.resolve(ACCOUNT);
      await expect(firstConnection).resolves.toEqual(ACCOUNT);
    });
    expect(result.current.connected).toBe(true);
    expect(result.current.connecting).toBe(false);
    expect(result.current.error).toBeNull();
    unmount();
  });

  it('clears connection state when a pending connection is cancelled', async () => {
    const pending = deferred<AccountInfo>();
    const connect = vi.fn(() => pending.promise);
    const disconnect = vi.fn(async () => {});
    const { result } = renderHook(() => useWallet(), {
      wrapper: wrapper([makeAdapter({ connect, disconnect })]),
    });

    let connection!: Promise<AccountInfo>;
    act(() => {
      connection = result.current.connect('fake');
    });
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.connecting).toBe(false);
    expect(result.current.error).toBeNull();

    await act(async () => {
      pending.resolve(ACCOUNT);
      await expect(connection).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    });
    expect(result.current.connecting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('disconnects an owned manager when the provider unmounts', async () => {
    const disconnect = vi.fn(async () => {});
    const { result, unmount } = renderHook(() => useWallet(), {
      wrapper: wrapper([makeAdapter({ disconnect })]),
    });
    await act(async () => {
      await result.current.connect('fake');
    });

    unmount();
    await waitFor(() => expect(disconnect).toHaveBeenCalledTimes(1));
  });

  it('cancels a provider connection that resolves after unmount', async () => {
    const pending = deferred<AccountInfo>();
    const disconnect = vi.fn(async () => {});
    const adapter = makeAdapter({
      connect: vi.fn(() => pending.promise),
      disconnect,
    });
    const { result, unmount } = renderHook(() => useWallet(), { wrapper: wrapper([adapter]) });

    const manager = result.current.manager;
    let connecting!: Promise<AccountInfo>;
    act(() => {
      connecting = result.current.connect('fake');
    });
    await waitFor(() => expect(adapter.connect).toHaveBeenCalledTimes(1));
    unmount();
    await waitFor(() => expect(disconnect).toHaveBeenCalledTimes(1));
    pending.resolve(ACCOUNT);

    await expect(connecting).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    expect(disconnect).toHaveBeenCalled();
    expect(manager.connected).toBe(false);
  });

  it('cancels a direct manager connection that resolves after unmount', async () => {
    const pending = deferred<AccountInfo>();
    const disconnect = vi.fn(async () => {});
    const adapter = makeAdapter({
      connect: vi.fn(() => pending.promise),
      disconnect,
    });
    let manager: WalletManager | null = null;
    function Capture() {
      manager = useWallet().manager;
      return null;
    }
    const { unmount } = render(
      <XrplConnectProvider config={{ adapters: [adapter], autoConnect: false }}>
        <Capture />
      </XrplConnectProvider>
    );

    const connecting = manager!.connect('fake');
    await waitFor(() => expect(adapter.connect).toHaveBeenCalledTimes(1));
    unmount();
    await waitFor(() => expect(disconnect).toHaveBeenCalledTimes(1));
    pending.resolve(ACCOUNT);

    await expect(connecting).rejects.toMatchObject({ code: WalletErrorCode.NOT_CONNECTED });
    expect(disconnect).toHaveBeenCalled();
    expect(manager!.connected).toBe(false);
  });

  it('useSigner rejects with a typed WalletError (code + category)', async () => {
    const adapter = makeAdapter({
      sign: async () => {
        throw createWalletError.signRejected();
      },
    });
    const { result } = renderHook(() => ({ wallet: useWallet(), signer: useSigner() }), {
      wrapper: wrapper([adapter]),
    });
    await act(async () => {
      await result.current.wallet.connect('fake');
    });

    await expect(
      result.current.signer.sign({ TransactionType: 'Payment' } as never)
    ).rejects.toMatchObject({ code: WalletErrorCode.SIGN_REJECTED, category: expect.any(String) });
  });

  it('useSigner returns the connected signer address with signing results', async () => {
    const { result } = renderHook(() => ({ wallet: useWallet(), signer: useSigner() }), {
      wrapper: wrapper([makeAdapter()]),
    });
    await act(async () => {
      await result.current.wallet.connect('fake');
    });

    const signed = await result.current.signer.sign({ TransactionType: 'Payment' } as never);
    const signedMessage = await result.current.signer.signMessage('hello');

    expect(signed).toMatchObject({ hash: 'H', signerAddress: ACCOUNT.address });
    expect(signedMessage).toMatchObject({ signature: 's', signerAddress: ACCOUNT.address });
  });
});

describe('<WalletConnector>', () => {
  beforeAll(() => {
    // Register a stub custom element so `whenDefined` resolves and binding runs.
    if (!customElements.get('xrpl-wallet-connector')) {
      class Stub extends HTMLElement {
        manager: unknown = null;
        opened = false;
        openError: Error | null = null;
        private waiters = new Set<{
          resolve: (account: AccountInfo) => void;
          reject: (error: Error) => void;
        }>();
        setWalletManager(m: unknown) {
          this.manager = m;
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
      customElements.define('xrpl-wallet-connector', Stub);
    }
  });

  it('exposes the complete asynchronous modal contract', () => {
    type WalletModal = ReturnType<typeof useWalletModal>;
    expectTypeOf<WalletModal['ready']>().toEqualTypeOf<boolean>();
    expectTypeOf<WalletModal['open']>().toEqualTypeOf<() => Promise<void>>();
    expectTypeOf<WalletModal['openAndWait']>().toEqualTypeOf<() => Promise<AccountInfo>>();
    expectTypeOf<WalletModal['close']>().toEqualTypeOf<() => void>();
  });

  it('rejects modal calls until a connector is registered', async () => {
    const { result } = renderHook(() => useWalletModal(), {
      wrapper: wrapper([makeAdapter()]),
    });

    expect(result.current.ready).toBe(false);
    await expect(result.current.open()).rejects.toThrow(
      'xrpl-connect/react: no <WalletConnector> is registered'
    );
    await expect(result.current.openAndWait()).rejects.toThrow(
      'xrpl-connect/react: no <WalletConnector> is registered'
    );
    expect(() => result.current.close()).not.toThrow();
  });

  it('forwards open failures and openAndWait results from the active connector', async () => {
    let modal: ReturnType<typeof useWalletModal> | null = null;
    function Capture() {
      modal = useWalletModal();
      return null;
    }
    render(
      <XrplConnectProvider config={{ adapters: [makeAdapter()], autoConnect: false }}>
        <Capture />
        <WalletConnector />
      </XrplConnectProvider>
    );

    await waitFor(() => expect(modal!.ready).toBe(true));
    const element = document.querySelector('xrpl-wallet-connector') as HTMLElement & {
      opened: boolean;
      openError: Error | null;
      resolveConnection(account: AccountInfo): void;
    };
    const failure = new Error('availability check failed');
    element.openError = failure;
    await expect(modal!.open()).rejects.toBe(failure);
    await expect(modal!.openAndWait()).rejects.toBe(failure);
    element.openError = null;

    const connected = modal!.openAndWait();
    await waitFor(() => expect(element.opened).toBe(true));
    element.resolveConnection(ACCOUNT);
    await expect(connected).resolves.toEqual(ACCOUNT);

    const closed = modal!.openAndWait();
    modal!.close();
    await expect(closed).rejects.toThrow(/closed/i);
  });

  it('binds the provider manager and fires onConnect with the account', async () => {
    const onConnect = vi.fn();
    let mgr: WalletManager | null = null;
    function Capture() {
      mgr = useWallet().manager;
      return null;
    }
    const adapters = [makeAdapter()];
    render(
      <XrplConnectProvider config={{ adapters, autoConnect: false }}>
        <Capture />
        <WalletConnector primaryWallet="fake" wallets={['fake']} onConnect={onConnect} />
      </XrplConnectProvider>
    );

    const el = document.querySelector('xrpl-wallet-connector') as HTMLElement & {
      manager: unknown;
    };
    await waitFor(() => expect(el.manager).not.toBeNull());

    await act(async () => {
      await mgr!.connect('fake');
    });
    await waitFor(() => expect(onConnect).toHaveBeenCalledWith(ACCOUNT));
  });

  it('forwards explicit hover cssVars to the custom element', async () => {
    const cssVars = {
      '--xc-primary-button-hover-background': '#112233',
      '--xc-connect-button-hover-background': '#223344',
      '--xc-account-address-button-hover-color': '#334455',
    } as const;
    render(
      <XrplConnectProvider config={{ adapters: [makeAdapter()], autoConnect: false }}>
        <WalletConnector cssVars={cssVars} />
      </XrplConnectProvider>
    );

    const element = document.querySelector('xrpl-wallet-connector') as HTMLElement & {
      manager: unknown;
    };
    await waitFor(() => expect(element.manager).not.toBeNull());
    for (const [variable, value] of Object.entries(cssVars)) {
      expect(element.style.getPropertyValue(variable)).toBe(value);
    }
  });

  it('observes a connection started before custom-element binding settles', async () => {
    const onConnect = vi.fn();
    let mgr: WalletManager | null = null;
    function Capture() {
      mgr = useWallet().manager;
      return null;
    }
    render(
      <XrplConnectProvider config={{ adapters: [makeAdapter()], autoConnect: false }}>
        <Capture />
        <WalletConnector onConnect={onConnect} />
      </XrplConnectProvider>
    );

    await act(async () => {
      await mgr!.connect('fake');
    });
    await waitFor(() => expect(onConnect).toHaveBeenCalledWith(ACCOUNT));
  });

  it('fires onConnect again after reconnecting the same account', async () => {
    const onConnect = vi.fn();
    let mgr: WalletManager | null = null;
    function Capture() {
      mgr = useWallet().manager;
      return null;
    }
    render(
      <XrplConnectProvider config={{ adapters: [makeAdapter()], autoConnect: false }}>
        <Capture />
        <WalletConnector onConnect={onConnect} />
      </XrplConnectProvider>
    );

    await act(async () => {
      await mgr!.connect('fake');
      await mgr!.disconnect();
      await mgr!.connect('fake');
    });
    await waitFor(() => expect(onConnect).toHaveBeenCalledTimes(2));
  });

  it('propagates modal lifecycle and typed errors to callbacks and provider state', async () => {
    const onError = vi.fn();
    let walletState: ReturnType<typeof useWallet> | null = null;
    function Capture() {
      walletState = useWallet();
      return null;
    }
    render(
      <XrplConnectProvider config={{ adapters: [makeAdapter()], autoConnect: false }}>
        <Capture />
        <WalletConnector className="connector" onError={onError} />
      </XrplConnectProvider>
    );

    const el = document.querySelector('xrpl-wallet-connector') as HTMLElement & {
      manager: unknown;
    };
    await waitFor(() => expect(el.manager).not.toBeNull());
    expect(el.getAttribute('class')).toBe('connector');
    expect(el.getAttribute('classname')).toBeNull();

    act(() => {
      el.dispatchEvent(new CustomEvent('connecting', { detail: { walletId: 'fake' } }));
    });
    await waitFor(() => expect(walletState!.connecting).toBe(true));

    const error = createWalletError.connectionRejected('Fake');
    act(() => {
      el.dispatchEvent(new CustomEvent('error', { detail: { error, walletId: 'fake' } }));
    });

    await waitFor(() => expect(walletState!.error).toBe(error));
    expect(walletState!.connecting).toBe(false);
    expect(onError).toHaveBeenCalledWith(error);

    act(() => {
      el.dispatchEvent(
        new CustomEvent('error', {
          detail: {
            error: new Error('Fake is not installed'),
            errorType: 'unavailable',
            walletId: 'fake',
          },
        })
      );
    });
    await waitFor(() =>
      expect(walletState!.error?.code).toBe(WalletErrorCode.WALLET_NOT_INSTALLED)
    );
    expect(onError).toHaveBeenLastCalledWith(
      expect.objectContaining({ code: WalletErrorCode.WALLET_NOT_INSTALLED })
    );
  });

  it('keeps connecting true when a modal error overlaps a manual connection', async () => {
    const pending = deferred<AccountInfo>();
    const connect = vi.fn(() => pending.promise);
    const onConnect = vi.fn();
    const onError = vi.fn();
    let walletState: ReturnType<typeof useWallet> | null = null;
    function Capture() {
      walletState = useWallet();
      return null;
    }
    const { unmount } = render(
      <XrplConnectProvider config={{ adapters: [makeAdapter({ connect })], autoConnect: false }}>
        <Capture />
        <WalletConnector onConnect={onConnect} onError={onError} />
      </XrplConnectProvider>
    );

    const el = document.querySelector('xrpl-wallet-connector') as HTMLElement & {
      manager: unknown;
    };
    await waitFor(() => expect(el.manager).not.toBeNull());

    let manualConnection!: Promise<AccountInfo>;
    act(() => {
      manualConnection = walletState!.connect('fake');
    });
    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));

    act(() => {
      el.dispatchEvent(new CustomEvent('connecting', { detail: { walletId: 'fake' } }));
    });
    const modalError = createWalletError.connectionRejected('Fake');
    act(() => {
      el.dispatchEvent(
        new CustomEvent('error', { detail: { error: modalError, walletId: 'fake' } })
      );
    });
    await waitFor(() => expect(walletState!.error).toBe(modalError));
    expect(walletState!.connecting).toBe(true);
    expect(onError).toHaveBeenCalledWith(modalError);

    await act(async () => {
      pending.resolve(ACCOUNT);
      await expect(manualConnection).resolves.toEqual(ACCOUNT);
    });
    await waitFor(() => expect(walletState!.connecting).toBe(false));
    expect(walletState!.connected).toBe(true);
    expect(walletState!.error).toBeNull();
    expect(onConnect).toHaveBeenCalledWith(ACCOUNT);
    unmount();
  });

  it('ignores a stale modal error after a manual connection succeeds', async () => {
    const onError = vi.fn();
    let walletState: ReturnType<typeof useWallet> | null = null;
    function Capture() {
      walletState = useWallet();
      return null;
    }
    render(
      <XrplConnectProvider config={{ adapters: [makeAdapter()], autoConnect: false }}>
        <Capture />
        <WalletConnector onError={onError} />
      </XrplConnectProvider>
    );

    const el = document.querySelector('xrpl-wallet-connector') as HTMLElement & {
      manager: unknown;
    };
    await waitFor(() => expect(el.manager).not.toBeNull());

    act(() => {
      el.dispatchEvent(
        new CustomEvent('connecting', {
          detail: { walletId: 'fake', connectionAttemptId: 1 },
        })
      );
    });
    await act(async () => {
      await walletState!.connect('fake');
    });
    expect(walletState!.connected).toBe(true);
    expect(walletState!.error).toBeNull();

    const staleError = createWalletError.alreadyConnected('Fake');
    act(() => {
      el.dispatchEvent(
        new CustomEvent('error', {
          detail: { error: staleError, walletId: 'fake', connectionAttemptId: 1 },
        })
      );
    });

    expect(walletState!.connected).toBe(true);
    expect(walletState!.connecting).toBe(false);
    expect(walletState!.error).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('keeps sibling modal attempts active when one connector closes', async () => {
    let walletState: ReturnType<typeof useWallet> | null = null;
    function Capture() {
      walletState = useWallet();
      return null;
    }
    render(
      <XrplConnectProvider config={{ adapters: [makeAdapter()], autoConnect: false }}>
        <Capture />
        <WalletConnector className="first" />
        <WalletConnector className="second" />
      </XrplConnectProvider>
    );

    const first = document.querySelector('.first') as HTMLElement & { manager: unknown };
    const second = document.querySelector('.second') as HTMLElement & { manager: unknown };
    await waitFor(() => {
      expect(first.manager).not.toBeNull();
      expect(second.manager).not.toBeNull();
    });

    act(() => {
      first.dispatchEvent(
        new CustomEvent('connecting', {
          detail: { walletId: 'fake', connectionAttemptId: 1 },
        })
      );
      second.dispatchEvent(
        new CustomEvent('connecting', {
          detail: { walletId: 'fake', connectionAttemptId: 1 },
        })
      );
    });
    await waitFor(() => expect(walletState!.connecting).toBe(true));

    act(() => first.dispatchEvent(new CustomEvent('close')));
    expect(walletState!.connecting).toBe(true);

    act(() => second.dispatchEvent(new CustomEvent('close')));
    expect(walletState!.connecting).toBe(false);
  });

  it('does not let a cancelled modal error clear a newer retry', async () => {
    const onError = vi.fn();
    let walletState: ReturnType<typeof useWallet> | null = null;
    function Capture() {
      walletState = useWallet();
      return null;
    }
    render(
      <XrplConnectProvider config={{ adapters: [makeAdapter()], autoConnect: false }}>
        <Capture />
        <WalletConnector onError={onError} />
      </XrplConnectProvider>
    );

    const el = document.querySelector('xrpl-wallet-connector') as HTMLElement & {
      manager: unknown;
    };
    await waitFor(() => expect(el.manager).not.toBeNull());

    act(() => {
      el.dispatchEvent(
        new CustomEvent('connecting', {
          detail: { walletId: 'fake', connectionAttemptId: 1 },
        })
      );
    });
    await act(async () => {
      await walletState!.disconnect();
    });
    act(() => {
      el.dispatchEvent(
        new CustomEvent('connecting', {
          detail: { walletId: 'fake', connectionAttemptId: 2 },
        })
      );
    });

    const staleError = createWalletError.notConnected();
    act(() => {
      el.dispatchEvent(
        new CustomEvent('error', {
          detail: { error: staleError, walletId: 'fake', connectionAttemptId: 1 },
        })
      );
    });
    expect(walletState!.connecting).toBe(true);
    expect(walletState!.error).toBeNull();
    expect(onError).not.toHaveBeenCalled();

    const currentError = createWalletError.connectionRejected('Fake');
    act(() => {
      el.dispatchEvent(
        new CustomEvent('error', {
          detail: { error: currentError, walletId: 'fake', connectionAttemptId: 2 },
        })
      );
    });
    expect(walletState!.connecting).toBe(false);
    expect(walletState!.error).toBe(currentError);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(currentError);
  });

  it('tracks readiness and falls back to the previous connector when the newest unmounts', async () => {
    let modal: ReturnType<typeof useWalletModal> | null = null;
    function Capture() {
      modal = useWalletModal();
      return null;
    }
    function View({ showFirst, showSecond }: { showFirst: boolean; showSecond: boolean }) {
      return (
        <XrplConnectProvider config={{ adapters: [makeAdapter()], autoConnect: false }}>
          <Capture />
          {showFirst && <WalletConnector key="first" className="first" />}
          {showSecond && <WalletConnector key="second" className="second" />}
        </XrplConnectProvider>
      );
    }

    const { rerender } = render(<View showFirst={false} showSecond={false} />);
    expect(modal!.ready).toBe(false);

    rerender(<View showFirst showSecond />);
    await waitFor(() => {
      expect(modal!.ready).toBe(true);
      expect(
        (document.querySelector('.first') as HTMLElement & { manager: unknown }).manager
      ).not.toBeNull();
      expect(
        (document.querySelector('.second') as HTMLElement & { manager: unknown }).manager
      ).not.toBeNull();
    });
    const first = document.querySelector('.first') as HTMLElement & { opened: boolean };
    const second = document.querySelector('.second') as HTMLElement & { opened: boolean };

    await act(async () => modal!.open());
    expect(first.opened).toBe(false);
    expect(second.opened).toBe(true);

    rerender(<View showFirst showSecond={false} />);
    expect(modal!.ready).toBe(true);
    first.opened = false;
    await act(async () => modal!.open());
    expect(first.opened).toBe(true);

    rerender(<View showFirst={false} showSecond={false} />);
    expect(modal!.ready).toBe(false);
    await expect(modal!.open()).rejects.toThrow(/no <WalletConnector> is registered/);
  });

  it('updates and removes the wallet allowlist attribute on rerender', async () => {
    function View({ wallets }: { wallets?: string[] }) {
      return (
        <XrplConnectProvider config={{ adapters: [makeAdapter()], autoConnect: false }}>
          <WalletConnector wallets={wallets} />
        </XrplConnectProvider>
      );
    }
    const { rerender } = render(<View wallets={['first', 'second']} />);
    const el = document.querySelector('xrpl-wallet-connector') as HTMLElement & {
      manager: unknown;
    };
    await waitFor(() => expect(el.manager).not.toBeNull());
    expect(el.getAttribute('wallets')).toBe('first,second');

    rerender(<View wallets={['third']} />);
    expect(el.getAttribute('wallets')).toBe('third');
    rerender(<View />);
    expect(el.hasAttribute('wallets')).toBe(false);
  });
});
