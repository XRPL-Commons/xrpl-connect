/**
 * Core constants for Wallet Manager
 */

/**
 * Time constants (in milliseconds)
 */
export const TIME = {
  /** Maximum age for stored wallet state before it's considered stale (7 days) */
  STATE_MAX_AGE: 7 * 24 * 60 * 60 * 1000,
  /**
   * Max time an adapter's `isPlatformWrapper()` may take before it's treated as
   * "not the wrapper", so a slow adapter can't delay in-app-browser detection.
   */
  PLATFORM_WRAPPER_TIMEOUT: 500,
} as const;
