/**
 * Constants for WalletConnect adapter
 */

/**
 * WalletConnect disconnect reason codes
 */
export const DISCONNECT_REASONS = {
  USER_DISCONNECTED: {
    code: 6000,
    message: 'User disconnected',
  },
} as const;

/**
 * Default WalletConnect metadata
 */
export const DEFAULT_METADATA = {
  NAME: 'XRPL Connect',
  DESCRIPTION: 'XRPL Wallet Connection',
  DEFAULT_URL: 'https://xrpl.org',
  DEFAULT_ICON: 'https://xrpl.org/favicon.ico',
} as const;

/**
 * Logging configuration
 */
export const LOGGING = {
  URI_PREVIEW_LENGTH: 50, // Number of characters to show in URI preview logs
} as const;

/**
 * Account parsing configuration
 */
export const ACCOUNT_FORMAT = {
  ADDRESS_INDEX: 2, // Index of address in "xrpl:chainId:rAddress" format
} as const;

/**
 * XRPL WalletConnect namespace configuration
 */
export const XRPL_NAMESPACE = {
  KEY: 'xrpl',
  EVENTS: ['chainChanged', 'accountsChanged'] as string[], // Cast to mutable array for WalletConnect types
} as const;
