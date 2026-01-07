/**
 * Enhanced wallet error handling system
 *
 * This module provides a comprehensive error management system with:
 * - Error categories for grouping related errors
 * - Severity levels for prioritization
 * - Numeric codes for programmatic handling
 * - Recovery suggestions for users
 * - Detailed error context and metadata
 *
 * @module errors
 */

import { WalletErrorCode, ErrorCategory, ErrorSeverity } from './types';

/**
 * Error metadata providing additional context
 */
export interface ErrorMetadata {
  /** The wallet adapter ID that caused the error */
  readonly walletId?: string;
  /** The wallet adapter name */
  readonly walletName?: string;
  /** The network ID related to the error */
  readonly networkId?: string;
  /** The transaction hash if applicable */
  readonly transactionHash?: string;
  /** Additional context-specific data */
  readonly context?: Record<string, unknown>;
  /** Timestamp when the error occurred */
  readonly timestamp: number;
}

/**
 * Error details containing full error information
 */
export interface WalletErrorDetails {
  /** Error code identifier */
  readonly code: WalletErrorCode;
  /** Numeric error code for programmatic handling */
  readonly numericCode: number;
  /** Error category */
  readonly category: ErrorCategory;
  /** Error severity level */
  readonly severity: ErrorSeverity;
  /** Human-readable error message */
  readonly message: string;
  /** Suggested recovery action */
  readonly recoveryHint?: string;
  /** Additional metadata */
  readonly metadata: ErrorMetadata;
  /** Original error if wrapped */
  readonly originalError?: Error;
}

/**
 * Numeric error code mappings for programmatic handling
 * Grouped by category:
 * - 1xxx: Connection errors
 * - 2xxx: Signing errors
 * - 3xxx: Network errors
 * - 4xxx: State errors
 * - 5xxx: Device errors
 * - 6xxx: Validation errors
 * - 7xxx: Timeout errors
 * - 9xxx: Unknown/internal errors
 */
export const ERROR_NUMERIC_CODES: Record<WalletErrorCode, number> = {
  // Connection errors (1xxx)
  [WalletErrorCode.WALLET_NOT_FOUND]: 1001,
  [WalletErrorCode.WALLET_NOT_INSTALLED]: 1002,
  [WalletErrorCode.WALLET_NOT_AVAILABLE]: 1003,
  [WalletErrorCode.CONNECTION_FAILED]: 1004,
  [WalletErrorCode.CONNECTION_REJECTED]: 1005,
  [WalletErrorCode.CONNECTION_CLOSED]: 1006,

  // Signing errors (2xxx)
  [WalletErrorCode.SIGN_FAILED]: 2001,
  [WalletErrorCode.SIGN_REJECTED]: 2002,
  [WalletErrorCode.SIGN_TIMEOUT]: 2003,
  [WalletErrorCode.INVALID_TRANSACTION]: 2004,
  [WalletErrorCode.INSUFFICIENT_FUNDS]: 2005,

  // Network errors (3xxx)
  [WalletErrorCode.NETWORK_NOT_SUPPORTED]: 3001,
  [WalletErrorCode.NETWORK_MISMATCH]: 3002,
  [WalletErrorCode.NETWORK_ERROR]: 3003,
  [WalletErrorCode.NETWORK_UNAVAILABLE]: 3004,

  // State errors (4xxx)
  [WalletErrorCode.NOT_CONNECTED]: 4001,
  [WalletErrorCode.ALREADY_CONNECTED]: 4002,
  [WalletErrorCode.SESSION_EXPIRED]: 4003,
  [WalletErrorCode.INVALID_STATE]: 4004,

  // Device errors (5xxx)
  [WalletErrorCode.DEVICE_NOT_FOUND]: 5001,
  [WalletErrorCode.DEVICE_LOCKED]: 5002,
  [WalletErrorCode.DEVICE_APP_NOT_OPEN]: 5003,
  [WalletErrorCode.DEVICE_DISCONNECTED]: 5004,
  [WalletErrorCode.DEVICE_COMMUNICATION_ERROR]: 5005,

  // Validation errors (6xxx)
  [WalletErrorCode.INVALID_ADDRESS]: 6001,
  [WalletErrorCode.INVALID_SIGNATURE]: 6002,
  [WalletErrorCode.INVALID_MESSAGE]: 6003,
  [WalletErrorCode.INVALID_PARAMS]: 6004,

  // Timeout errors (7xxx)
  [WalletErrorCode.OPERATION_TIMEOUT]: 7001,
  [WalletErrorCode.CONNECTION_TIMEOUT]: 7002,

  // Method errors (8xxx)
  [WalletErrorCode.UNSUPPORTED_METHOD]: 8001,

  // General/Unknown errors (9xxx)
  [WalletErrorCode.UNKNOWN_ERROR]: 9001,
  [WalletErrorCode.INTERNAL_ERROR]: 9002,
};

