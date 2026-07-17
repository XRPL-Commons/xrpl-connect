import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { WalletManager, isWalletError } from 'xrpl-connect';
import type { AccountInfo, NetworkInfo, WalletError, ConnectOptions } from 'xrpl-connect';
import type {
  XrplConnectContextValue,
  XrplConnectProviderProps,
  WalletConnectorElement,
} from './types';

const XrplConnectContext = createContext<XrplConnectContextValue | null>(null);

/**
 * Wrap your app once. Holds a single {@link WalletManager} (built from `config`
 * — your adapters, API keys, network) for the whole subtree, exposes reactive
 * connection state, and drives the `<WalletConnector>` modal. The manager is
 * created exactly once on mount; `config` is read at that point (use a React
 * `key` on the provider to rebuild it). (#33)
 */
export function XrplConnectProvider({ config, children }: XrplConnectProviderProps) {
  // Lazy ref init (NOT useState initializer): React StrictMode double-invokes
  // state initializers in dev, which would build two managers — and the manager
  // constructor has side effects (logger config, autoConnect). useRef persists
  // across the double render, so this runs exactly once per mount.
  const managerRef = useRef<WalletManager | null>(null);
  if (managerRef.current === null) {
    managerRef.current = new WalletManager(config);
  }
  const manager = managerRef.current;

  const connectorRef = useRef<WalletConnectorElement | null>(null);

  const [connected, setConnected] = useState<boolean>(manager.connected);
  const [account, setAccount] = useState<AccountInfo | null>(manager.account);
  const [network, setNetwork] = useState<NetworkInfo | null>(manager.account?.network ?? null);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [error, setError] = useState<WalletError | null>(null);

  useEffect(() => {
    const sync = () => {
      setConnected(manager.connected);
      setAccount(manager.account);
      setNetwork(manager.account?.network ?? null);
    };
    const onConnect = () => {
      setError(null);
      setConnecting(false);
      sync();
    };
    const onDisconnect = () => sync();
    const onAccountChanged = () => sync();
    const onNetworkChanged = () => sync();
    const onError = (err: unknown) => {
      setConnecting(false);
      if (isWalletError(err)) setError(err);
    };

    manager.on('connect', onConnect);
    manager.on('disconnect', onDisconnect);
    manager.on('accountChanged', onAccountChanged);
    manager.on('networkChanged', onNetworkChanged);
    manager.on('error', onError);

    // `autoConnect` may have settled before this effect ran — sync once now.
    sync();

    return () => {
      manager.off('connect', onConnect);
      manager.off('disconnect', onDisconnect);
      manager.off('accountChanged', onAccountChanged);
      manager.off('networkChanged', onNetworkChanged);
      manager.off('error', onError);
    };
  }, [manager]);

  const connect = useCallback(
    async (walletId: string, options?: ConnectOptions) => {
      setConnecting(true);
      setError(null);
      try {
        return await manager.connect(walletId, options);
      } catch (err) {
        setConnecting(false);
        if (isWalletError(err)) setError(err);
        throw err;
      }
    },
    [manager]
  );

  const disconnect = useCallback(() => manager.disconnect(), [manager]);

  const registerConnector = useCallback((el: WalletConnectorElement | null) => {
    connectorRef.current = el;
  }, []);
  const reportModalConnecting = useCallback(() => {
    setConnecting(true);
    setError(null);
  }, []);
  const reportModalError = useCallback((modalError: WalletError) => {
    setConnecting(false);
    setError(modalError);
  }, []);

  const openModal = useCallback(() => connectorRef.current?.open(), []);
  const closeModal = useCallback(() => connectorRef.current?.close(), []);

  const value = useMemo<XrplConnectContextValue>(
    () => ({
      manager,
      connected,
      account,
      network,
      connecting,
      error,
      connect,
      disconnect,
      registerConnector,
      reportModalConnecting,
      reportModalError,
      openModal,
      closeModal,
    }),
    [
      manager,
      connected,
      account,
      network,
      connecting,
      error,
      connect,
      disconnect,
      registerConnector,
      reportModalConnecting,
      reportModalError,
      openModal,
      closeModal,
    ]
  );

  return <XrplConnectContext.Provider value={value}>{children}</XrplConnectContext.Provider>;
}

/**
 * @internal Access the provider context, throwing a helpful error when a hook is
 * used outside `<XrplConnectProvider>`.
 */
export function useXrplConnectContext(): XrplConnectContextValue {
  const ctx = useContext(XrplConnectContext);
  if (ctx === null) {
    throw new Error(
      'xrpl-connect/react: hooks and <WalletConnector> must be used inside <XrplConnectProvider>.'
    );
  }
  return ctx;
}
