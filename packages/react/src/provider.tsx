import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { WalletErrorCode, WalletManager, isWalletError } from '@xrpl-connect/core';
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
  const connectionAttemptsRef = useRef<Set<symbol>>(new Set());
  const modalConnectingRef = useRef(false);

  const [connected, setConnected] = useState<boolean>(manager.connected);
  const [account, setAccount] = useState<AccountInfo | null>(manager.account);
  const [network, setNetwork] = useState<NetworkInfo | null>(manager.account?.network ?? null);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [error, setError] = useState<WalletError | null>(null);

  const syncConnecting = useCallback(() => {
    if (mountedRef.current) {
      setConnecting(connectionAttemptsRef.current.size > 0 || modalConnectingRef.current);
    }
  }, []);
  const beginConnectionAttempt = useCallback(() => {
    const attempt = Symbol('connectionAttempt');
    connectionAttemptsRef.current.add(attempt);
    if (mountedRef.current) setError(null);
    syncConnecting();
    return attempt;
  }, [syncConnecting]);
  const finishConnectionAttempt = useCallback(
    (attempt: symbol, failure?: unknown) => {
      if (!connectionAttemptsRef.current.delete(attempt) || !mountedRef.current) return;
      if (failure !== undefined && isWalletError(failure) && !manager.connected) {
        setError(failure);
      }
      syncConnecting();
    },
    [manager, syncConnecting]
  );
  const cancelConnectionState = useCallback(() => {
    connectionAttemptsRef.current.clear();
    modalConnectingRef.current = false;
    if (mountedRef.current) setError(null);
    syncConnecting();
  }, [syncConnecting]);

  useEffect(() => {
    mountedRef.current = true;
    syncConnecting();
    const sync = () => {
      setConnected(manager.connected);
      setAccount(manager.account);
      setNetwork(manager.account?.network ?? null);
    };
    const onConnect = () => {
      setError(null);
      modalConnectingRef.current = false;
      syncConnecting();
      sync();
    };
    const onDisconnect = () => sync();
    const onAccountChanged = () => sync();
    const onNetworkChanged = () => sync();
    const onError = (err: unknown) => {
      modalConnectingRef.current = false;
      syncConnecting();
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
      const attempt = beginConnectionAttempt();
      // StrictMode replays effects before microtasks run. Deferring here means
      // the throwaway setup is cancelled and only the live setup reconnects.
      queueMicrotask(() => {
        if (disposed) {
          finishConnectionAttempt(attempt);
          return;
        }
        void manager.reconnect().then(
          () => {
            if (disposed && manager.connected) void manager.disconnect().catch(() => undefined);
            finishConnectionAttempt(attempt);
          },
          (reconnectError: unknown) => {
            const expectedOverlap =
              isWalletError(reconnectError) &&
              reconnectError.code === WalletErrorCode.ALREADY_CONNECTED;
            finishConnectionAttempt(attempt, expectedOverlap ? undefined : reconnectError);
          }
        );
      });
    }

    return () => {
      disposed = true;
      mountedRef.current = false;
      cancelConnectionState();
      manager.off('connect', onConnect);
      manager.off('disconnect', onDisconnect);
      manager.off('accountChanged', onAccountChanged);
      manager.off('networkChanged', onNetworkChanged);
      manager.off('error', onError);
      connectorsRef.current.clear();
      void manager.disconnect().catch(() => undefined);
    };
  }, [
    manager,
    beginConnectionAttempt,
    finishConnectionAttempt,
    cancelConnectionState,
    syncConnecting,
  ]);

  const connect = useCallback(
    async (walletId: string, options?: ConnectOptions) => {
      const attempt = beginConnectionAttempt();
      let failure: unknown;
      try {
        const connectedAccount = await manager.connect(walletId, options);
        if (!mountedRef.current && manager.connected) {
          await manager.disconnect();
        }
        return connectedAccount;
      } catch (err) {
        failure = err;
        throw err;
      } finally {
        finishConnectionAttempt(attempt, failure);
      }
    },
    [manager, beginConnectionAttempt, finishConnectionAttempt]
  );

  const disconnect = useCallback(async () => {
    cancelConnectionState();
    await manager.disconnect();
  }, [manager, cancelConnectionState]);

  const registerConnector = useCallback((el: WalletConnectorElement) => {
    connectorsRef.current.add(el);
  }, []);
  const unregisterConnector = useCallback((el: WalletConnectorElement) => {
    connectorsRef.current.delete(el);
  }, []);
  const reportModalConnecting = useCallback(() => {
    modalConnectingRef.current = true;
    if (mountedRef.current) setError(null);
    syncConnecting();
  }, [syncConnecting]);
  const reportModalError = useCallback(
    (modalError: WalletError) => {
      modalConnectingRef.current = false;
      if (mountedRef.current) setError(modalError);
      syncConnecting();
    },
    [syncConnecting]
  );

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