/**
 * Error category mappings
 */
export const ERROR_CATEGORIES: Record<WalletErrorCode, ErrorCategory> = {
  // Connection errors
  [WalletErrorCode.WALLET_NOT_FOUND]: ErrorCategory.CONNECTION,
  [WalletErrorCode.WALLET_NOT_INSTALLED]: ErrorCategory.CONNECTION,
  [WalletErrorCode.WALLET_NOT_AVAILABLE]: ErrorCategory.CONNECTION,
  [WalletErrorCode.CONNECTION_FAILED]: ErrorCategory.CONNECTION,
  [WalletErrorCode.CONNECTION_REJECTED]: ErrorCategory.CONNECTION,
  [WalletErrorCode.CONNECTION_CLOSED]: ErrorCategory.CONNECTION,

  // Signing errors
  [WalletErrorCode.SIGN_FAILED]: ErrorCategory.SIGNING,
  [WalletErrorCode.SIGN_REJECTED]: ErrorCategory.SIGNING,
  [WalletErrorCode.SIGN_TIMEOUT]: ErrorCategory.SIGNING,
  [WalletErrorCode.INVALID_TRANSACTION]: ErrorCategory.SIGNING,
  [WalletErrorCode.INSUFFICIENT_FUNDS]: ErrorCategory.SIGNING,

  // Network errors
  [WalletErrorCode.NETWORK_NOT_SUPPORTED]: ErrorCategory.NETWORK,
  [WalletErrorCode.NETWORK_MISMATCH]: ErrorCategory.NETWORK,
  [WalletErrorCode.NETWORK_ERROR]: ErrorCategory.NETWORK,
  [WalletErrorCode.NETWORK_UNAVAILABLE]: ErrorCategory.NETWORK,

  // State errors
  [WalletErrorCode.NOT_CONNECTED]: ErrorCategory.STATE,
  [WalletErrorCode.ALREADY_CONNECTED]: ErrorCategory.STATE,
  [WalletErrorCode.SESSION_EXPIRED]: ErrorCategory.STATE,
  [WalletErrorCode.INVALID_STATE]: ErrorCategory.STATE,

  // Device errors
  [WalletErrorCode.DEVICE_NOT_FOUND]: ErrorCategory.DEVICE,
  [WalletErrorCode.DEVICE_LOCKED]: ErrorCategory.DEVICE,
  [WalletErrorCode.DEVICE_APP_NOT_OPEN]: ErrorCategory.DEVICE,
  [WalletErrorCode.DEVICE_DISCONNECTED]: ErrorCategory.DEVICE,
  [WalletErrorCode.DEVICE_COMMUNICATION_ERROR]: ErrorCategory.DEVICE,

  // Validation errors
  [WalletErrorCode.INVALID_ADDRESS]: ErrorCategory.VALIDATION,
  [WalletErrorCode.INVALID_SIGNATURE]: ErrorCategory.VALIDATION,
  [WalletErrorCode.INVALID_MESSAGE]: ErrorCategory.VALIDATION,
  [WalletErrorCode.INVALID_PARAMS]: ErrorCategory.VALIDATION,

  // Timeout errors
  [WalletErrorCode.OPERATION_TIMEOUT]: ErrorCategory.TIMEOUT,
  [WalletErrorCode.CONNECTION_TIMEOUT]: ErrorCategory.TIMEOUT,

  // Method errors
  [WalletErrorCode.UNSUPPORTED_METHOD]: ErrorCategory.STATE,

  // General/Unknown errors
  [WalletErrorCode.UNKNOWN_ERROR]: ErrorCategory.UNKNOWN,
  [WalletErrorCode.INTERNAL_ERROR]: ErrorCategory.UNKNOWN,
};

