/**
 * Core types and interfaces for xrpl-connect
 */

import type { SubmittableTransaction as XRPLTransaction } from 'xrpl';

/**
 * Network information
 */
export interface NetworkInfo {
  id: string; // 'mainnet', 'testnet', 'devnet', or custom id
  name: string; // Display name
  wss: string; // WebSocket endpoint
  rpc?: string; // HTTP RPC endpoint (optional)
  walletConnectId?: string; // For WalletConnect (e.g., 'xrpl:0')
}

/**
 * Standard XRPL networks
 */
export type StandardNetworkId = 'mainnet' | 'testnet' | 'devnet';

export const STANDARD_NETWORKS: Record<StandardNetworkId, NetworkInfo> = {
  mainnet: {
    id: 'mainnet',
    name: 'Mainnet',
    wss: 'wss://xrplcluster.com',
    rpc: 'https://xrplcluster.com',
    walletConnectId: 'xrpl:0',
  },
  testnet: {
    id: 'testnet',
    name: 'Testnet',
    wss: 'wss://s.altnet.rippletest.net:51233/',
    rpc: 'https://testnet.xrpl-labs.com',
    walletConnectId: 'xrpl:1',
  },
  devnet: {
    id: 'devnet',
    name: 'Devnet',
    wss: 'wss://s.devnet.rippletest.net:51233/',
    rpc: 'https://s.devnet.rippletest.net:51234/',
    walletConnectId: 'xrpl:2',
  },
};

/**
 * Network configuration type - can be a standard network key or custom NetworkInfo
 */
export type NetworkConfig = StandardNetworkId | NetworkInfo;

export function isStandardNetworkId(networkId: string): networkId is StandardNetworkId {
  return Object.prototype.hasOwnProperty.call(STANDARD_NETWORKS, networkId);
}

/**
 * Account information returned after connection
 */
export interface AccountInfo {
  address: string; // XRPL address (r...)
  publicKey?: string; // Public key (optional)
  network: NetworkInfo; // Network the account is connected to
}

/**
 * Transaction type (extends XRPL transaction)
 */
export type Transaction = XRPLTransaction;

/**
 * Result of signing a transaction
 */
export interface SignedTransaction {
  hash: string; // Transaction hash
  tx_blob?: string; // Signed transaction blob
  signature?: string; // Signature
  signerAddress?: string; // Address of the account that produced the signature
  tx_json?: Transaction; // Complete signed transaction JSON
  [key: string]: unknown; // Allow additional wallet-specific fields
}

/**
 * Result of signing a message
 */
export interface SignedMessage {
  message: string; // Original message
  signature: string; // Signature
  publicKey: string; // Public key used for signing
  signerAddress?: string; // Address of the account that produced the signature
}

/** Transaction signature returned by WalletManager with a known signer. */
export type ManagedSignedTransaction = SignedTransaction & { signerAddress: string };

/** Message signature returned by WalletManager with a known signer. */
export type ManagedSignedMessage = SignedMessage & { signerAddress: string };

/**
 * Result of submitting a transaction to the ledger
 */
export interface SubmittedTransaction {
  hash: string; // Transaction hash
  id?: string; // Request/submission ID (wallet-specific)
  tx_blob?: string; // Signed transaction blob
  signature?: string; // Signature
  tx_json?: Transaction; // Complete signed transaction JSON
  [key: string]: unknown; // Allow additional wallet-specific fields
}

/**
 * Options for connecting to a wallet
 */
// oxlint-disable-next-line typescript/no-empty-object-type
export type ConnectOptions<WalletSpecificOptions extends Record<string, unknown> = {}> = {
  network?: NetworkConfig; // Preferred network
  autoReconnect?: boolean; // Auto-reconnect on page load
  /**
   * Ask the adapter to return the address without prompting for permission when
   * it already has access (mirrors SEP-43 `skipRequestAccess`). Adapters that
   * can't distinguish silent access may ignore this.
   */
  skipRequestAccess?: boolean;
} & WalletSpecificOptions;

/**
 * Adapter-owned, JSON-safe options required to restore a wallet account.
 * Core-owned connection policy must not be overridden by persisted adapter data.
 */
export type ReconnectOptions = Record<string, unknown> & {
  network?: never;
  autoReconnect?: never;
};

/**
 * Events that adapters can emit
 */
