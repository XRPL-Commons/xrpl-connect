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

export type PrivyLoginMethod =
  | {
      id: string;
      oauthProvider: PrivyOAuthProvider;
    }
  | {
      id: string;
      getCustomToken: (signal: AbortSignal) => Promise<string>;
    };

export interface PrivySessionOptions {
  appId: string;
  clientId?: string;
  redirectUri: string;
  /**
   * Application supplied methods. Dashboard methods are discovered at runtime;
   * these entries extend them and replace a dashboard entry with the same id.
   */
  loginMethods?: readonly PrivyLoginMethod[];
  timeoutMs?: number;
}