/**
 * Error severity mappings
 */
export const ERROR_SEVERITIES: Record<WalletErrorCode, ErrorSeverity> = {
  // Connection errors
  [WalletErrorCode.WALLET_NOT_FOUND]: ErrorSeverity.ERROR,
  [WalletErrorCode.WALLET_NOT_INSTALLED]: ErrorSeverity.ERROR,
  [WalletErrorCode.WALLET_NOT_AVAILABLE]: ErrorSeverity.WARNING,
  [WalletErrorCode.CONNECTION_FAILED]: ErrorSeverity.ERROR,
  [WalletErrorCode.CONNECTION_REJECTED]: ErrorSeverity.WARNING,
  [WalletErrorCode.CONNECTION_CLOSED]: ErrorSeverity.INFO,

  // Signing errors
  [WalletErrorCode.SIGN_FAILED]: ErrorSeverity.ERROR,
  [WalletErrorCode.SIGN_REJECTED]: ErrorSeverity.WARNING,
  [WalletErrorCode.SIGN_TIMEOUT]: ErrorSeverity.WARNING,
  [WalletErrorCode.INVALID_TRANSACTION]: ErrorSeverity.ERROR,
  [WalletErrorCode.INSUFFICIENT_FUNDS]: ErrorSeverity.WARNING,

  // Network errors
  [WalletErrorCode.NETWORK_NOT_SUPPORTED]: ErrorSeverity.ERROR,
  [WalletErrorCode.NETWORK_MISMATCH]: ErrorSeverity.ERROR,
  [WalletErrorCode.NETWORK_ERROR]: ErrorSeverity.ERROR,
  [WalletErrorCode.NETWORK_UNAVAILABLE]: ErrorSeverity.WARNING,

  // State errors
  [WalletErrorCode.NOT_CONNECTED]: ErrorSeverity.WARNING,
  [WalletErrorCode.ALREADY_CONNECTED]: ErrorSeverity.WARNING,
  [WalletErrorCode.SESSION_EXPIRED]: ErrorSeverity.WARNING,
  [WalletErrorCode.INVALID_STATE]: ErrorSeverity.ERROR,

  // Device errors
  [WalletErrorCode.DEVICE_NOT_FOUND]: ErrorSeverity.ERROR,
  [WalletErrorCode.DEVICE_LOCKED]: ErrorSeverity.WARNING,
  [WalletErrorCode.DEVICE_APP_NOT_OPEN]: ErrorSeverity.WARNING,
  [WalletErrorCode.DEVICE_DISCONNECTED]: ErrorSeverity.WARNING,
  [WalletErrorCode.DEVICE_COMMUNICATION_ERROR]: ErrorSeverity.ERROR,

  // Validation errors
  [WalletErrorCode.INVALID_ADDRESS]: ErrorSeverity.ERROR,
  [WalletErrorCode.INVALID_SIGNATURE]: ErrorSeverity.ERROR,
  [WalletErrorCode.INVALID_MESSAGE]: ErrorSeverity.ERROR,
  [WalletErrorCode.INVALID_PARAMS]: ErrorSeverity.ERROR,

  // Timeout errors
  [WalletErrorCode.OPERATION_TIMEOUT]: ErrorSeverity.WARNING,
  [WalletErrorCode.CONNECTION_TIMEOUT]: ErrorSeverity.WARNING,

  // Method errors
  [WalletErrorCode.UNSUPPORTED_METHOD]: ErrorSeverity.ERROR,

  // General/Unknown errors
  [WalletErrorCode.UNKNOWN_ERROR]: ErrorSeverity.ERROR,
  [WalletErrorCode.INTERNAL_ERROR]: ErrorSeverity.CRITICAL,
};

