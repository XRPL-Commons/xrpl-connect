import type {
  WalletManager,
  WalletManagerOptions,
  AccountInfo,
  NetworkInfo,
  WalletError,
  ConnectOptions,
} from '@xrpl-connect/core';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Configuration for {@link XrplConnectProvider}. Identical to the core
 * `WalletManagerOptions` (adapters, network, autoConnect, storage, logger) — you
 * define your adapters and API keys here, once.
 */
export type XrplConnectConfig = WalletManagerOptions;

/**
 * Reactive wallet state plus actions exposed through the provider context.
 */
export interface XrplConnectContextValue {
  /** The single, stable WalletManager instance for this provider subtree. */
  manager: WalletManager;
  connected: boolean;
  account: AccountInfo | null;
  network: NetworkInfo | null;
  /** True while a `connect()` call (or the modal flow) is in progress. */
  connecting: boolean;
  /** The most recent connection/adapter error, as a typed `WalletError`. */
  error: WalletError | null;
  connect: (walletId: string, options?: ConnectOptions) => Promise<AccountInfo>;
  disconnect: () => Promise<void>;
  /** @internal — used by `<WalletConnector>` to register its element. */
  registerConnector: (el: WalletConnectorElement) => void;
  /** @internal — removes only the connector that is being unmounted. */
  unregisterConnector: (el: WalletConnectorElement) => void;
  /** @internal — mirrors modal lifecycle events into provider state. */
  reportModalConnecting: () => void;
  /** @internal — mirrors typed modal failures into provider state. */
  reportModalError: (error: WalletError) => void;
  openModal: () => void;
  closeModal: () => void;
}

/**
 * Minimal typed surface of the `<xrpl-wallet-connector>` custom element that the
 * React layer drives.
 */
export interface WalletConnectorElement extends HTMLElement {
  setWalletManager(manager: WalletManager): void;
  open(): void;
  close(): void;
}

export interface XrplConnectProviderProps {
  config: XrplConnectConfig;
  children: ReactNode;
}

/** Built-in theme presets applied as `--xc-*` custom properties. */
export type WalletConnectorTheme = 'dark' | 'light' | 'purple';

export interface WalletConnectorProps {
  /** Pre-select a wallet in the modal (maps to the `primary-wallet` attribute). */
  primaryWallet?: string;
  /** Restrict/order the wallet list (maps to the `wallets` attribute). */
  wallets?: string[];
  /** Built-in theme preset. Overridden per-token by `cssVars`. */
  theme?: WalletConnectorTheme;
  /** Arbitrary `--xc-*` custom properties to override modal styling. */
  cssVars?: Record<`--xc-${string}`, string>;
  /** Extra inline styles forwarded to the host element. */
  style?: CSSProperties;
  className?: string;
  /** Fired (with the wallet id) when a connection attempt starts. */
  onConnecting?: (walletId: string) => void;
  /** Fired with the connected account once the wallet approves. */
  onConnect?: (account: AccountInfo) => void;
  /** Fired with a typed `WalletError` (`error.code`, `error.category`) on failure. */
  onError?: (error: WalletError) => void;
}
