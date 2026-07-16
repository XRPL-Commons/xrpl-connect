import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act, waitFor, renderHook } from '@testing-library/react';
import { StrictMode, useRef } from 'react';
import { renderToString } from 'react-dom/server';
import {
  WalletManager,
  STANDARD_NETWORKS,
  createWalletError,
  type WalletAdapter,
  type AccountInfo,
} from 'xrpl-connect';
import {
  XrplConnectProvider,
  useWallet,
  useSigner,
  WalletConnector,
  WalletErrorCode,
} from '../src';

const ACCOUNT: AccountInfo = { address: 'rTEST', network: STANDARD_NETWORKS.testnet };

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

  it('creates exactly one WalletManager across re-renders (incl. StrictMode)', () => {
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
});
