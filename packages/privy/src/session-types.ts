import type { PrivyMfaMode } from './mfa';

/**
 * The identity returned by a Privy embedded XRPL wallet session.
 *
 * `publicKey` is the compressed secp256k1 public key returned by Privy's
 * Wallet API. It is intentionally kept as a string here so this public type
 * does not expose a Privy SDK type in the package declaration output.
 */
export interface PrivyWallet {
  id: string;
  address: string;
  publicKey: string;
  userId: string;
}

/**
 * OAuth providers supported by Privy's browser OAuth API in js-sdk-core
 * 0.79.4. Custom JWT authentication has its own login-method variant below.
 */
export type PrivyOAuthProvider =
  | 'google'
  | 'discord'
  | 'twitter'
  | 'github'
  | 'spotify'
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'apple'
  | 'line'
  | 'twitch'
  | 'telegram'
  | `custom:${string}`;

interface PrivyLoginMethodBase {
  id: string;
  /**
   * Text shown on the login button. Defaults to the dashboard label of the
   * method this entry replaces, then to the OAuth provider's name, then `id`.
   */
  label?: string;
}

export type PrivyLoginMethod =
  | (PrivyLoginMethodBase & {
      oauthProvider: PrivyOAuthProvider;
    })
  | (PrivyLoginMethodBase & {
      getCustomToken: (signal: AbortSignal) => Promise<string>;
    });

export interface PrivySessionOptions {
  appId: string;
  clientId?: string;
  /** Callback URL for OAuth methods. Omit it when the app only uses non-OAuth methods. */
  redirectUri?: string;
  /**
   * Application supplied methods. Dashboard methods are discovered at runtime;
   * these entries extend them and replace a dashboard entry with the same id.
   */
  loginMethods?: readonly PrivyLoginMethod[];
  /** Limit the chooser and direct sign-ins to these method IDs. Omit to offer all configured methods. */
  allowedLoginMethods?: readonly string[];
  /** How transaction MFA is answered when Privy requests it. */
  mfa?: PrivyMfaMode;
  /**
   * Offer Privy guest login when the dashboard enables it. Off by default: a
   * guest's only credential is a random secret in this browser's storage, so
   * the guest account and its XRPL wallet, with any funds sent to it, are lost
   * for good on logout, on signing in with another method, or when site data is
   * cleared.
   */
  allowGuestLogin?: boolean;
  timeoutMs?: number;
  /** Timeout for a single Privy/network request. Defaults to `timeoutMs`, then 15 seconds. */
  requestTimeoutMs?: number;
  /** Time allowed for a user-controlled MFA prompt. Defaults to 60 seconds. */
  userActionTimeoutMs?: number;
  /** Timeout used while waiting for logout and cleanup. Defaults to `timeoutMs`, then 15 seconds. */
  teardownTimeoutMs?: number;
}
