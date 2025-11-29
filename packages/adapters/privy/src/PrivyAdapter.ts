/**
 * Privy Wallet Adapter
 * Social login with embedded wallets for XRPL
 */

import type {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  Transaction,
  SignedMessage,
  SubmittedTransaction,
} from '@xrpl-connect/core';
import { STANDARD_NETWORKS } from '@xrpl-connect/core';
import { createWalletError, createLogger } from '@xrpl-connect/core';
import { Client } from 'xrpl';
import { PrivyClientWrapper } from './PrivyClientWrapper';
import { XRPLAddressConverter } from './XRPLAddressConverter';
import { XRPLTransactionSigner } from './XRPLTransactionSigner';
import type { PrivyAdapterConfig, AuthMethod } from './types';

/**
 * Logger instance for Privy adapter
 */
const logger = createLogger('[Privy]');

/**
 * Privy adapter options (extends config with connect-time options)
 */
export interface PrivyAdapterOptions extends Partial<PrivyAdapterConfig> {
  /**
   * Callback when authentication UI should be shown
   */
  onAuthRequired?: (method: AuthMethod) => void;

  /**
   * Callback for authentication state changes
   */
  onAuthStateChange?: (authenticated: boolean) => void;
}

/**
 * Privy wallet adapter implementation
 * Supports social login (Google, Twitter, Discord, etc.) with embedded wallets
 */
export class PrivyAdapter implements WalletAdapter {
  readonly id = 'privy';
  readonly name = 'Privy';
  readonly icon =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNiIgZmlsbD0iIzQ3NDdGRiIvPgo8cGF0aCBkPSJNMTIgNkM5LjIzODU4IDYgNyA4LjIzODU4IDcgMTFWMTNDNyAxNS43NjE0IDkuMjM4NTggMTggMTIgMThDMTQuNzYxNCAxOCAxNyAxNS43NjE0IDE3IDEzVjExQzE3IDguMjM4NTggMTQuNzYxNCA2IDEyIDZaIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8cGF0aCBkPSJNMTIgMTBWMTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEuNSIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==';
  readonly url = 'https://privy.io';

  private client: PrivyClientWrapper | null = null;
  private signer: XRPLTransactionSigner | null = null;
  private xrplClient: Client | null = null;
  private currentAccount: AccountInfo | null = null;
  private config: PrivyAdapterConfig;
  private options: PrivyAdapterOptions;

  constructor(options: PrivyAdapterOptions) {
    if (!options.appId) {
      throw new Error('Privy App ID is required');
    }

    this.config = {
      appId: options.appId,
      authMethods: options.authMethods || ['social', 'email', 'wallet'],
      socialProviders: options.socialProviders || ['google', 'twitter', 'discord'],
      chainType: options.chainType || 'ethereum', // secp256k1 for XRPL
      createWalletOnLogin: options.createWalletOnLogin || 'users-without-wallets',
      appearance: options.appearance,
    };

    this.options = options;
  }

  /**
   * Get authentication methods configured for this adapter
   */
  getAuthMethods(): string[] {
    return this.config.authMethods || [];
  }

  /**
   * Get social providers configured for this adapter
   */
  getSocialProviders(): string[] {
    return this.config.socialProviders || [];
  }