export type WalletAdapterEvent =
  | 'connect'
  | 'disconnect'
  | 'accountChanged'
  | 'networkChanged'
  | 'error';

/**
 * Declarative feature support for an adapter. Lets consumers and the manager
 * know ahead of time which optional operations a wallet can actually perform,
 * instead of discovering it only when a call fails at runtime.
 *
 * Every flag is optional; an omitted flag falls back to {@link CAPABILITY_DEFAULTS}
 * (the three signing operations default to `true` for backwards compatibility,
 * so existing adapters keep working without declaring anything).
 */
export interface WalletCapabilities {
  /** Can sign a transaction without submitting it (`sign`). Default: `true`. */
  sign?: boolean;
  /** Can sign and submit a transaction (`signAndSubmit`). Default: `true`. */
  signAndSubmit?: boolean;
  /** Can sign an arbitrary message (`signMessage`). Default: `true`. */
  signMessage?: boolean;
}

/**
 * Default value for each capability when an adapter doesn't declare it.
 */
export const CAPABILITY_DEFAULTS: Readonly<Required<WalletCapabilities>> = Object.freeze({
  sign: true,
  signAndSubmit: true,
  signMessage: true,
});

/**
 * Resolve whether an adapter supports a capability, applying
 * {@link CAPABILITY_DEFAULTS} when the adapter doesn't declare it.
 */
export function adapterSupports(
  adapter: WalletAdapter,
  capability: keyof WalletCapabilities
): boolean {
  return adapter.capabilities?.[capability] ?? CAPABILITY_DEFAULTS[capability];
}

/**
 * Core interface that all wallet adapters must implement
 */
export interface WalletAdapter {
  // Metadata
  readonly id: string; // 'xaman', 'crossmark', 'walletconnect', 'gemwallet'
  readonly name: string; // 'Xaman Wallet', 'Crossmark', etc.
  readonly icon?: string; // URL or base64 icon
  readonly url?: string; // Wallet website/download URL

  /**
   * Declared feature support. Optional — omitted flags use
   * {@link CAPABILITY_DEFAULTS}. Declare a capability as `false` for operations
   * the wallet can't perform (e.g. Xaman/WalletConnect message signing).
   */
  readonly capabilities?: WalletCapabilities;

  // Optional, minimal reconnect-state serialization (never called by adapters
  // that do not opt in).
  serializeReconnectOptions?(options: ConnectOptions): ReconnectOptions | undefined;

  // Availability
  isAvailable(): Promise<boolean>; // Check if wallet is installed/accessible

  // Connection lifecycle
  connect(options?: ConnectOptions): Promise<AccountInfo>;
  disconnect(): Promise<void>;

  // Account information
  getAccount(): Promise<AccountInfo | null>; // Return the adapter's cached account
  getNetwork(): Promise<NetworkInfo>;

  // Signing and submission operations
  sign(transaction: Transaction): Promise<SignedTransaction>;
  signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction>;
  signMessage(message: string | Uint8Array): Promise<SignedMessage>;

  // Events (optional, for wallets that support event listening)
  on?(event: WalletAdapterEvent, callback: (data: unknown) => void): void;
  off?(event: WalletAdapterEvent, callback: (data: unknown) => void): void;
}

/**
 * Capability: adapter can pre-initialize its connection session before the
 * user picks the wallet, so the QR code / handshake is ready by the time the
 * UI opens its panel. Implemented by WalletConnect.
 */
export interface SupportsPreInitialize {
  preInitialize(network?: NetworkConfig, onQRCode?: (uri: string) => void): Promise<void>;
}

/**
 * Capability: adapter can transform a generic connection URI into a
 * wallet-specific deep link (e.g. mobile app handoff).
 */
export interface SupportsDeepLink {
  getDeepLinkURI(uri: string): string;
}

/**
 * Capability: adapter can query its wallet, provider, or device for the current
 * authorized account without opening a new connection flow.
 */
export interface SupportsFetchAccount {
  fetchAccount(): Promise<AccountInfo | null>;
}

/**
 * Capability: adapter can select the small, JSON-safe subset of connection
 * options required to restore the same wallet account after a reload.
 */
export interface SupportsReconnectOptions {
  serializeReconnectOptions(options: ConnectOptions): ReconnectOptions | undefined;
}

