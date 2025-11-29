/**
 * Types for Privy adapter
 */

/**
 * Social login providers supported by Privy
 */
export type SocialProvider = 'google' | 'twitter' | 'discord' | 'github' | 'apple' | 'linkedin' | 'tiktok' | 'farcaster';

/**
 * Authentication methods supported by Privy
 */
export type AuthMethod = 'social' | 'email' | 'sms' | 'wallet';

/**
 * Chain type for embedded wallet creation
 * secp256k1 is used for XRPL (Ethereum-compatible curve)
 */
export type ChainType = 'ethereum' | 'solana';

/**
 * Privy adapter configuration
 */
export interface PrivyAdapterConfig {
  /**
   * Privy App ID (public, safe to expose in frontend)
   */
  appId: string;

  /**
   * Authentication methods to enable
   * Default: ['social', 'email', 'wallet']
   */
  authMethods?: AuthMethod[];

  /**
   * Social providers to enable (if social login is enabled)
   * Default: ['google', 'twitter', 'discord']
   */
  socialProviders?: SocialProvider[];

  /**
   * Chain type for embedded wallet creation
   * secp256k1 (ethereum) is recommended for XRPL
   * Default: 'ethereum'
   */
  chainType?: ChainType;

  /**
   * UI customization options
   */
  appearance?: {
    theme?: 'light' | 'dark';
    accentColor?: string;
    logo?: string;
  };

  /**
   * Wallet creation policy
   * - 'all-users': Create wallet for all users on login
   * - 'users-without-wallets': Only create for users who don't have one
   * Default: 'users-without-wallets'
   */
  createWalletOnLogin?: 'all-users' | 'users-without-wallets';
}

/**
 * Privy user information
 */
export interface PrivyUser {
  id: string;
  createdAt: number;
  linkedAccounts: PrivyLinkedAccount[];
}

/**
 * Linked account types
 */
export type PrivyLinkedAccount =
  | PrivyWalletAccount
  | PrivyEmailAccount
  | PrivySocialAccount
  | PrivyPhoneAccount;

/**
 * Wallet account (embedded wallet)
 */
export interface PrivyWalletAccount {
  type: 'wallet';
  address: string;
  chainType: ChainType;
  walletClient: 'privy';
  imported: boolean;
  delegated: boolean;
}

/**
 * Email account
 */
export interface PrivyEmailAccount {
  type: 'email';
  address: string;
  verified: boolean;
}

/**
 * Social account
 */
export interface PrivySocialAccount {
  type: 'google' | 'twitter' | 'discord' | 'github' | 'apple' | 'linkedin' | 'tiktok' | 'farcaster';
  subject: string;
  email?: string;
  name?: string;
  username?: string;
  verified: boolean;
}

/**
 * Phone account
 */
export interface PrivyPhoneAccount {
  type: 'phone';
  number: string;
  verified: boolean;
}

/**
 * Privy authentication state
 */
export interface PrivyAuthState {
  authenticated: boolean;
  ready: boolean;
  user: PrivyUser | null;
}

/**
 * Transaction signing request
 */
export interface SignTransactionRequest {
  chainId: string;
  address: string;
  transaction: string; // Hex encoded transaction
}

/**
 * Transaction signing response
 */
export interface SignTransactionResponse {
  signature: string; // Hex encoded signature
}

/**
 * Message signing request
 */
export interface SignMessageRequest {
  address: string;
  message: string;
}

/**
 * Message signing response
 */
export interface SignMessageResponse {
  signature: string;
}
