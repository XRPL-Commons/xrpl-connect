/**
 * @xrpl-connect/core
 * Framework-agnostic wallet connection toolkit for XRPL
 *
 * @module core
 */

// =============================================================================
// Main exports
// =============================================================================

export { WalletManager, type WalletManagerEventData } from './wallet-manager';

// =============================================================================
// Types - Core interfaces and types
// =============================================================================

export type {
  // Wallet adapter types
  WalletAdapter,
  WalletManagerOptions,
  WalletEvent,
  WalletAdapterEvent,
  WalletEventData,
  WalletEventHandler,

  // Account types
  AccountInfo,
  StrictAccountInfo,

  // Network types
  NetworkInfo,
  NetworkConfig,
  StandardNetworkKey,

  // Transaction types
  Transaction,
  SignedTransaction,
  StrictSignedTransaction,
  SignedMessage,
  StrictSignedMessage,
  SubmittedTransaction,
  StrictSubmittedTransaction,

  // Connection types
  BaseConnectOptions,
  ConnectOptions,

  // Storage types
  StorageAdapter,
  StoredState,

  // Logger types
  LoggerOptions,
  LogLevel,

  // Result types
  BaseResult,
  SuccessResult,
  FailureResult,
  OperationResult,

  // Branded types
  Branded,
  XRPLAddress,
  TransactionHash,
  Signature,
  PublicKey,
  TransactionBlob,
  NetworkId,
  WalletId,

  // Utility types
  DeepReadonly,
  RequiredKeys,
  OptionalKeys,
  ArrayElement,
  AsyncFunction,
} from './types';

// =============================================================================
// Type exports - Enums and constants
// =============================================================================

export {
  // Network constants
  STANDARD_NETWORKS,

  // Error enums
  WalletErrorCode,
  ErrorCategory,
  ErrorSeverity,

  // Result helpers
  success,
  failure,

  // Type guards and casting for branded types
  isValidXRPLAddress,
  isValidTransactionHash,
  isValidPublicKey,
  asXRPLAddress,
  asTransactionHash,
  asPublicKey,
  asNetworkId,
  asWalletId,
} from './types';

// =============================================================================
// Errors - Error classes and utilities
// =============================================================================

export {
  // Main error class
  WalletError,

  // Error factory
  createWalletError,

  // Type guards
  isWalletError,
  hasErrorCode,
  hasErrorCategory,
  hasMinimumSeverity,

  // Utilities
  getErrorMessage,
  getRecoveryHint,
  ensureWalletError,

  // Mappings (for advanced use)
  ERROR_NUMERIC_CODES,
  ERROR_CATEGORIES,
  ERROR_SEVERITIES,
  RECOVERY_HINTS,

  // Types
  type ErrorMetadata,
  type WalletErrorDetails,
  type WalletErrorOptions,
} from './errors';

// =============================================================================
// Storage - Persistence utilities
// =============================================================================

export { Storage, LocalStorageAdapter, MemoryStorageAdapter } from './storage';

// =============================================================================
// Logger - Logging utilities
// =============================================================================

export { Logger, createLogger } from './logger';

// =============================================================================
// Constants
// =============================================================================

export { TIME } from './constants';