/**
 * Recovery hints for each error code
 */
export const RECOVERY_HINTS: Record<WalletErrorCode, string> = {
  // Connection errors
  [WalletErrorCode.WALLET_NOT_FOUND]:
    'Ensure the wallet adapter is registered with WalletManager before connecting.',
  [WalletErrorCode.WALLET_NOT_INSTALLED]:
    'Install the wallet extension or app from the official website.',
  [WalletErrorCode.WALLET_NOT_AVAILABLE]:
    'Check if the wallet is properly configured and try again.',
  [WalletErrorCode.CONNECTION_FAILED]:
    'Check your internet connection and wallet status, then try again.',
  [WalletErrorCode.CONNECTION_REJECTED]:
    'The connection request was rejected. Try connecting again and approve the request.',
  [WalletErrorCode.CONNECTION_CLOSED]:
    'The connection was closed. Reconnect to continue.',

  // Signing errors
  [WalletErrorCode.SIGN_FAILED]:
    'Transaction signing failed. Check the transaction details and try again.',
  [WalletErrorCode.SIGN_REJECTED]:
    'You rejected the signing request. Approve the request in your wallet to proceed.',
  [WalletErrorCode.SIGN_TIMEOUT]:
    'The signing request timed out. Check your wallet and try again.',
  [WalletErrorCode.INVALID_TRANSACTION]:
    'The transaction is invalid. Verify the transaction parameters.',
  [WalletErrorCode.INSUFFICIENT_FUNDS]:
    'Your account does not have sufficient funds for this transaction.',

  // Network errors
  [WalletErrorCode.NETWORK_NOT_SUPPORTED]:
    'This network is not supported. Switch to a supported network.',
  [WalletErrorCode.NETWORK_MISMATCH]:
    'Your wallet is connected to a different network. Switch to the correct network.',
  [WalletErrorCode.NETWORK_ERROR]:
    'A network error occurred. Check your connection and try again.',
  [WalletErrorCode.NETWORK_UNAVAILABLE]:
    'The network is temporarily unavailable. Please try again later.',

  // State errors
  [WalletErrorCode.NOT_CONNECTED]: 'Connect to a wallet before performing this operation.',
  [WalletErrorCode.ALREADY_CONNECTED]:
    'Disconnect from the current wallet before connecting to a new one.',
  [WalletErrorCode.SESSION_EXPIRED]: 'Your session has expired. Please reconnect your wallet.',
  [WalletErrorCode.INVALID_STATE]: 'The wallet is in an invalid state. Try disconnecting and reconnecting.',

  // Device errors
  [WalletErrorCode.DEVICE_NOT_FOUND]:
    'Connect your hardware wallet device via USB and try again.',
  [WalletErrorCode.DEVICE_LOCKED]:
    'Unlock your hardware wallet by entering your PIN.',
  [WalletErrorCode.DEVICE_APP_NOT_OPEN]:
    'Open the XRP app on your hardware wallet device.',
  [WalletErrorCode.DEVICE_DISCONNECTED]:
    'Your hardware wallet was disconnected. Reconnect and try again.',
  [WalletErrorCode.DEVICE_COMMUNICATION_ERROR]:
    'Communication error with hardware wallet. Disconnect, reconnect, and try again.',

  // Validation errors
  [WalletErrorCode.INVALID_ADDRESS]: 'The provided address is not a valid XRPL address.',
  [WalletErrorCode.INVALID_SIGNATURE]: 'The signature is invalid or does not match.',
  [WalletErrorCode.INVALID_MESSAGE]: 'The message format is invalid.',
  [WalletErrorCode.INVALID_PARAMS]: 'One or more parameters are invalid. Check the input values.',

  // Timeout errors
  [WalletErrorCode.OPERATION_TIMEOUT]:
    'The operation timed out. Check your wallet and try again.',
  [WalletErrorCode.CONNECTION_TIMEOUT]:
    'Connection timed out. Check your internet connection and try again.',

  // Method errors
  [WalletErrorCode.UNSUPPORTED_METHOD]:
    'This operation is not supported by the connected wallet.',

  // General/Unknown errors
  [WalletErrorCode.UNKNOWN_ERROR]:
    'An unexpected error occurred. Please try again or report this issue.',
  [WalletErrorCode.INTERNAL_ERROR]:
    'An internal error occurred. Please report this issue.',
};