  /**
   * Privy is always available (works in any browser)
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Connect to Privy wallet
   * Opens authentication flow based on configured methods
   */
  async connect(options?: ConnectOptions): Promise<AccountInfo> {
    try {
      // Initialize Privy client if not already done
      if (!this.client) {
        this.client = new PrivyClientWrapper(this.config);
        await this.client.initialize();
      }

      // Trigger authentication
      logger.debug('Starting Privy authentication...', options);

      // Check if already authenticated
      if (!this.client.isAuthenticated()) {
        // Get auth method from options (passed from UI)
        const authMethod = (options as any)?.authMethod || this.determineAuthMethod();
        const provider = (options as any)?.provider;

        logger.debug('Auth method:', authMethod, 'Provider:', provider);

        // Handle different authentication methods
        if (authMethod === 'social' && provider) {
          // Social login via OAuth
          const oauthUrl = await this.client.loginWithOAuth(provider);

          // Open OAuth URL in popup
          const popup = window.open(oauthUrl, 'privy-oauth', 'width=500,height=700');

          if (!popup) {
            throw new Error('Failed to open OAuth popup. Please allow popups for this site.');
          }

          // Wait for OAuth callback (simplified - in production you'd handle the redirect properly)
          // For now, we'll throw an error to indicate this needs proper OAuth flow setup
          throw new Error(
            'Privy OAuth flow requires proper redirect handling. ' +
            'Please set up an OAuth callback route at /privy-oauth-callback ' +
            'that calls completeOAuthLogin(code, state) with the returned parameters.'
          );
        } else if (authMethod === 'email') {
          // Email login - would need to show email input UI
          throw new Error(
            'Email authentication requires UI for email input and code verification. ' +
            'Use sendEmailCode(email) and loginWithEmail(email, code) methods.'
          );
        } else if (authMethod === 'sms') {
          // SMS login - would need to show phone input UI
          throw new Error(
            'SMS authentication requires UI for phone input and code verification. ' +
            'Use sendSMSCode(phone) and loginWithSMS(phone, code) methods.'
          );
        } else {
          // Notify callback that auth is required
          if (this.options.onAuthRequired) {
            this.options.onAuthRequired(authMethod);
          }

          throw new Error(
            'Authentication method not specified or not supported. ' +
            'Please select a valid authentication method from the UI.'
          );
        }
      }

      logger.debug('User authenticated');

      // Get embedded wallet
      let wallet = this.client.getEmbeddedWallet();
      if (!wallet) {
        // Create wallet if user doesn't have one
        if (this.config.createWalletOnLogin === 'all-users' ||
            this.config.createWalletOnLogin === 'users-without-wallets') {
          logger.debug('Creating embedded wallet for user...');
          wallet = await this.client.createEmbeddedWallet();
        } else {
          throw createWalletError.connectionFailed(
            this.name,
            new Error('User does not have an embedded wallet')
          );
        }
      }

      // Convert Ethereum address to XRPL address
      const xrplAddress = XRPLAddressConverter.convertToXRPL(
        wallet.address,
        this.config.chainType || 'ethereum'
      );

      logger.debug('Converted wallet address to XRPL:', xrplAddress);

      // Resolve network
      const network = this.resolveNetwork(options?.network);

      // Connect to XRPL network
      await this.connectToXRPL(network);

      // Set current account
      this.currentAccount = {
        address: xrplAddress,
        publicKey: wallet.address, // Store original public key
        network,
      };

      // Initialize signer
      if (this.client && this.xrplClient) {
        this.signer = new XRPLTransactionSigner(this.client, this.xrplClient);
      }

      // Notify auth state change
      if (this.options.onAuthStateChange) {
        this.options.onAuthStateChange(true);
      }

      logger.debug('Connection successful:', this.currentAccount);

      return this.currentAccount;
    } catch (error) {
      logger.error('Connection failed:', error);
      throw createWalletError.connectionFailed(this.name, error as Error);
    }
  }

  /**
   * Disconnect from Privy
   */
  async disconnect(): Promise<void> {
    try {
      // Logout from Privy
      if (this.client) {
        await this.client.logout();
      }

      // Disconnect from XRPL
      if (this.xrplClient && this.xrplClient.isConnected()) {
        await this.xrplClient.disconnect();
      }

      // Clear state
      this.currentAccount = null;
      this.signer = null;
      this.xrplClient = null;

      // Notify auth state change
      if (this.options.onAuthStateChange) {
        this.options.onAuthStateChange(false);
      }

      logger.debug('Disconnected successfully');
    } catch (error) {
      logger.error('Disconnect error:', error);
      throw error;
    }
  }

  /**
   * Get current account
   */
  async getAccount(): Promise<AccountInfo | null> {
    return this.currentAccount;
  }

  /**
   * Get current network
   */
  async getNetwork(): Promise<NetworkInfo> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }
    return this.currentAccount.network;
  }

  /**
   * Sign and submit a transaction
   */
  async signAndSubmit(transaction: Transaction, submit: boolean = true): Promise<SubmittedTransaction> {
    if (!this.signer) {
      throw createWalletError.notConnected();
    }

    try {
      return await this.signer.signAndSubmit(transaction, submit);
    } catch (error) {
      logger.error('Transaction signing failed:', error);
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign a message
   */
  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    if (!this.signer) {
      throw createWalletError.notConnected();
    }

    try {
      return await this.signer.signMessage(message);
    } catch (error) {
      logger.error('Message signing failed:', error);
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Resolve network configuration
   */
  private resolveNetwork(network?: string | NetworkInfo): NetworkInfo {
    if (!network) {
      // Default to testnet for development
      return (STANDARD_NETWORKS as any).testnet;
    }

    if (typeof network === 'string') {
      const standardNetwork = (STANDARD_NETWORKS as any)[network];
      if (standardNetwork) {
        return standardNetwork;
      }
      throw new Error(`Unknown network: ${network}`);
    }

    return network;
  }

  /**
   * Connect to XRPL network
   */
  private async connectToXRPL(network: NetworkInfo): Promise<void> {
    logger.debug('Connecting to XRPL network:', network.name);

    this.xrplClient = new Client(network.wss);

    try {
      await this.xrplClient.connect();
      logger.debug('Connected to XRPL successfully');
    } catch (error) {
      logger.error('Failed to connect to XRPL:', error);
      throw new Error(`Failed to connect to XRPL network: ${error}`);
    }
  }

  /**
   * Determine which authentication method to use based on configuration
   */
  private determineAuthMethod(): AuthMethod {
    const methods = this.config.authMethods || [];

    // Prefer social login if available
    if (methods.includes('social')) {
      return 'social';
    }

    // Fall back to email
    if (methods.includes('email')) {
      return 'email';
    }

    // Fall back to wallet
    if (methods.includes('wallet')) {
      return 'wallet';
    }

    // Fall back to SMS
    if (methods.includes('sms')) {
      return 'sms';
    }

    // Default to social
    return 'social';
  }
}
