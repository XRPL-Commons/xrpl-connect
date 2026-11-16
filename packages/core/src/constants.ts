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
   * How long a login that left the page through a redirect is remembered, so
   * its returned authorization completes on the network it was requested on
   * (1 hour). Wallets expire their own callbacks sooner: Xaman after 5 minutes
   * and Privy after 10 by default.
   */
  PENDING_CONNECTION_MAX_AGE: 60 * 60 * 1000,
  /**
   * Maximum time an adapter's `isAvailable()` may take before it's treated as
   * unavailable, so one slow/hung wallet can't block the connect modal.
   */
  AVAILABILITY_TIMEOUT: 1000,
} as const;
