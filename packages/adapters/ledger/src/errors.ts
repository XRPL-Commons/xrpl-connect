/**
 * Ledger-specific error handling utilities
 */

import { LedgerDeviceState, LedgerErrorCode, LEDGER_STATE_MESSAGES } from './types';

/**
 * Parse Ledger error and determine device state
 */
export function parseLedgerError(error: unknown): {
  state: LedgerDeviceState;
  message: string;
} {
  if (error && typeof error === 'object') {
    const err = error;

    if ('statusCode' in err) {
      const statusCode = err.statusCode;

      switch (statusCode) {
        case LedgerErrorCode.DEVICE_LOCKED:
          return {
            state: LedgerDeviceState.LOCKED,
            message: LEDGER_STATE_MESSAGES[LedgerDeviceState.LOCKED],
          };

        case LedgerErrorCode.APP_NOT_OPEN:
        case LedgerErrorCode.APP_NOT_OPEN_ALT:
        case LedgerErrorCode.APP_NOT_OPEN_ALT2:
          return {
            state: LedgerDeviceState.APP_NOT_OPEN,
            message: LEDGER_STATE_MESSAGES[LedgerDeviceState.APP_NOT_OPEN],
          };

        case LedgerErrorCode.USER_REJECTED:
          return {
            state: LedgerDeviceState.READY,
            message: 'Transaction rejected on Ledger device',
          };
      }
    }

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
        };
      }

      if (message.includes('locked')) {
        return {
          state: LedgerDeviceState.LOCKED,
          message: LEDGER_STATE_MESSAGES[LedgerDeviceState.LOCKED],
        };
      }

      if (message.includes('rejected') || message.includes('denied')) {
        return {
          state: LedgerDeviceState.READY,
          message: 'Operation rejected on Ledger device',
        };
      }
    }
  }

  return {
    state: LedgerDeviceState.UNKNOWN,
    message: error instanceof Error ? error.message : 'Unknown Ledger error',
  };
}

/**
 * Check if browser supports Ledger (WebHID or WebUSB)
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