/**
 * Options for creating a WalletError
 */
export interface WalletErrorOptions {
  /** The wallet adapter ID */
  walletId?: string;
  /** The wallet adapter name */
  walletName?: string;
  /** The network ID */
  networkId?: string;
  /** The transaction hash */
  transactionHash?: string;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** The original error */
  originalError?: Error;
  /** Custom recovery hint (overrides default) */
  recoveryHint?: string;
}

/**
 * Enhanced custom error class for wallet operations
 *
 * Provides comprehensive error information including:
 * - Error code and category
 * - Numeric code for programmatic handling
 * - Severity level
 * - Recovery suggestions
 * - Detailed metadata
 *
 * @example
 * ```typescript
 * try {
 *   await walletManager.connect('nonexistent');
 * } catch (error) {
 *   if (isWalletError(error)) {
 *     console.log('Error code:', error.code);
 *     console.log('Numeric code:', error.numericCode);
 *     console.log('Category:', error.category);
 *     console.log('Recovery hint:', error.recoveryHint);
 *   }
 * }
 * ```
 */
export class WalletError extends Error {
  /** Error code identifier */
  public readonly code: WalletErrorCode;

  /** Numeric error code for programmatic handling */
  public readonly numericCode: number;

  /** Error category */
  public readonly category: ErrorCategory;

  /** Error severity level */
  public readonly severity: ErrorSeverity;

  /** Suggested recovery action */
  public readonly recoveryHint: string;

  /** Error metadata */
  public readonly metadata: ErrorMetadata;

  /** Original error if this wraps another error */
  public readonly originalError?: Error;

  constructor(code: WalletErrorCode, message: string, options?: WalletErrorOptions) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
    this.numericCode = ERROR_NUMERIC_CODES[code];
    this.category = ERROR_CATEGORIES[code];
    this.severity = ERROR_SEVERITIES[code];
    this.recoveryHint = options?.recoveryHint || RECOVERY_HINTS[code];
    this.originalError = options?.originalError;

    this.metadata = {
      walletId: options?.walletId,
      walletName: options?.walletName,
      networkId: options?.networkId,
      transactionHash: options?.transactionHash,
      context: options?.context,
      timestamp: Date.now(),
    };

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WalletError);
    }
  }

  /**
   * Check if this error matches a specific category
   */
  isCategory(category: ErrorCategory): boolean {
    return this.category === category;
  }

  /**
   * Check if this error is recoverable (not critical)
   */
  isRecoverable(): boolean {
    return this.severity !== ErrorSeverity.CRITICAL;
  }

  /**
   * Check if this error was caused by user action (rejection, etc.)
   */
  isUserAction(): boolean {
    return (
      this.code === WalletErrorCode.CONNECTION_REJECTED ||
      this.code === WalletErrorCode.SIGN_REJECTED
    );
  }

  /**
   * Get detailed error information
   */
  getDetails(): WalletErrorDetails {
    return {
      code: this.code,
      numericCode: this.numericCode,
      category: this.category,
      severity: this.severity,
      message: this.message,
      recoveryHint: this.recoveryHint,
      metadata: this.metadata,
      originalError: this.originalError,
    };
  }

  /**
   * Convert to a JSON-serializable representation
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      numericCode: this.numericCode,
      category: this.category,
      severity: this.severity,
      message: this.message,
      recoveryHint: this.recoveryHint,
      metadata: this.metadata,
      stack: this.stack,
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
            stack: this.originalError.stack,
          }
        : undefined,
    };
  }

  /**
   * Create a string representation for logging
   */
  toString(): string {
    return `[${this.code}] ${this.message}`;
  }
}

