/**
 * Core types and interfaces for xrpl-connect
 *
 * This module provides comprehensive type definitions for:
 * - Network configuration and management
 * - Account and transaction types
 * - Wallet adapter interface
 * - Error codes, categories, and severity levels
 * - Branded types for type-safe identifiers
 * - Result types for operation outcomes
 *
 * @module types
 */

import type { SubmittableTransaction as XRPLTransaction } from 'xrpl';

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Symbol for creating branded types
 * Used to create nominal types from structural types
 */
declare const __brand: unique symbol;

/**
 * Branded type utility for creating nominal types
 * This prevents accidental mixing of structurally similar types
 *
 * @example
 * ```typescript
 * type UserId = Branded<string, 'UserId'>;
 * type PostId = Branded<string, 'PostId'>;
 *
 * const userId: UserId = 'user123' as UserId;
 * const postId: PostId = userId; // Error: Type 'UserId' is not assignable to type 'PostId'
 * ```
 */
export type Branded<T, Brand extends string> = T & { readonly [__brand]: Brand };

/**
 * XRPL address (r-address format)
 * A branded string type for type-safe address handling
 *
 * @example
 * ```typescript
 * const address: XRPLAddress = 'rN7n3473SaZBCG4dFL83w7a1RXtXtbk2D9' as XRPLAddress;
 * ```
 */
export type XRPLAddress = Branded<string, 'XRPLAddress'>;

/**
 * Transaction hash (64-character hex string)
 * A branded string type for type-safe hash handling
 */
export type TransactionHash = Branded<string, 'TransactionHash'>;

/**
 * Cryptographic signature
 * A branded string type for signatures
 */
export type Signature = Branded<string, 'Signature'>;

/**
 * Public key (hex-encoded)
 * A branded string type for public keys
 */
export type PublicKey = Branded<string, 'PublicKey'>;

/**
 * Transaction blob (hex-encoded signed transaction)
 * A branded string type for transaction blobs
 */
export type TransactionBlob = Branded<string, 'TransactionBlob'>;

/**
 * Network identifier
 * A branded string type for network IDs
 */
export type NetworkId = Branded<string, 'NetworkId'>;

/**
 * Wallet adapter identifier
 * A branded string type for wallet adapter IDs
 */
export type WalletId = Branded<string, 'WalletId'>;

// ============================================================================
// Type Guards for Branded Types
// ============================================================================

/**
 * Validate and cast a string to XRPLAddress
 * XRPL addresses start with 'r' and are 25-35 characters
 */
export function isValidXRPLAddress(value: string): value is XRPLAddress {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(value);
}

/**
 * Validate and cast a string to TransactionHash
 * Transaction hashes are 64-character hex strings
 */
export function isValidTransactionHash(value: string): value is TransactionHash {
  return /^[A-F0-9]{64}$/i.test(value);
}

/**
 * Validate and cast a string to PublicKey
 * Public keys are 66-character hex strings (33 bytes)
 */
export function isValidPublicKey(value: string): value is PublicKey {
  return /^[A-F0-9]{66}$/i.test(value);
}

/**
 * Cast a string to XRPLAddress (use with validated data)
 */
export function asXRPLAddress(value: string): XRPLAddress {
  return value as XRPLAddress;
}

/**
 * Cast a string to TransactionHash (use with validated data)
 */
export function asTransactionHash(value: string): TransactionHash {
  return value as TransactionHash;
}

/**
 * Cast a string to PublicKey (use with validated data)
 */
export function asPublicKey(value: string): PublicKey {
  return value as PublicKey;
}

/**
 * Cast a string to NetworkId
 */
export function asNetworkId(value: string): NetworkId {
  return value as NetworkId;
}

/**
 * Cast a string to WalletId
 */
export function asWalletId(value: string): WalletId {
  return value as WalletId;
}

// ============================================================================
// Network Types
// ============================================================================

/**
 * Network information
 * Contains all configuration needed to connect to an XRPL network
 */