export function supportsPreInitialize(
  adapter: WalletAdapter
): adapter is WalletAdapter & SupportsPreInitialize {
  return typeof (adapter as Partial<SupportsPreInitialize>).preInitialize === 'function';
}

export function supportsDeepLink(
  adapter: WalletAdapter
): adapter is WalletAdapter & SupportsDeepLink {
  return typeof (adapter as Partial<SupportsDeepLink>).getDeepLinkURI === 'function';
}

export function supportsFetchAccount(
  adapter: WalletAdapter
): adapter is WalletAdapter & SupportsFetchAccount {
  return typeof (adapter as Partial<SupportsFetchAccount>).fetchAccount === 'function';
}

export function supportsReconnectOptions(
  adapter: WalletAdapter
): adapter is WalletAdapter & SupportsReconnectOptions {
  return (
    typeof (adapter as Partial<SupportsReconnectOptions>).serializeReconnectOptions === 'function'
  );
}

/**
 * Events emitted by WalletManager
 */
export type WalletEvent = 'connect' | 'disconnect' | 'accountChanged' | 'networkChanged' | 'error';

/**
 * Wallet manager configuration options
 */
export interface WalletManagerOptions {
  adapters: WalletAdapter[]; // Available wallet adapters
  network?: NetworkConfig; // Default network
  autoConnect?: boolean; // Auto-reconnect on initialization
  storage?: StorageAdapter; // Custom storage (default: localStorage)
  logger?: LoggerOptions | LoggerInstance; // Logging configuration (level options or a custom logger instance)
}

/**
 * Storage adapter interface for persisting connection state
 */
export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Stored connection state
 */
export interface StoredState {
  walletId: string;
  account: AccountInfo;
  network: NetworkInfo;
  timestamp: number;
  /**
   * Adapter-selected, JSON-safe options required to restore the same account.
   * Arbitrary caller-provided connection options are never stored.
   */
  connectOptions?: ReconnectOptions;
}

/**
 * Supported log levels.
 * `'silent'` disables all output; `'none'` is a deprecated alias kept for backwards compatibility.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent' | 'none';

/**
 * Logger configuration options
 * Level is optional - defaults to 'debug' in development, 'warn' in production
 */
export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
}

/**
 * A custom logger object the application can supply to route log output
 * (e.g. into Sentry, Datadog, or any structured logging stack).
 *
 * Method signatures match `console.debug/info/warn/error`.
 */
export interface LoggerInstance {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Error codes for wallet operations
 */
export enum WalletErrorCode {
  // Connection errors
  WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
  WALLET_NOT_INSTALLED = 'WALLET_NOT_INSTALLED',
  WALLET_NOT_AVAILABLE = 'WALLET_NOT_AVAILABLE',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_REJECTED = 'CONNECTION_REJECTED',

  // Signing errors
  SIGN_FAILED = 'SIGN_FAILED',
  SIGN_REJECTED = 'SIGN_REJECTED',

  // Network errors
  NETWORK_NOT_SUPPORTED = 'NETWORK_NOT_SUPPORTED',
  NETWORK_MISMATCH = 'NETWORK_MISMATCH',

  // State errors
  NOT_CONNECTED = 'NOT_CONNECTED',
  ALREADY_CONNECTED = 'ALREADY_CONNECTED',

  // Method errors
  UNSUPPORTED_METHOD = 'UNSUPPORTED_METHOD',

  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * High-level categories for wallet errors.
 *
 * Each `WalletErrorCode` belongs to exactly one category, letting consumer apps
 * branch UX on the *kind* of failure without enumerating every code:
 *
 * - `USER_ACTION` — user explicitly rejected or cancelled. Usually no error toast.
 * - `WALLET_UNAVAILABLE` — provider missing, locked, or on the wrong network.
 *   Surface install / unlock / switch-network instructions.
 * - `NETWORK` — RPC or transport failure. Retry-friendly.
 * - `INVALID_INPUT` — programmer error (bad call, missing state). Bubble up.
 * - `INTERNAL` — unexpected failure that should be reported.
 */
export enum WalletErrorCategory {
  USER_ACTION = 'USER_ACTION',
  WALLET_UNAVAILABLE = 'WALLET_UNAVAILABLE',
  NETWORK = 'NETWORK',
  INVALID_INPUT = 'INVALID_INPUT',
  INTERNAL = 'INTERNAL',
}