/**
 * Factory object for creating specific wallet errors with appropriate context
 *
 * @example
 * ```typescript
 * // Create a "not found" error
 * throw createWalletError.notFound('xaman');
 *
 * // Create a connection failed error with original error
 * throw createWalletError.connectionFailed('Xaman', originalError);
 *
 * // Create a custom error with full options
 * throw createWalletError.signFailed({
 *   walletId: 'ledger',
 *   walletName: 'Ledger',
 *   originalError: deviceError,
 *   context: { transactionType: 'Payment' },
 * });
 * ```
 */
export const createWalletError = {
  // Connection errors
  notFound: (walletId: string): WalletError =>
    new WalletError(
      WalletErrorCode.WALLET_NOT_FOUND,
      `Wallet with id "${walletId}" was not found. Make sure the adapter is registered.`,
      { walletId }
    ),

  notInstalled: (walletName: string): WalletError =>
    new WalletError(
      WalletErrorCode.WALLET_NOT_INSTALLED,
      `${walletName} is not installed. Please install the wallet extension or app.`,
      { walletName }
    ),

  notAvailable: (walletName: string): WalletError =>
    new WalletError(
      WalletErrorCode.WALLET_NOT_AVAILABLE,
      `${walletName} is not currently available.`,
      { walletName }
    ),

  connectionFailed: (walletName: string, originalError?: Error): WalletError =>
    new WalletError(
      WalletErrorCode.CONNECTION_FAILED,
      `Failed to connect to ${walletName}.${originalError?.message ? ` ${originalError.message}` : ''}`,
      { walletName, originalError }
    ),

  connectionRejected: (walletName: string): WalletError =>
    new WalletError(
      WalletErrorCode.CONNECTION_REJECTED,
      `Connection to ${walletName} was rejected by the user.`,
      { walletName }
    ),

  connectionClosed: (walletName?: string): WalletError =>
    new WalletError(
      WalletErrorCode.CONNECTION_CLOSED,
      walletName ? `Connection to ${walletName} was closed.` : 'Connection was closed.',
      { walletName }
    ),

  // Signing errors
  signFailed: (originalErrorOrOptions?: Error | WalletErrorOptions): WalletError => {
    const options: WalletErrorOptions =
      originalErrorOrOptions instanceof Error
        ? { originalError: originalErrorOrOptions }
        : originalErrorOrOptions || {};
    return new WalletError(
      WalletErrorCode.SIGN_FAILED,
      `Failed to sign transaction.${options.originalError?.message ? ` ${options.originalError.message}` : ''}`,
      options
    );
  },

  signRejected: (walletName?: string): WalletError =>
    new WalletError(
      WalletErrorCode.SIGN_REJECTED,
      'Transaction signing was rejected by the user.',
      { walletName }
    ),

  signTimeout: (walletName?: string): WalletError =>
    new WalletError(
      WalletErrorCode.SIGN_TIMEOUT,
      'Transaction signing timed out. Please check your wallet and try again.',
      { walletName }
    ),

  invalidTransaction: (reason?: string): WalletError =>
    new WalletError(
      WalletErrorCode.INVALID_TRANSACTION,
      reason ? `Invalid transaction: ${reason}` : 'The transaction is invalid.',
      { context: { reason } }
    ),

  insufficientFunds: (required?: string, available?: string): WalletError =>
    new WalletError(
      WalletErrorCode.INSUFFICIENT_FUNDS,
      'Insufficient funds for this transaction.',
      { context: { required, available } }
    ),

  // Network errors
  networkNotSupported: (networkId: string, walletName: string): WalletError =>
    new WalletError(
      WalletErrorCode.NETWORK_NOT_SUPPORTED,
      `Network "${networkId}" is not supported by ${walletName}.`,
      { networkId, walletName }
    ),

  networkMismatch: (expected: string, actual: string): WalletError =>
    new WalletError(
      WalletErrorCode.NETWORK_MISMATCH,
      `Network mismatch. Expected "${expected}" but wallet is connected to "${actual}".`,
      { context: { expected, actual } }
    ),

  networkError: (message: string, originalError?: Error): WalletError =>
    new WalletError(WalletErrorCode.NETWORK_ERROR, message, { originalError }),

  networkUnavailable: (networkId?: string): WalletError =>
    new WalletError(
      WalletErrorCode.NETWORK_UNAVAILABLE,
      networkId
        ? `Network "${networkId}" is currently unavailable.`
        : 'The network is currently unavailable.',
      { networkId }
    ),

  // State errors
  notConnected: (): WalletError =>
    new WalletError(
      WalletErrorCode.NOT_CONNECTED,
      'No wallet is currently connected. Please connect a wallet first.'
    ),

  alreadyConnected: (walletName: string): WalletError =>
    new WalletError(
      WalletErrorCode.ALREADY_CONNECTED,
      `${walletName} is already connected. Disconnect first before connecting to another wallet.`,
      { walletName }
    ),

  sessionExpired: (walletName?: string): WalletError =>
    new WalletError(
      WalletErrorCode.SESSION_EXPIRED,
      walletName
        ? `Session with ${walletName} has expired. Please reconnect.`
        : 'Your session has expired. Please reconnect your wallet.',
      { walletName }
    ),

  invalidState: (message: string): WalletError =>
    new WalletError(WalletErrorCode.INVALID_STATE, message),

  // Device errors
  deviceNotFound: (deviceType?: string): WalletError =>
    new WalletError(
      WalletErrorCode.DEVICE_NOT_FOUND,
      deviceType
        ? `${deviceType} device not found. Please connect the device via USB.`
        : 'Hardware wallet device not found. Please connect the device via USB.',
      { context: { deviceType } }
    ),

  deviceLocked: (deviceType?: string): WalletError =>
    new WalletError(
      WalletErrorCode.DEVICE_LOCKED,
      deviceType
        ? `${deviceType} is locked. Please unlock by entering your PIN.`
        : 'Hardware wallet is locked. Please unlock by entering your PIN.',
      { context: { deviceType } }
    ),

  deviceAppNotOpen: (appName?: string, deviceType?: string): WalletError =>
    new WalletError(
      WalletErrorCode.DEVICE_APP_NOT_OPEN,
      appName
        ? `Please open the ${appName} app on your ${deviceType || 'hardware wallet'}.`
        : 'Please open the required app on your hardware wallet.',
      { context: { appName, deviceType } }
    ),

  deviceDisconnected: (deviceType?: string): WalletError =>
    new WalletError(
      WalletErrorCode.DEVICE_DISCONNECTED,
      deviceType
        ? `${deviceType} was disconnected. Please reconnect and try again.`
        : 'Hardware wallet was disconnected. Please reconnect and try again.',
      { context: { deviceType } }
    ),

  deviceCommunicationError: (message?: string, originalError?: Error): WalletError =>
    new WalletError(
      WalletErrorCode.DEVICE_COMMUNICATION_ERROR,
      message || 'Communication error with hardware wallet.',
      { originalError }
    ),

  // Validation errors
  invalidAddress: (address?: string): WalletError =>
    new WalletError(
      WalletErrorCode.INVALID_ADDRESS,
      address
        ? `Invalid XRPL address: "${address}".`
        : 'The provided address is not a valid XRPL address.',
      { context: { address } }
    ),

  invalidSignature: (): WalletError =>
    new WalletError(
      WalletErrorCode.INVALID_SIGNATURE,
      'The signature is invalid or does not match.'
    ),

  invalidMessage: (reason?: string): WalletError =>
    new WalletError(
      WalletErrorCode.INVALID_MESSAGE,
      reason ? `Invalid message: ${reason}` : 'The message format is invalid.'
    ),

  invalidParams: (details?: string): WalletError =>
    new WalletError(
      WalletErrorCode.INVALID_PARAMS,
      details ? `Invalid parameters: ${details}` : 'One or more parameters are invalid.',
      { context: { details } }
    ),

  // Timeout errors
  operationTimeout: (operation?: string): WalletError =>
    new WalletError(
      WalletErrorCode.OPERATION_TIMEOUT,
      operation ? `${operation} timed out.` : 'The operation timed out.',
      { context: { operation } }
    ),

  connectionTimeout: (walletName?: string): WalletError =>
    new WalletError(
      WalletErrorCode.CONNECTION_TIMEOUT,
      walletName
        ? `Connection to ${walletName} timed out.`
        : 'Connection attempt timed out.',
      { walletName }
    ),

  // Method errors
  unsupportedMethod: (method: string, walletName?: string): WalletError =>
    new WalletError(
      WalletErrorCode.UNSUPPORTED_METHOD,
      walletName
        ? `Method "${method}" is not supported by ${walletName}.`
        : `Method "${method}" is not supported.`,
      { walletName, context: { method } }
    ),

  // General errors
  unknown: (message: string, originalError?: Error): WalletError =>
    new WalletError(WalletErrorCode.UNKNOWN_ERROR, message, { originalError }),

  internal: (message: string, originalError?: Error): WalletError =>
    new WalletError(WalletErrorCode.INTERNAL_ERROR, message, { originalError }),

  /**
   * Create an error from any thrown value
   */
  fromUnknown: (error: unknown, fallbackMessage?: string): WalletError => {
    if (error instanceof WalletError) {
      return error;
    }
    if (error instanceof Error) {
      return createWalletError.unknown(error.message, error);
    }
    return createWalletError.unknown(
      fallbackMessage || String(error)
    );
  },
};

