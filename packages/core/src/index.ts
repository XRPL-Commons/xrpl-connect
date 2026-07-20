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
  ReconnectOptions,
  WalletEvent,
  WalletAdapterEvent,
  StorageAdapter,
  StoredState,
  LoggerOptions,
  LoggerInstance,
  LogLevel,
  SupportsPreInitialize,
  SupportsDeepLink,
  SupportsReconnectOptions,
} from './types';

export {
  STANDARD_NETWORKS,
  WalletErrorCode,
  WalletErrorCategory,
  supportsPreInitialize,
  supportsDeepLink,
  supportsReconnectOptions,
} from './types';

// Errors
export {
  WalletError,
  createWalletError,
  isWalletError,
  getErrorMessage,
  getWalletErrorCategory,
} from './errors';

// Storage
export {
  Storage,
  LocalStorageAdapter,
  MemoryStorageAdapter,
  STORED_STATE_VERSION,
  STATE_MIGRATIONS,
} from './storage';
export type { StorageOptions, StoredStateEnvelope, StoredStateMigration } from './storage';

// Logger
export { Logger, createLogger, configureLogger, isLoggerInstance } from './logger';

// Constants
export { TIME } from './constants';

// Network helpers
export { resolveNetwork } from './network';

// Device detection
export { isMobile } from './device';

// Async helpers
export { withTimeout } from './async';
