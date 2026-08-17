import { describe, it, expect, beforeAll, vi } from 'vite-plus/test';
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
          walletId: 'fake',
          account: ACCOUNT,
          network: ACCOUNT.network,
          timestamp: Date.now(),
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
});

describe('<WalletConnector>', () => {
  beforeAll(() => {
    // Register a stub custom element so `whenDefined` resolves and binding runs.
    if (!customElements.get('xrpl-wallet-connector')) {
      class Stub extends HTMLElement {
        manager: unknown = null;
        opened = false;
        setWalletManager(m: unknown) {
          this.manager = m;
        }
        open() {
          this.opened = true;
        }
        close() {
          this.opened = false;
        }
      }
      customElements.define('xrpl-wallet-connector', Stub);
    }
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

  it('keeps the remaining connector registered when a sibling unmounts', async () => {
    let modal: ReturnType<typeof useWalletModal> | null = null;
    function Capture() {
      modal = useWalletModal();
      return null;
    }
    function View({ showFirst }: { showFirst: boolean }) {
      return (
        <XrplConnectProvider config={{ adapters: [makeAdapter()], autoConnect: false }}>
          <Capture />
          {showFirst && <WalletConnector key="first" className="first" />}
          <WalletConnector key="second" className="second" />
        </XrplConnectProvider>
      );
    }

    const { rerender } = render(<View showFirst />);
    await waitFor(() => {
      expect(
        (document.querySelector('.second') as HTMLElement & { manager: unknown }).manager
      ).not.toBeNull();
    });
    rerender(<View showFirst={false} />);

    act(() => modal!.open());
    expect((document.querySelector('.second') as HTMLElement & { opened: boolean }).opened).toBe(
      true
    );
  });

  it('updates and removes the wallet allowlist attribute on rerender', () => {
    function View({ wallets }: { wallets?: string[] }) {
      return (
        <XrplConnectProvider config={{ adapters: [makeAdapter()], autoConnect: false }}>
          <WalletConnector wallets={wallets} />
        </XrplConnectProvider>
      );
    }
    const { rerender } = render(<View wallets={['first', 'second']} />);
    const el = document.querySelector('xrpl-wallet-connector')!;
    expect(el.getAttribute('wallets')).toBe('first,second');

    rerender(<View wallets={['third']} />);
    expect(el.getAttribute('wallets')).toBe('third');
    rerender(<View />);
    expect(el.hasAttribute('wallets')).toBe(false);
  });
});
