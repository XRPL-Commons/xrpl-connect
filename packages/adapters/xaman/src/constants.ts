/**
 * Constants for Xaman adapter
 */

/**
 * Xaman API URLs
 */
export const XAMAN_API = {
  BASE_URL: 'https://xumm.app/api/v1/platform',
  OAUTH_BASE_URL: 'https://oauth2.xumm.app',
  SIGN_URL_BASE: 'https://xumm.app/sign',
} as const;

/**
 * OAuth configuration
 */
export const OAUTH = {
  REDIRECT_URI: 'http://localhost:3000/callback',
  SCOPE: 'openid',
  RESPONSE_TYPE: 'code',
} as const;

/**
 * Payload status values from Xaman API
 */
export const PAYLOAD_STATUS = {
  SIGNED: 'SIGNED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  OPENED: 'OPENED',
} as const;

/**
 * WebSocket event types
 */
export const WS_EVENTS = {
  MESSAGE: 'message',
  ERROR: 'error',
  CLOSE: 'close',
} as const;

/**
 * Default transaction options
 */
export const TRANSACTION_DEFAULTS = {
  AUTOFILL: true,
  SUBMIT: true,
} as const;

/**
 * Timeout values (in milliseconds)
 */
export const TIMEOUTS = {
  PAYLOAD_WAIT: 300000, // 5 minutes
  WS_CONNECTION: 10000, // 10 seconds
} as const;

/**
 * Logging configuration
 */
export const LOGGING = {
  UUID_PREVIEW_LENGTH: 20, // Number of characters to show in UUID preview logs
} as const;
