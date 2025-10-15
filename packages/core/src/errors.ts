/**
 * Wallet error handling
 */

import { WalletErrorCode } from './types';

/**
 * Custom error class for wallet operations
 */
export class WalletError extends Error {
  public readonly code: WalletErrorCode;
  public readonly originalError?: Error;

  constructor(code: WalletErrorCode, message: string, originalError?: Error) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
    this.originalError = originalError;

    // Maintain proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WalletError);
    }
  }

  /**
   * Convert to JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
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
}

/**
 * Helper functions to create specific error types
 */
export const createWalletError = {
  notFound: (walletId: string): WalletError =>
    new WalletError(
      WalletErrorCode.WALLET_NOT_FOUND,
      `Wallet with id "${walletId}" was not found. Make sure the adapter is registered.`
    ),

  notInstalled: (walletName: string): WalletError =>
    new WalletError(
      WalletErrorCode.WALLET_NOT_INSTALLED,
      `${walletName} is not installed. Please install the wallet extension or app.`
    ),

  notAvailable: (walletName: string): WalletError =>
    new WalletError(
      WalletErrorCode.WALLET_NOT_AVAILABLE,
      `${walletName} is not currently available.`
    ),

  connectionFailed: (walletName: string, originalError?: Error): WalletError =>
    new WalletError(
      WalletErrorCode.CONNECTION_FAILED,
      `Failed to connect to ${walletName}. ${originalError?.message || ''}`,
      originalError
    ),

  connectionRejected: (walletName: string): WalletError =>
    new WalletError(
      WalletErrorCode.CONNECTION_REJECTED,
      `Connection to ${walletName} was rejected by the user.`
    ),

  signFailed: (originalError?: Error): WalletError =>
    new WalletError(
      WalletErrorCode.SIGN_FAILED,
      `Failed to sign transaction. ${originalError?.message || ''}`,
      originalError
    ),

  signRejected: (): WalletError =>
    new WalletError(WalletErrorCode.SIGN_REJECTED, 'Transaction signing was rejected by the user.'),

  networkNotSupported: (networkId: string, walletName: string): WalletError =>
    new WalletError(
      WalletErrorCode.NETWORK_NOT_SUPPORTED,
      `Network "${networkId}" is not supported by ${walletName}.`
    ),

  networkMismatch: (expected: string, actual: string): WalletError =>
    new WalletError(
      WalletErrorCode.NETWORK_MISMATCH,
      `Network mismatch. Expected "${expected}" but wallet is connected to "${actual}".`
    ),

  notConnected: (): WalletError =>
    new WalletError(
      WalletErrorCode.NOT_CONNECTED,
      'No wallet is currently connected. Please connect a wallet first.'
    ),

  alreadyConnected: (walletName: string): WalletError =>
    new WalletError(
      WalletErrorCode.ALREADY_CONNECTED,
      `${walletName} is already connected. Disconnect first before connecting to another wallet.`
    ),

  unsupportedMethod: (message: string): WalletError =>
    new WalletError(WalletErrorCode.UNSUPPORTED_METHOD, message),

  unknown: (message: string, originalError?: Error): WalletError =>
    new WalletError(WalletErrorCode.UNKNOWN_ERROR, message, originalError),
};

/**
 * Check if an error is a WalletError
 */
export function isWalletError(error: unknown): error is WalletError {
  return error instanceof WalletError;
}

/**
 * Get error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