export interface NetworkInfo {
  /** Unique network identifier ('mainnet', 'testnet', 'devnet', or custom) */
  readonly id: string;
  /** Human-readable display name */
  readonly name: string;
  /** WebSocket endpoint URL */
  readonly wss: string;
  /** HTTP RPC endpoint URL (optional) */
  readonly rpc?: string;
  /** WalletConnect chain ID (e.g., 'xrpl:0' for mainnet) */
  readonly walletConnectId?: string;
}

/**
 * Standard XRPL networks pre-configured for common use
 */
export const STANDARD_NETWORKS: Readonly<Record<string, NetworkInfo>> = {
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
} as const;

/** Standard network keys */
export type StandardNetworkKey = keyof typeof STANDARD_NETWORKS;

/**
 * Network configuration type
 * Can be a standard network key or a custom NetworkInfo object
 */
export type NetworkConfig = StandardNetworkKey | NetworkInfo;

// ============================================================================
// Account Types
// ============================================================================

/**
 * Account information returned after connection
 * Contains the connected account's address and associated data
 */
export interface AccountInfo {
  /** XRPL address (r...) */
  readonly address: string;
  /** Account public key (optional, not all wallets expose this) */
  readonly publicKey?: string;
  /** Network the account is connected to */
  network: NetworkInfo;
}

/**
 * Strict account info with branded types
 * Use when type safety is critical
 */
