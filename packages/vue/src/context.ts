import {
  inject,
  markRaw,
  readonly,
  shallowRef,
  type App,
  type InjectionKey,
  type Plugin,
  type Ref,
} from 'vue';
import { WalletErrorCode, WalletManager, isWalletError } from '@xrpl-connect/core';
import type {
  AccountInfo,
  ConnectOptionsFor,
  NetworkInfo,
  WalletError,
  WalletManagerOptions,
  WalletIdentifier,
} from '@xrpl-connect/core';

export interface WalletConnectorElement extends HTMLElement {
  setWalletManager(manager: WalletManager): void;
  open(): Promise<void>;
  openAndWait(): Promise<AccountInfo>;
  close(): void;
  toggle(): void;
}

export interface XrplConnectContextValue {
  manager: WalletManager;
  connected: Readonly<Ref<boolean>>;
  account: Readonly<Ref<AccountInfo | null>>;
  network: Readonly<Ref<NetworkInfo | null>>;
  connecting: Readonly<Ref<boolean>>;
  error: Readonly<Ref<WalletError | null>>;
  connect<const Wallet extends WalletIdentifier>(
    walletId: Wallet,
    options?: ConnectOptionsFor<Wallet>
  ): Promise<AccountInfo>;
  disconnect(): Promise<void>;
}

export type XrplConnectConfig = WalletManagerOptions;

interface InternalContext extends XrplConnectContextValue {
  ready: Readonly<Ref<boolean>>;
  registerConnector(element: WalletConnectorElement): void;
  unregisterConnector(element: WalletConnectorElement): void;
  reportModalConnecting(): void;
  reportModalError(error: WalletError): void;
  openModal(): Promise<void>;
  openAndWaitModal(): Promise<AccountInfo>;
  closeModal(): void;
}

const XrplConnectKey: InjectionKey<InternalContext> = Symbol('XrplConnect');

export function createXrplConnect(config: XrplConnectConfig): Plugin {
  return {
    install(app: App) {
      const manager = markRaw(new WalletManager({ ...config, autoConnect: false }));
      const connected = shallowRef(manager.connected);
      const account = shallowRef(manager.account);
      const network = shallowRef(manager.account?.network ?? null);
      const connecting = shallowRef(false);
      const error = shallowRef<WalletError | null>(null);
      const ready = shallowRef(false);
      const connectors = new Set<WalletConnectorElement>();
      const connectionAttempts = new Set<symbol>();
      let modalConnecting = false;
      let active = true;

      const syncConnecting = () => {
        connecting.value = connectionAttempts.size > 0 || modalConnecting;
      };
      const beginConnectionAttempt = () => {
        const attempt = Symbol('connectionAttempt');
        connectionAttempts.add(attempt);
        error.value = null;
        syncConnecting();
        return attempt;
      };
      const finishConnectionAttempt = (attempt: symbol, value?: unknown) => {
        if (!connectionAttempts.delete(attempt)) return;
        if (value !== undefined && isWalletError(value) && !manager.connected) error.value = value;
        syncConnecting();
      };
      const cancelConnectionState = () => {
        connectionAttempts.clear();
        modalConnecting = false;
        error.value = null;
        syncConnecting();
      };

      const sync = () => {
        connected.value = manager.connected;
        account.value = manager.account;
        network.value = manager.account?.network ?? null;
      };
      const getActiveConnector = (): WalletConnectorElement => {
        const mountedConnectors = [...connectors];
        const connector = mountedConnectors[mountedConnectors.length - 1];
        if (connector) return connector;
        throw new Error(
          'xrpl-connect/vue: no <WalletConnector> is registered. Mount <WalletConnector> before calling useWalletModal().'
        );
      };
      const runWithActiveConnector = <T>(
        operation: (connector: WalletConnectorElement) => Promise<T>
      ): Promise<T> => {
        try {
          return Promise.resolve(operation(getActiveConnector()));
        } catch (value) {
          return Promise.reject(value);
        }
      };
      const onConnect = () => {
        error.value = null;
        modalConnecting = false;
        syncConnecting();
        sync();
      };
      const onDisconnect = () => sync();
      const onAccountChanged = () => sync();
      const onNetworkChanged = () => sync();
      const onError = (value: unknown) => {
        modalConnecting = false;
        syncConnecting();
        if (isWalletError(value)) error.value = value;
      };

      manager.on('connect', onConnect);
      manager.on('disconnect', onDisconnect);
      manager.on('accountChanged', onAccountChanged);
      manager.on('networkChanged', onNetworkChanged);
      manager.on('error', onError);
      sync();

      const context: InternalContext = {
        manager,
        connected: readonly(connected),
        account: readonly(account),
        network: readonly(network),
        connecting: readonly(connecting),
        error: readonly(error),
        ready: readonly(ready),
        async connect<const Wallet extends WalletIdentifier>(
          walletId: Wallet,
          options?: ConnectOptionsFor<Wallet>
        ) {
          const attempt = beginConnectionAttempt();
          let failure: unknown;
          try {
            const connectedAccount = await manager.connect(walletId, options);
            if (!active && manager.connected) await manager.disconnect();
            return connectedAccount;
          } catch (value) {
            failure = value;
            throw value;
          } finally {
            if (active) finishConnectionAttempt(attempt, failure);
          }
        },
        async disconnect() {
          cancelConnectionState();
          await manager.disconnect();
        },
        registerConnector(element) {
          connectors.add(element);
          ready.value = true;
        },
        unregisterConnector(element) {
          connectors.delete(element);
          ready.value = connectors.size > 0;
        },
        reportModalConnecting() {
          modalConnecting = true;
          error.value = null;
          syncConnecting();
        },
        reportModalError(value) {
          modalConnecting = false;
          error.value = value;
          syncConnecting();
        },
        openModal() {
          return runWithActiveConnector((connector) => connector.open());
        },
        openAndWaitModal() {
          return runWithActiveConnector((connector) => connector.openAndWait());
        },
        closeModal() {
          const mountedConnectors = [...connectors];
          mountedConnectors[mountedConnectors.length - 1]?.close();
        },
      };

      app.provide(XrplConnectKey, context);

      let reconnectDisposed = false;
      if (config.autoConnect && typeof window !== 'undefined') {
        const attempt = beginConnectionAttempt();
        queueMicrotask(() => {
          if (reconnectDisposed) {
            finishConnectionAttempt(attempt);
            return;
          }
          void manager.reconnect().then(
            () => {
              if (!active && manager.connected) void manager.disconnect().catch(() => undefined);
              if (active) finishConnectionAttempt(attempt);
            },
            (value: unknown) => {
              const expectedOverlap =
                isWalletError(value) && value.code === WalletErrorCode.ALREADY_CONNECTED;
              if (active) finishConnectionAttempt(attempt, expectedOverlap ? undefined : value);
            }
          );
        });
      }

      app.onUnmount(() => {
        active = false;
        reconnectDisposed = true;
        cancelConnectionState();
        manager.off('connect', onConnect);
        manager.off('disconnect', onDisconnect);
        manager.off('accountChanged', onAccountChanged);
        manager.off('networkChanged', onNetworkChanged);
        manager.off('error', onError);
        connectors.clear();
        ready.value = false;
        void manager.disconnect().catch(() => undefined);
      });
    },
  };
}

export function useXrplConnectContext(): InternalContext {
  const context = inject(XrplConnectKey, null);
  if (!context) {
    throw new Error(
      'xrpl-connect/vue: composables and <WalletConnector> require app.use(createXrplConnect(config)).'
    );
  }
  return context;
}
