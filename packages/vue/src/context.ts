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
import { WalletManager, isWalletError } from '@xrpl-connect/core';
import type {
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  WalletError,
  WalletManagerOptions,
} from '@xrpl-connect/core';

export interface WalletConnectorElement extends HTMLElement {
  setWalletManager(manager: WalletManager): void;
  open(): void;
  close(): void;
}

export interface XrplConnectContextValue {
  manager: WalletManager;
  connected: Readonly<Ref<boolean>>;
  account: Readonly<Ref<AccountInfo | null>>;
  network: Readonly<Ref<NetworkInfo | null>>;
  connecting: Readonly<Ref<boolean>>;
  error: Readonly<Ref<WalletError | null>>;
  connect(walletId: string, options?: ConnectOptions): Promise<AccountInfo>;
  disconnect(): Promise<void>;
}

export type XrplConnectConfig = WalletManagerOptions;

interface InternalContext extends XrplConnectContextValue {
  registerConnector(element: WalletConnectorElement): void;
  unregisterConnector(element: WalletConnectorElement): void;
  reportModalConnecting(): void;
  reportModalError(error: WalletError): void;
  openModal(): void;
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
      const connectors = new Set<WalletConnectorElement>();
      let active = true;

      const sync = () => {
        connected.value = manager.connected;
        account.value = manager.account;
        network.value = manager.account?.network ?? null;
      };
      const onConnect = () => {
        error.value = null;
        connecting.value = false;
        sync();
      };
      const onDisconnect = () => sync();
      const onAccountChanged = () => sync();
      const onNetworkChanged = () => sync();
      const onError = (value: unknown) => {
        connecting.value = false;
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
        async connect(walletId, options) {
          connecting.value = true;
          error.value = null;
          try {
            const connectedAccount = await manager.connect(walletId, options);
            if (!active && manager.connected) await manager.disconnect();
            return connectedAccount;
          } catch (value) {
            if (active) {
              connecting.value = false;
              if (isWalletError(value)) error.value = value;
            }
            throw value;
          }
        },
        disconnect: () => manager.disconnect(),
        registerConnector: (element) => connectors.add(element),
        unregisterConnector: (element) => connectors.delete(element),
        reportModalConnecting() {
          connecting.value = true;
          error.value = null;
        },
        reportModalError(value) {
          connecting.value = false;
          error.value = value;
        },
        openModal() {
          const mountedConnectors = [...connectors];
          mountedConnectors[mountedConnectors.length - 1]?.open();
        },
        closeModal() {
          const mountedConnectors = [...connectors];
          mountedConnectors[mountedConnectors.length - 1]?.close();
        },
      };

      app.provide(XrplConnectKey, context);

      let reconnectDisposed = false;
      if (config.autoConnect && typeof window !== 'undefined') {
        queueMicrotask(() => {
          if (reconnectDisposed) return;
          void manager.reconnect().then(
            () => {
              if (!active && manager.connected) void manager.disconnect().catch(() => undefined);
            },
            (value: unknown) => {
              if (active && isWalletError(value)) error.value = value;
            }
          );
        });
      }

      app.onUnmount(() => {
        active = false;
        reconnectDisposed = true;
        manager.off('connect', onConnect);
        manager.off('disconnect', onDisconnect);
        manager.off('accountChanged', onAccountChanged);
        manager.off('networkChanged', onNetworkChanged);
        manager.off('error', onError);
        connectors.clear();
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
