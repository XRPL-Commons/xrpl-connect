/**
 * Wrapper around Privy SDK for easier integration
 */

import Privy, { LocalStorage, getUserEmbeddedEthereumWallet, getEntropyDetailsFromUser } from '@privy-io/js-sdk-core';
import type { User } from '@privy-io/api-types';
import type { Chain } from 'viem';
import type {
  PrivyAdapterConfig,
  PrivyUser,
  PrivyWalletAccount,
  SignTransactionRequest,
  SignTransactionResponse,
  SignMessageRequest,
  SignMessageResponse,
} from './types';

/**
 * Privy Client Wrapper
 * Wraps the Privy JS SDK for authentication and wallet operations
 */
export class PrivyClientWrapper {
  private _appId: string;
  private _config: PrivyAdapterConfig;
  private privy: Privy | null = null;
  private user: PrivyUser | null = null;
  private authenticated: boolean = false;
  private ready: boolean = false;
  private iframe: HTMLIFrameElement | null = null;

  constructor(config: PrivyAdapterConfig) {
    this._appId = config.appId;
    this._config = config;
  }

  /**
   * Initialize Privy client
   * Creates the Privy instance and sets up the embedded wallet iframe
   */
  async initialize(): Promise<void> {
    if (this.privy) {
      this.ready = true;
      return; // Already initialized
    }

    // Initialize Privy client
    // Note: supportedChains requires at least one chain in newer versions
    // We'll use a default Ethereum mainnet chain for now
    const defaultChain: Chain = {
      id: 1,
      name: 'Ethereum',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: ['https://eth.llamarpc.com'] },
        public: { http: ['https://eth.llamarpc.com'] }
      }
    } as Chain;

    this.privy = new Privy({
      appId: this._appId,
      storage: new LocalStorage(),
      supportedChains: [defaultChain],
    });

    // Initialize the SDK
    await this.privy.initialize();

    // Create and mount iframe for embedded wallets
    const iframeUrl = this.privy.embeddedWallet.getURL();
    this.iframe = document.createElement('iframe');
    this.iframe.src = iframeUrl;
    this.iframe.style.display = 'none'; // Hidden iframe
    this.iframe.style.position = 'fixed';
    this.iframe.style.width = '1px';
    this.iframe.style.height = '1px';
    this.iframe.style.top = '-9999px';
    this.iframe.style.left = '-9999px';
    document.body.appendChild(this.iframe);

    // Wait for iframe to load
    await new Promise<void>((resolve) => {
      if (this.iframe) {
        this.iframe.onload = () => resolve();
      }
    });

    // Set up message posting
    if (this.iframe.contentWindow) {
      const poster = {
        postMessage: (message: any, targetOrigin: string, transfer?: Transferable) => {
          this.iframe?.contentWindow?.postMessage(message, targetOrigin, transfer as any);
        },
        reload: () => {
          this.iframe?.contentWindow?.location.reload();
        },
      };
      this.privy.setMessagePoster(poster);
    }

    this.ready = true;
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.authenticated;
  }

  /**
   * Get current user
   */
  getUser(): PrivyUser | null {
    return this.user;
  }

  /**
   * Login with email
   */
  async loginWithEmail(email: string, code: string): Promise<PrivyUser> {
    if (!this.privy) {
      throw new Error('Privy client not initialized');
    }

    const result = await this.privy.auth.email.loginWithCode(email, code);
    this.user = this.convertUser(result.user);
    this.authenticated = true;
    return this.user;
  }

  /**
   * Send email code
   */
  async sendEmailCode(email: string): Promise<void> {
    if (!this.privy) {
      throw new Error('Privy client not initialized');
    }

    await this.privy.auth.email.sendCode(email);
  }

  /**
   * Login with SMS
   */
  async loginWithSMS(phoneNumber: string, code: string): Promise<PrivyUser> {
    if (!this.privy) {
      throw new Error('Privy client not initialized');
    }

    const result = await this.privy.auth.phone.loginWithCode(phoneNumber, code);
    this.user = this.convertUser(result.user);
    this.authenticated = true;
    return this.user;
  }

  /**
   * Send SMS code
   */
  async sendSMSCode(phoneNumber: string): Promise<void> {
    if (!this.privy) {
      throw new Error('Privy client not initialized');
    }

    await this.privy.auth.phone.sendCode(phoneNumber);
  }

  /**
   * Login with OAuth (social login)
   * Opens OAuth flow for the specified provider
   */
  async loginWithOAuth(provider: string): Promise<string> {
    if (!this.privy) {
      throw new Error('Privy client not initialized');
    }

    // Generate OAuth URL using proper type
    const redirectURI = `${window.location.origin}/privy-oauth-callback`;

    // Use generateURL method which is the correct API
    const result = await this.privy.auth.oauth.generateURL(provider as any, redirectURI);

    // Return the authorization URL - the state is embedded in the URL
    return result.url;
  }

  /**
   * Complete OAuth login with code
   */
  async completeOAuthLogin(code: string, state: string): Promise<PrivyUser> {
    if (!this.privy) {
      throw new Error('Privy client not initialized');
    }

    const result = await this.privy.auth.oauth.loginWithCode(code, state);
    this.user = this.convertUser(result.user);
    this.authenticated = true;
    return this.user;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    this.user = null;
    this.authenticated = false;

    // Clean up iframe
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
      this.iframe = null;
    }
  }

  /**
   * Get embedded wallet for the current user
   */
  getEmbeddedWallet(): PrivyWalletAccount | null {
    if (!this.user) {
      return null;
    }

    // Find the embedded wallet account
    const walletAccount = this.user.linkedAccounts.find(
      (account): account is PrivyWalletAccount =>
        account.type === 'wallet' && account.walletClient === 'privy'
    );

    return walletAccount || null;
  }

  /**
   * Get wallet address (shorthand)
   */
  getWalletAddress(): string | null {
    const wallet = this.getEmbeddedWallet();
    return wallet?.address || null;
  }

  /**
   * Create embedded wallet for user
   */
  async createEmbeddedWallet(): Promise<PrivyWalletAccount> {
    if (!this.privy) {
      throw new Error('Privy client not initialized');
    }

    if (!this.authenticated || !this.user) {
      throw new Error('User not authenticated');
    }

    if (this.hasEmbeddedWallet()) {
      throw new Error('User already has an embedded wallet');
    }

    // Create Ethereum wallet (secp256k1 for XRPL compatibility)
    // The create method doesn't take chainType - it creates Ethereum by default
    const result = await this.privy.embeddedWallet.create({});

    this.user = this.convertUser(result.user);

    const wallet = this.getEmbeddedWallet();
    if (!wallet) {
      throw new Error('Failed to create embedded wallet');
    }

    return wallet;
  }

  /**
   * Sign a transaction using Privy's embedded wallet
   * The transaction should be hex-encoded
   */
  async signTransaction(request: SignTransactionRequest): Promise<SignTransactionResponse> {
    if (!this.privy) {
      throw new Error('Privy client not initialized');
    }

    if (!this.authenticated || !this.user) {
      throw new Error('User not authenticated');
    }

    const wallet = this.getEmbeddedWallet();
    if (!wallet) {
      throw new Error('No embedded wallet found');
    }

    // Get the embedded Ethereum wallet and entropy details
    const embeddedWallet = getUserEmbeddedEthereumWallet(this.user as unknown as User);
    if (!embeddedWallet) {
      throw new Error('No embedded Ethereum wallet found');
    }

    const entropyDetails = getEntropyDetailsFromUser(this.user as unknown as User);
    if (!entropyDetails) {
      throw new Error('No entropy details found for user');
    }

    const { entropyId, entropyIdVerifier } = entropyDetails;

    // Get Ethereum provider from Privy
    const provider = await this.privy.embeddedWallet.getEthereumProvider({
      wallet: embeddedWallet,
      entropyId,
      entropyIdVerifier,
    });

    // Sign the transaction hash
    const signature = await provider.request({
      method: 'personal_sign',
      params: [request.transaction, wallet.address],
    });

    return {
      signature: signature as string,
    };
  }

  /**
   * Sign a message using Privy's embedded wallet
   */
  async signMessage(request: SignMessageRequest): Promise<SignMessageResponse> {
    if (!this.privy) {
      throw new Error('Privy client not initialized');
    }

    if (!this.authenticated || !this.user) {
      throw new Error('User not authenticated');
    }

    const wallet = this.getEmbeddedWallet();
    if (!wallet) {
      throw new Error('No embedded wallet found');
    }

    // Get the embedded Ethereum wallet and entropy details
    const embeddedWallet = getUserEmbeddedEthereumWallet(this.user as unknown as User);
    if (!embeddedWallet) {
      throw new Error('No embedded Ethereum wallet found');
    }

    const entropyDetails = getEntropyDetailsFromUser(this.user as unknown as User);
    if (!entropyDetails) {
      throw new Error('No entropy details found for user');
    }

    const { entropyId, entropyIdVerifier } = entropyDetails;

    // Get Ethereum provider from Privy
    const provider = await this.privy.embeddedWallet.getEthereumProvider({
      wallet: embeddedWallet,
      entropyId,
      entropyIdVerifier,
    });

    // Sign the message
    const signature = await provider.request({
      method: 'personal_sign',
      params: [request.message, wallet.address],
    });

    return {
      signature: signature as string,
    };
  }

  /**
   * Get the chain type of the embedded wallet
   */
  getChainType(): string | null {
    const wallet = this.getEmbeddedWallet();
    return wallet?.chainType || null;
  }

  /**
   * Check if user has an embedded wallet
   */
  hasEmbeddedWallet(): boolean {
    return this.getEmbeddedWallet() !== null;
  }

  /**
   * Convert Privy API User to our PrivyUser type
   */
  private convertUser(apiUser: User): PrivyUser {
    return apiUser as unknown as PrivyUser;
  }
}
