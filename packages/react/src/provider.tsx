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
import type { AccountInfo, NetworkInfo, WalletError } from '@xrpl-connect/core';
import type { ConnectOptionsFor, WalletIdentifier } from 'xrpl-connect';
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
  const modalConnectionAttemptsRef = useRef<Set<symbol>>(new Set());

  const [connected, setConnected] = useState<boolean>(manager.connected);
  const [account, setAccount] = useState<AccountInfo | null>(manager.account);
  const [network, setNetwork] = useState<NetworkInfo | null>(manager.account?.network ?? null);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [error, setError] = useState<WalletError | null>(null);
  const [ready, setReady] = useState(false);

  const syncConnecting = useCallback(() => {
    if (mountedRef.current) {
      setConnecting(
        connectionAttemptsRef.current.size > 0 || modalConnectionAttemptsRef.current.size > 0
      );
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
    modalConnectionAttemptsRef.current.clear();
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
      modalConnectionAttemptsRef.current.clear();
      syncConnecting();
      sync();
    };
    const onDisconnect = () => sync();
    const onAccountChanged = () => sync();
    const onNetworkChanged = () => sync();
    const onError = (err: unknown) => {
      modalConnectionAttemptsRef.current.clear();
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
    async <const Wallet extends WalletIdentifier>(
      walletId: Wallet,
      options?: ConnectOptionsFor<Wallet>
    ) => {
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
    if (mountedRef.current) setReady(true);
  }, []);
  const unregisterConnector = useCallback((el: WalletConnectorElement) => {
    connectorsRef.current.delete(el);
    if (mountedRef.current) setReady(connectorsRef.current.size > 0);
  }, []);
  const reportModalConnecting = useCallback(() => {
    const attempt = Symbol('modalConnectionAttempt');
    modalConnectionAttemptsRef.current.add(attempt);
    if (mountedRef.current) setError(null);
    syncConnecting();
    return attempt;
  }, [syncConnecting]);
  const reportModalError = useCallback(
    (attempt: symbol | null, modalError: WalletError) => {
      if (attempt !== null && !modalConnectionAttemptsRef.current.delete(attempt)) return false;
      if (!mountedRef.current || manager.connected) {
        syncConnecting();
        return false;
      }
      setError(modalError);
      syncConnecting();
      return true;
    },
    [manager, syncConnecting]
  );
  const reportModalClosed = useCallback(
    (attempts: readonly symbol[]) => {
      for (const attempt of attempts) modalConnectionAttemptsRef.current.delete(attempt);
      syncConnecting();
    },
    [syncConnecting]
  );

  const getActiveConnector = useCallback((): WalletConnectorElement => {
    const connectors = [...connectorsRef.current];
    const connector = connectors.at(-1);
    if (connector) return connector;
    throw new Error(
      'xrpl-connect/react: no <WalletConnector> is registered. Mount <WalletConnector> before calling useWalletModal().'
    );
  }, []);
  const runWithActiveConnector = useCallback(
    <T,>(operation: (connector: WalletConnectorElement) => Promise<T>): Promise<T> => {
      try {
        return Promise.resolve(operation(getActiveConnector()));
      } catch (value) {
        return Promise.reject(value);
      }
    },
    [getActiveConnector]
  );
  const openModal = useCallback(
    () => runWithActiveConnector((connector) => connector.open()),
    [runWithActiveConnector]
  );
  const openAndWaitModal = useCallback(
    () => runWithActiveConnector((connector) => connector.openAndWait()),
    [runWithActiveConnector]
  );
  const closeModal = useCallback(() => {
    const connectors = [...connectorsRef.current];
    connectors.at(-1)?.close();
  }, []);

  const value = useMemo<XrplConnectContextValue>(
    () => ({
      manager,
      connected,
      account,
      network,
      connecting,
      error,
      ready,
      connect,
      disconnect,
      registerConnector,
      unregisterConnector,
      reportModalConnecting,
      reportModalError,
      reportModalClosed,
      openModal,
      openAndWaitModal,
      closeModal,
    }),
    [
      manager,
      connected,
      account,
      network,
      connecting,
      error,
      ready,
      connect,
      disconnect,
      registerConnector,
      unregisterConnector,
      reportModalConnecting,
      reportModalError,
      reportModalClosed,
      openModal,
      openAndWaitModal,
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
