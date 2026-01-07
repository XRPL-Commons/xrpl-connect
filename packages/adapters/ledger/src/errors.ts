/**
 * Ledger-specific error handling utilities
 *
 * This module provides utilities for parsing and formatting Ledger device errors,
 * mapping them to the appropriate WalletErrorCode values.
 */

import { createWalletError, type WalletError } from '@xrpl-connect/core';
import { LedgerDeviceState, LedgerErrorCode, LEDGER_STATE_MESSAGES } from './types';

/**
 * Result of parsing a Ledger error
 */
export interface ParsedLedgerError {
  /** The determined device state */
  state: LedgerDeviceState;
  /** Human-readable error message */
  message: string;
  /** Whether the error is user-initiated (rejection) */
  isUserAction: boolean;
}

/**
 * Parse Ledger error and determine device state
 *
 * @param error - The error to parse
 * @returns Parsed error information including state and message
 */
export function parseLedgerError(error: unknown): ParsedLedgerError {
  if (error && typeof error === 'object') {
    const err = error;

    // Check for Ledger status codes
    if ('statusCode' in err) {
      const statusCode = err.statusCode;

      switch (statusCode) {
        case LedgerErrorCode.DEVICE_LOCKED:
          return {
            state: LedgerDeviceState.LOCKED,
            message: LEDGER_STATE_MESSAGES[LedgerDeviceState.LOCKED],
            isUserAction: false,
          };

        case LedgerErrorCode.APP_NOT_OPEN:
        case LedgerErrorCode.APP_NOT_OPEN_ALT:
        case LedgerErrorCode.APP_NOT_OPEN_ALT2:
          return {
            state: LedgerDeviceState.APP_NOT_OPEN,
            message: LEDGER_STATE_MESSAGES[LedgerDeviceState.APP_NOT_OPEN],
            isUserAction: false,
          };

        case LedgerErrorCode.USER_REJECTED:
          return {
            state: LedgerDeviceState.READY,
            message: 'Transaction rejected on Ledger device',
            isUserAction: true,
          };
      }
    }

    // Check error message for common patterns
    if ('message' in err && typeof err.message === 'string') {
      const message = err.message.toLowerCase();

      if (
        message.includes('no device') ||
        message.includes('not found') ||
        message.includes('cannot open device') ||
        message.includes('disconnected')
      ) {
        return {
          state: LedgerDeviceState.NOT_CONNECTED,
          message: LEDGER_STATE_MESSAGES[LedgerDeviceState.NOT_CONNECTED],
          isUserAction: false,
        };
      }

      if (message.includes('locked')) {
        return {
          state: LedgerDeviceState.LOCKED,
          message: LEDGER_STATE_MESSAGES[LedgerDeviceState.LOCKED],
          isUserAction: false,
        };
      }

      if (message.includes('rejected') || message.includes('denied')) {
        return {
          state: LedgerDeviceState.READY,
          message: 'Operation rejected on Ledger device',
          isUserAction: true,
        };
      }

      if (message.includes('timeout')) {
        return {
          state: LedgerDeviceState.UNKNOWN,
          message: 'Operation timed out. Please try again.',
          isUserAction: false,
        };
      }
    }
  }

  return {
    state: LedgerDeviceState.UNKNOWN,
    message: error instanceof Error ? error.message : 'Unknown Ledger error',
    isUserAction: false,
  };
}

/**
 * Check if browser supports Ledger (WebHID or WebUSB)
 *
 * @returns Object indicating support status and available transports
 */
export function isBrowserSupported(): {
  supported: boolean;
  webHID: boolean;
  webUSB: boolean;
  message?: string;
} {
  const webHID = typeof navigator !== 'undefined' && 'hid' in navigator;
  const webUSB = typeof navigator !== 'undefined' && 'usb' in navigator;

  if (!webHID && !webUSB) {
    return {
      supported: false,
      webHID: false,
      webUSB: false,
      message: 'Your browser does not support WebHID or WebUSB. Please use Chrome, Edge, or Opera.',
    };
  }

  return {
    supported: true,
    webHID,
    webUSB,
  };
}

/**
 * Format a user-friendly error message based on error type
 *
 * @param error - The error to format
 * @returns Formatted error message with helpful instructions
 */
export function formatLedgerError(error: unknown): string {
  const { state, message } = parseLedgerError(error);

  switch (state) {
    case LedgerDeviceState.NOT_CONNECTED:
      return `${message}\n\nMake sure your Ledger is connected via USB and try again.`;

    case LedgerDeviceState.LOCKED:
      return `${message}\n\nEnter your PIN on the Ledger device to unlock it.`;

    case LedgerDeviceState.APP_NOT_OPEN:
      return `${message}\n\nNavigate to the XRP app on your Ledger and open it.`;

    default:
      return message;
  }
}

/**
 * Create a WalletError from a Ledger error
 *
 * This function parses the Ledger error and creates an appropriate WalletError
 * with the correct error code based on the device state.
 *
 * @param error - The Ledger error
 * @param context - Optional context (e.g., 'connecting', 'signing')
 * @returns A WalletError with the appropriate code and message
 */
export function createLedgerError(error: unknown, context?: string): WalletError {
  const parsed = parseLedgerError(error);
  const formattedMessage = formatLedgerError(error);

  switch (parsed.state) {
    case LedgerDeviceState.NOT_CONNECTED:
      return createWalletError.deviceNotFound('Ledger');

    case LedgerDeviceState.LOCKED:
      return createWalletError.deviceLocked('Ledger');

    case LedgerDeviceState.APP_NOT_OPEN:
      return createWalletError.deviceAppNotOpen('XRP', 'Ledger');

    case LedgerDeviceState.READY:
      // Device is ready, so this is likely a user rejection
      if (parsed.isUserAction) {
        if (context === 'signing') {
          return createWalletError.signRejected('Ledger');
        }
        return createWalletError.connectionRejected('Ledger');
      }
      // Fall through to unknown error
      break;
  }

  // Default to unknown error with formatted message
  return createWalletError.deviceCommunicationError(
    formattedMessage,
    error instanceof Error ? error : undefined
  );
}