export interface StrictAccountInfo {
  /** XRPL address (branded type) */
  readonly address: XRPLAddress;
  /** Account public key (branded type, optional) */
  readonly publicKey?: PublicKey;
  /** Network the account is connected to */
  network: NetworkInfo;
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Transaction type (extends XRPL SubmittableTransaction)
 * Represents any valid XRPL transaction
 */
export type Transaction = XRPLTransaction;

/**
 * Result of signing a transaction
 */
export interface SignedTransaction {
  /** Transaction hash */
  readonly hash: string;
  /** Signed transaction blob */
  readonly tx_blob?: string;
  /** Transaction signature */
  readonly signature?: string;
  /** Additional wallet-specific fields */
  readonly [key: string]: unknown;
}

/**
 * Strict signed transaction with branded types
 */
export interface StrictSignedTransaction {
  /** Transaction hash (branded type) */
  readonly hash: TransactionHash;
  /** Signed transaction blob (branded type) */
  readonly tx_blob?: TransactionBlob;
  /** Transaction signature (branded type) */
  readonly signature?: Signature;
}

/**
 * Result of signing a message
 */
export interface SignedMessage {
  /** Original message that was signed */
  readonly message: string;
  /** Cryptographic signature */
  readonly signature: string;
  /** Public key used for signing */
  readonly publicKey: string;
}

/**
 * Strict signed message with branded types
 */
export interface StrictSignedMessage {
  /** Original message that was signed */
  readonly message: string;
  /** Cryptographic signature (branded type) */
  readonly signature: Signature;
  /** Public key used for signing (branded type) */
  readonly publicKey: PublicKey;
}

/**
 * Result of submitting a transaction to the ledger
 */
export interface SubmittedTransaction {
  /** Transaction hash */
  readonly hash: string;
  /** Request/submission ID (wallet-specific) */
  readonly id?: string;
  /** Additional wallet-specific fields */
  readonly [key: string]: unknown;
}

/**
 * Strict submitted transaction with branded types
 */
export interface StrictSubmittedTransaction {
  /** Transaction hash (branded type) */
  readonly hash: TransactionHash;
  /** Request/submission ID */
  readonly id?: string;
}

// ============================================================================
// Result Types (Discriminated Unions)
// ============================================================================

/**
 * Base result type for all operations
 */
export interface BaseResult<T> {
  /** Whether the operation succeeded */
  readonly success: boolean;
  /** Result data (present on success) */
  readonly data?: T;
  /** Error information (present on failure) */
  readonly error?: {
    readonly code: WalletErrorCode;
    readonly message: string;
    readonly recoveryHint?: string;
  };
}

/**
 * Success result
 */
export interface SuccessResult<T> {
  readonly success: true;
  readonly data: T;
  readonly error?: never;
}

/**
 * Failure result
 */
export interface FailureResult {
  readonly success: false;
  readonly data?: never;
  readonly error: {
    readonly code: WalletErrorCode;
    readonly message: string;
    readonly recoveryHint?: string;
  };
}

/**
 * Operation result type (discriminated union)
 * Use this for operations that can fail in expected ways
 *
 * @example
 * ```typescript
 * async function connectSafe(): Promise<OperationResult<AccountInfo>> {
 *   try {
 *     const account = await walletManager.connect('xaman');
 *     return { success: true, data: account };
 *   } catch (error) {
 *     if (isWalletError(error)) {
 *       return {
 *         success: false,
 *         error: { code: error.code, message: error.message, recoveryHint: error.recoveryHint }
 *       };
 *     }
 *     return {
 *       success: false,
 *       error: { code: WalletErrorCode.UNKNOWN_ERROR, message: String(error) }
 *     };
 *   }
 * }
 * ```
 */
export type OperationResult<T> = SuccessResult<T> | FailureResult;

/**
 * Create a success result
 */
export function success<T>(data: T): SuccessResult<T> {
  return { success: true, data };
}

/**
 * Create a failure result
 */
export function failure(
  code: WalletErrorCode,
  message: string,
  recoveryHint?: string
): FailureResult {
  return { success: false, error: { code, message, recoveryHint } };
}

// ============================================================================
// Connection Types
// ============================================================================

/**
 * Base options for connecting to a wallet
 */
export interface BaseConnectOptions {
  /** Preferred network to connect to */
  network?: NetworkConfig;
  /** Whether to auto-reconnect on page load */
  autoReconnect?: boolean;
  /** Allow additional wallet-specific options */
  [key: string]: unknown;
}

/**
 * Options for connecting to a wallet
 * Extends BaseConnectOptions with wallet-specific options
 */
export type ConnectOptions<WalletSpecificOptions extends Record<string, unknown> = Record<string, unknown>> =
  BaseConnectOptions & WalletSpecificOptions;

// ============================================================================
// Event Types
// ============================================================================

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
 * Event data types for each event
 */
export interface WalletEventData {
  connect: AccountInfo;
  disconnect: void;
  accountChanged: AccountInfo;
  networkChanged: NetworkInfo;
  error: Error;
}

/**
 * Typed event handler
 */
export type WalletEventHandler<E extends WalletAdapterEvent> = (
  data: WalletEventData[E]
) => void;

/**
 * Events emitted by WalletManager
 */
export type WalletEvent = 'connect' | 'disconnect' | 'accountChanged' | 'networkChanged' | 'error';

// ============================================================================
// Wallet Adapter Interface
// ============================================================================

/**
 * Core interface that all wallet adapters must implement
 *
 * @example
 * ```typescript
 * class MyWalletAdapter implements WalletAdapter {
 *   readonly id = 'mywallet';
 *   readonly name = 'My Wallet';
 *   readonly icon = 'data:image/svg+xml;base64,...';
 *   readonly url = 'https://mywallet.com';
 *
 *   async isAvailable(): Promise<boolean> {
 *     return typeof window !== 'undefined' && 'myWallet' in window;
 *   }
 *
 *   async connect(options?: ConnectOptions): Promise<AccountInfo> {
 *     // ... implementation
 *   }
 *
 *   // ... rest of implementation
 * }
 * ```
 */
export interface WalletAdapter {
  // Metadata
  /** Unique identifier for this adapter (e.g., 'xaman', 'crossmark') */
  readonly id: string;
  /** Human-readable wallet name (e.g., 'Xaman Wallet') */
  readonly name: string;
  /** Wallet icon (URL or base64 data URI) */
  readonly icon?: string;
  /** Wallet website or download URL */
  readonly url?: string;

  // Availability
  /** Check if the wallet is installed and accessible */
  isAvailable(): Promise<boolean>;

  // Connection lifecycle
  /** Connect to the wallet */
  connect(options?: ConnectOptions): Promise<AccountInfo>;
  /** Disconnect from the wallet */
  disconnect(): Promise<void>;

