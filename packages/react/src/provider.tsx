import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { WalletManager, isWalletError } from '@xrpl-connect/core';
import type { AccountInfo, NetworkInfo, WalletError, ConnectOptions } from '@xrpl-connect/core';
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
 * stable for the committed mount; `config` is read at that point (use a React
 * `key` on the provider to rebuild it). (#33)
 */
export function XrplConnectProvider({ config, children }: XrplConnectProviderProps) {
  // React may discard an initial render in development StrictMode. Suppress the
  // constructor's asynchronous auto-connect so a discarded manager is inert;
  // the committed manager starts reconnecting from the lifecycle effect below.
  const managerRef = useRef<WalletManager | null>(null);
  if (managerRef.current === null) {
    managerRef.current = new WalletManager({ ...config, autoConnect: false });
  }
  const manager = managerRef.current;
  const autoConnectRef = useRef(config.autoConnect === true);
  const mountedRef = useRef(false);

  const connectorsRef = useRef<Set<WalletConnectorElement>>(new Set());

  const [connected, setConnected] = useState<boolean>(manager.connected);
  const [account, setAccount] = useState<AccountInfo | null>(manager.account);
  const [network, setNetwork] = useState<NetworkInfo | null>(manager.account?.network ?? null);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [error, setError] = useState<WalletError | null>(null);

  useEffect(() => {
    mountedRef.current = true;
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

    sync();

    let disposed = false;
    if (autoConnectRef.current) {
      // StrictMode replays effects before microtasks run. Deferring here means
      // the throwaway setup is cancelled and only the live setup reconnects.
      queueMicrotask(() => {
        if (disposed) return;
        void manager.reconnect().then(
          () => {
            if (disposed && manager.connected) void manager.disconnect().catch(() => undefined);
          },
          (reconnectError: unknown) => {
            if (!disposed && isWalletError(reconnectError)) setError(reconnectError);
          }
        );
      });
    }

    return () => {
      disposed = true;
      mountedRef.current = false;
      manager.off('connect', onConnect);
      manager.off('disconnect', onDisconnect);
      manager.off('accountChanged', onAccountChanged);
      manager.off('networkChanged', onNetworkChanged);
      manager.off('error', onError);
      void manager.disconnect().catch(() => undefined);
    };
  }, [manager]);

  const connect = useCallback(
    async (walletId: string, options?: ConnectOptions) => {
      setConnecting(true);
      setError(null);
      try {
        const connectedAccount = await manager.connect(walletId, options);
        if (!mountedRef.current && manager.connected) {
          await manager.disconnect();
        }
        return connectedAccount;
      } catch (err) {
        if (mountedRef.current) {
          setConnecting(false);
          if (isWalletError(err)) setError(err);
        }
        throw err;
      }
    },
    [manager]
  );

  const disconnect = useCallback(() => manager.disconnect(), [manager]);

  const registerConnector = useCallback((el: WalletConnectorElement) => {
    connectorsRef.current.add(el);
  }, []);
  const unregisterConnector = useCallback((el: WalletConnectorElement) => {
    connectorsRef.current.delete(el);
  }, []);
  const reportModalConnecting = useCallback(() => {
    setConnecting(true);
    setError(null);
  }, []);
  const reportModalError = useCallback((modalError: WalletError) => {
    setConnecting(false);
    setError(modalError);
  }, []);

  const getActiveConnector = useCallback(() => {
    const connectors = [...connectorsRef.current];
    return connectors.at(-1) ?? null;
  }, []);
  const openModal = useCallback(() => getActiveConnector()?.open(), [getActiveConnector]);
  const closeModal = useCallback(() => getActiveConnector()?.close(), [getActiveConnector]);

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
      unregisterConnector,
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
      unregisterConnector,
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