/**
 * Type guard to check if an error is a WalletError
 *
 * @example
 * ```typescript
 * try {
 *   await walletManager.connect('xaman');
 * } catch (error) {
 *   if (isWalletError(error)) {
 *     // TypeScript now knows error is WalletError
 *     console.log(error.code, error.recoveryHint);
 *   }
 * }
 * ```
 */
export function isWalletError(error: unknown): error is WalletError {
  return error instanceof WalletError;
}

/**
 * Type guard to check if an error has a specific error code
 */
export function hasErrorCode(error: unknown, code: WalletErrorCode): error is WalletError {
  return isWalletError(error) && error.code === code;
}

/**
 * Type guard to check if an error belongs to a specific category
 */
export function hasErrorCategory(error: unknown, category: ErrorCategory): error is WalletError {
  return isWalletError(error) && error.category === category;
}

/**
 * Type guard to check if an error is of a specific severity or higher
 */
export function hasMinimumSeverity(error: unknown, minSeverity: ErrorSeverity): boolean {
  if (!isWalletError(error)) return false;
  const severityOrder = [
    ErrorSeverity.INFO,
    ErrorSeverity.WARNING,
    ErrorSeverity.ERROR,
    ErrorSeverity.CRITICAL,
  ];
  return severityOrder.indexOf(error.severity) >= severityOrder.indexOf(minSeverity);
}

/**
 * Safely extract error message from unknown error type
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   console.log('Error:', getErrorMessage(error));
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

/**
 * Get the recovery hint from an error
 */
export function getRecoveryHint(error: unknown): string | undefined {
  if (isWalletError(error)) {
    return error.recoveryHint;
  }
  return undefined;
}

/**
 * Wrap any error as a WalletError if it isn't already
 */
export function ensureWalletError(error: unknown, fallbackCode?: WalletErrorCode): WalletError {
  if (error instanceof WalletError) {
    return error;
  }
  if (error instanceof Error) {
    return new WalletError(
      fallbackCode || WalletErrorCode.UNKNOWN_ERROR,
      error.message,
      { originalError: error }
    );
  }
  return new WalletError(
    fallbackCode || WalletErrorCode.UNKNOWN_ERROR,
    String(error)
  );
}
