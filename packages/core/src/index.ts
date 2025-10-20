/**
 * @xrpl-connect/core
 * Framework-agnostic wallet connection toolkit for XRPL
 */

// Main exports
export { WalletManager } from './wallet-manager';

// Types
export type {
  WalletAdapter,
  WalletManagerOptions,
  AccountInfo,
  NetworkInfo,
  NetworkConfig,
  Transaction,
  SignedTransaction,
  SignedMessage,
  SubmittedTransaction,
  ConnectOptions,
  WalletEvent,
  WalletAdapterEvent,
  StorageAdapter,
  StoredState,
  LoggerOptions,
} from './types';

export { STANDARD_NETWORKS, WalletErrorCode } from './types';

// Errors
export { WalletError, createWalletError, isWalletError, getErrorMessage } from './errors';

// Storage
export { Storage, LocalStorageAdapter, MemoryStorageAdapter } from './storage';

// Logger
export { Logger, createLogger } from './logger';

// Constants
export { TIME } from './constants';
