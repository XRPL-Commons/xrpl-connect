/**
 * Internal types for the UI package.
 *
 * Defines a typed surface for the host web component (`WalletConnectorContext`)
 * so services can depend on a stable interface instead of casting through `any`,
 * plus capability interfaces for optional adapter methods (`preInitialize`,
 * `getDeepLinkURI`, `checkXamanState`, `getAccounts`) that aren't part of the
 * base `WalletAdapter` contract.
 */

import type { AccountInfo, NetworkConfig, WalletAdapter, WalletManager } from '@xrpl-connect/core';

/**
 * A single derived account returned by Ledger's `getAccounts`.
 */
export interface LedgerAccount {
  address: string;
  publicKey: string;
  path: string;
  index: number;
}

/**
 * Ledger-specific connect options (passed through `ConnectOptions`).
 *
 * Carries an index signature so it satisfies the `Record<string, unknown>`
 * constraint on `ConnectOptions`'s generic parameter.
 */
export type LedgerConnectOptions = {
  accountIndex?: number;
  derivationPath?: string;
  [key: string]: unknown;
};

/**
 * WalletConnect-specific connect options.
 */
export type WalletConnectConnectOptions = {
  onQRCode?: (uri: string) => void;
  [key: string]: unknown;
};

export interface QRCodeData {
  walletId: string;
  uri: string;
}

export interface LoadingData {
  walletId: string;
  walletName: string;
  walletIcon?: string;
}

export interface ErrorData {
  walletId: string;
  walletName: string;
  error: Error;
}

export interface AccountSelectionData {
  walletId: string;
  walletName: string;
  walletIcon?: string;
  accounts: LedgerAccount[];
}

/**
 * Public surface of the host `WalletConnector` web component that services
 * (EventHandler, WalletService) depend on.
 *
 * The host class implements this interface, which lets services consume the
 * component through a typed contract instead of `(component as any)` casts.
 */
export interface WalletConnectorContext extends HTMLElement {
  readonly walletManager: WalletManager | null;
  readonly shadow: ShadowRoot;
  readonly qrCodeData: QRCodeData | null;
  readonly errorData: ErrorData | null;
  readonly accountSelectionData: AccountSelectionData | null;

  open(): Promise<void> | void;
  close(): void;
  openAccountModal(): void;
  closeAccountModal(): void;
  disconnectFromAccountModal(): Promise<void> | void;

  showQRCodeView(walletId: string, uri?: string): void;
  showLoadingView(walletId: string, walletName: string, walletIcon?: string): void;
  showErrorView(walletId: string, walletName: string, error: Error): void;
  showWalletList(): void;
  showAccountSelectionView(
    walletId: string,
    walletName: string,
    walletIcon: string | undefined,
    accounts: LedgerAccount[]
  ): void;
  setQRCode(walletId: string, uri: string): void;

  getOverlayRoot(): ShadowRoot | null;
  getAccountModalRoot(): ShadowRoot | null;
}

/**
 * Options the UI inspects on a WalletConnect-style adapter. These mirror the
 * adapter's own option shape but are kept loose (all-optional) because the UI
 * only reads/writes a subset.
 */
export interface WalletConnectAdapterLikeOptions {
  projectId?: string;
  onQRCode?: (uri: string) => void;
  useModal?: boolean;
  modalMode?: 'mobile-only' | 'always' | 'never';
}

/**
 * Adapter capability: WalletConnect-style eager initialization with QR pre-gen.
 */
export interface PreInitializableAdapter {
  preInitialize(projectId?: string, network?: NetworkConfig): Promise<void>;
  options?: WalletConnectAdapterLikeOptions;
  getDeepLinkURI(uri: string): string;
}

/**
 * Adapter capability: Xaman-style session state probe used for silent reconnect.
 */
export interface XamanStateAdapter {
  checkXamanState(): Promise<AccountInfo | null>;
}

/**
 * Adapter capability: Ledger-style multi-account enumeration.
 */
export interface MultiAccountAdapter {
  getAccounts(count: number, startIndex: number): Promise<LedgerAccount[]>;
}

/**
 * Adapter capability: produces a deep-link URI from a connection URI (mobile).
 */
export interface DeepLinkAdapter {
  getDeepLinkURI(uri: string): string;
}

/**
 * Adapter capability: exposes a WalletConnect-style options bag whose
 * `useModal` / `modalMode` flags drive UI behavior.
 */
export interface ModalConfigurableAdapter {
  options?: WalletConnectAdapterLikeOptions;
}

export function isPreInitializableAdapter(
  adapter: WalletAdapter
): adapter is WalletAdapter & PreInitializableAdapter {
  const candidate = adapter as Partial<PreInitializableAdapter>;
  return (
    typeof candidate.preInitialize === 'function' && typeof candidate.getDeepLinkURI === 'function'
  );
}

export function isDeepLinkAdapter(
  adapter: WalletAdapter
): adapter is WalletAdapter & DeepLinkAdapter {
  return typeof (adapter as Partial<DeepLinkAdapter>).getDeepLinkURI === 'function';
}

export function isXamanStateAdapter(
  adapter: WalletAdapter
): adapter is WalletAdapter & XamanStateAdapter {
  return typeof (adapter as Partial<XamanStateAdapter>).checkXamanState === 'function';
}

export function isMultiAccountAdapter(
  adapter: WalletAdapter
): adapter is WalletAdapter & MultiAccountAdapter {
  return typeof (adapter as Partial<MultiAccountAdapter>).getAccounts === 'function';
}

export function isModalConfigurableAdapter(
  adapter: WalletAdapter
): adapter is WalletAdapter & ModalConfigurableAdapter {
  return 'options' in adapter;
}