  // Account information
  /** Get the currently connected account */
  getAccount(): Promise<AccountInfo | null>;
  /** Get the current network */
  getNetwork(): Promise<NetworkInfo>;

  // Signing and submission operations
  /**
   * Sign and optionally submit a transaction
   * @param transaction - The transaction to sign
   * @param submit - Whether to submit the transaction (default: true)
   */
  signAndSubmit(transaction: Transaction, submit?: boolean): Promise<SubmittedTransaction>;

  /**
   * Sign a message
   * @param message - The message to sign (string or Uint8Array)
   */
  signMessage(message: string | Uint8Array): Promise<SignedMessage>;

  // Events (optional, for wallets that support event listening)
  /** Subscribe to wallet events */
  on?(event: WalletAdapterEvent, callback: (data: unknown) => void): void;
  /** Unsubscribe from wallet events */
  off?(event: WalletAdapterEvent, callback: (data: unknown) => void): void;
}

// ============================================================================
// Manager Types
// ============================================================================

/**
 * Wallet manager configuration options
 */
export interface WalletManagerOptions {
  /** Available wallet adapters */
  adapters: WalletAdapter[];
  /** Default network configuration */
  network?: NetworkConfig;
  /** Whether to auto-reconnect on initialization */
  autoConnect?: boolean;
  /** Custom storage adapter (default: localStorage) */
  storage?: StorageAdapter;
  /** Logging configuration */
  logger?: LoggerOptions;
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Storage adapter interface for persisting connection state
 * Implement this to use custom storage backends
 */
export interface StorageAdapter {
  /** Get a value by key */
  get(key: string): Promise<string | null>;
  /** Set a key-value pair */
  set(key: string, value: string): Promise<void>;
  /** Remove a key */
  remove(key: string): Promise<void>;
  /** Clear all stored data */
  clear(): Promise<void>;
}

/**
 * Stored connection state
 */
export interface StoredState {
  /** The connected wallet adapter ID */
  readonly walletId: string;
  /** The connected account information */
  readonly account: AccountInfo;
  /** The network configuration */
  readonly network: NetworkInfo;
  /** Timestamp when the state was saved */
  readonly timestamp: number;
}

// ============================================================================
// Logger Types
// ============================================================================

/** Available log levels */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

/**
 * Logger configuration options
 * Level defaults to 'debug' in development, 'warn' in production
 */
export interface LoggerOptions {
  /** Minimum log level to output */
  level?: LogLevel;
  /** Prefix for log messages */
  prefix?: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error categories for grouping related errors
 */
export enum ErrorCategory {
  /** Connection-related errors (wallet not found, connection failed, etc.) */
  CONNECTION = 'CONNECTION',
  /** Signing-related errors (sign failed, rejected, etc.) */
  SIGNING = 'SIGNING',
  /** Network-related errors (unsupported network, mismatch, etc.) */
  NETWORK = 'NETWORK',
  /** State-related errors (not connected, already connected, etc.) */
  STATE = 'STATE',
  /** Hardware device errors (not found, locked, app not open, etc.) */
  DEVICE = 'DEVICE',
  /** Validation errors (invalid address, signature, etc.) */
  VALIDATION = 'VALIDATION',
  /** Timeout errors */
  TIMEOUT = 'TIMEOUT',
  /** Unknown or internal errors */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error severity levels for prioritization
 */
export enum ErrorSeverity {
  /** Informational - not really an error */
  INFO = 'INFO',
  /** Warning - operation may have issues but can continue */
  WARNING = 'WARNING',
  /** Error - operation failed but can be retried */
  ERROR = 'ERROR',
  /** Critical - serious error that may require intervention */
  CRITICAL = 'CRITICAL',
}

/**
 * Comprehensive error codes for wallet operations
 *
 * Error codes are grouped by category:
 * - Connection: Wallet discovery and connection issues
 * - Signing: Transaction and message signing issues
 * - Network: Network connectivity and configuration issues
 * - State: Wallet state management issues
 * - Device: Hardware wallet specific issues
 * - Validation: Input validation issues
 * - Timeout: Operation timeout issues
 * - General: Unknown and internal errors
 */
export enum WalletErrorCode {
  // -------------------------------------------------------------------------
  // Connection errors
  // -------------------------------------------------------------------------
  /** Wallet adapter with the given ID was not registered */
  WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
  /** Wallet extension or app is not installed */
  WALLET_NOT_INSTALLED = 'WALLET_NOT_INSTALLED',
  /** Wallet is installed but not currently available */
  WALLET_NOT_AVAILABLE = 'WALLET_NOT_AVAILABLE',
  /** Connection attempt failed */
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  /** User rejected the connection request */
  CONNECTION_REJECTED = 'CONNECTION_REJECTED',
  /** Connection was closed */
  CONNECTION_CLOSED = 'CONNECTION_CLOSED',

