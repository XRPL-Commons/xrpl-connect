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
export const STANDARD_NETWORKS: Record<string, NetworkInfo> = {
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
export type NetworkConfig = keyof typeof STANDARD_NETWORKS | NetworkInfo;

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
  [key: string]: unknown; // Allow additional wallet-specific fields
}

/**
 * Result of signing a message
 */
export interface SignedMessage {
  message: string; // Original message
  signature: string; // Signature
  publicKey: string; // Public key used for signing
}

/**
 * Result of submitting a transaction to the ledger
 */
export interface SubmittedTransaction {
  hash: string; // Transaction hash
  id?: string; // Request/submission ID (wallet-specific)
  [key: string]: unknown; // Allow additional wallet-specific fields
}

/**
 * Options for connecting to a wallet
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ConnectOptions<WalletSpecificOptions extends Record<string, unknown> = {}> = {
  network?: NetworkConfig; // Preferred network
  autoReconnect?: boolean; // Auto-reconnect on page load
} & WalletSpecificOptions;

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
 * Core interface that all wallet adapters must implement
 */
export interface WalletAdapter {
  // Metadata
  readonly id: string; // 'xaman', 'crossmark', 'walletconnect', 'gemwallet'
  readonly name: string; // 'Xaman Wallet', 'Crossmark', etc.
  readonly icon?: string; // URL or base64 icon
  readonly url?: string; // Wallet website/download URL

  // Availability
  isAvailable(): Promise<boolean>; // Check if wallet is installed/accessible

  // Connection lifecycle
  connect(options?: ConnectOptions): Promise<AccountInfo>;
  disconnect(): Promise<void>;

  // Account information
  getAccount(): Promise<AccountInfo | null>;
  getNetwork(): Promise<NetworkInfo>;

  // Signing and submission operations
  signAndSubmit(transaction: Transaction, submit?: boolean): Promise<SubmittedTransaction>;
  signMessage(message: string | Uint8Array): Promise<SignedMessage>;

  // Events (optional, for wallets that support event listening)
  on?(event: WalletAdapterEvent, callback: (data: unknown) => void): void;
  off?(event: WalletAdapterEvent, callback: (data: unknown) => void): void;
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
  logger?: LoggerOptions; // Logging configuration
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
}

/**
 * Logger configuration options
 * Level is optional - defaults to 'debug' in development, 'warn' in production
 */
export interface LoggerOptions {
  level?: 'debug' | 'info' | 'warn' | 'error' | 'none';
  prefix?: string;
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