  // -------------------------------------------------------------------------
  // Signing errors
  // -------------------------------------------------------------------------
  /** Transaction or message signing failed */
  SIGN_FAILED = 'SIGN_FAILED',
  /** User rejected the signing request */
  SIGN_REJECTED = 'SIGN_REJECTED',
  /** Signing operation timed out */
  SIGN_TIMEOUT = 'SIGN_TIMEOUT',
  /** Transaction is invalid or malformed */
  INVALID_TRANSACTION = 'INVALID_TRANSACTION',
  /** Account has insufficient funds */
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',

  // -------------------------------------------------------------------------
  // Network errors
  // -------------------------------------------------------------------------
  /** Network is not supported by the wallet */
  NETWORK_NOT_SUPPORTED = 'NETWORK_NOT_SUPPORTED',
  /** Wallet is connected to a different network than expected */
  NETWORK_MISMATCH = 'NETWORK_MISMATCH',
  /** Network communication error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Network is temporarily unavailable */
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',

  // -------------------------------------------------------------------------
  // State errors
  // -------------------------------------------------------------------------
  /** No wallet is currently connected */
  NOT_CONNECTED = 'NOT_CONNECTED',
  /** A wallet is already connected */
  ALREADY_CONNECTED = 'ALREADY_CONNECTED',
  /** Session has expired */
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  /** Wallet is in an invalid state */
  INVALID_STATE = 'INVALID_STATE',

  // -------------------------------------------------------------------------
  // Device errors (hardware wallets)
  // -------------------------------------------------------------------------
  /** Hardware wallet device not found */
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  /** Hardware wallet is locked (PIN required) */
  DEVICE_LOCKED = 'DEVICE_LOCKED',
  /** Required app is not open on the hardware wallet */
  DEVICE_APP_NOT_OPEN = 'DEVICE_APP_NOT_OPEN',
  /** Hardware wallet was disconnected */
  DEVICE_DISCONNECTED = 'DEVICE_DISCONNECTED',
  /** Communication error with hardware wallet */
  DEVICE_COMMUNICATION_ERROR = 'DEVICE_COMMUNICATION_ERROR',

  // -------------------------------------------------------------------------
  // Validation errors
  // -------------------------------------------------------------------------
  /** Invalid XRPL address */
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  /** Invalid signature */
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  /** Invalid message format */
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  /** Invalid parameters provided */
  INVALID_PARAMS = 'INVALID_PARAMS',

  // -------------------------------------------------------------------------
  // Timeout errors
  // -------------------------------------------------------------------------
  /** Operation timed out */
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  /** Connection attempt timed out */
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',

  // -------------------------------------------------------------------------
  // Method errors
  // -------------------------------------------------------------------------
  /** Method is not supported by this wallet */
  UNSUPPORTED_METHOD = 'UNSUPPORTED_METHOD',

  // -------------------------------------------------------------------------
  // General errors
  // -------------------------------------------------------------------------
  /** Unknown error occurred */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  /** Internal error (bug) */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Make all properties of T readonly recursively
 */
export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/**
 * Make selected properties of T required
 */
export type RequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Make selected properties of T optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extract the type of array elements
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

/**
 * Type for async functions
 */
export type AsyncFunction<T = unknown, Args extends unknown[] = unknown[]> = (
  ...args: Args
) => Promise<T>;
