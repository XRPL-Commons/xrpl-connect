/**
 * Web3Auth Adapter for XRPL
 * Provides social login (Google, Twitter, Discord, etc.) using Web3Auth
 */

import { Web3Auth, WEB3AUTH_NETWORK } from '@web3auth/modal';
import type { IProvider } from '@web3auth/base';
import { CHAIN_NAMESPACES } from '@web3auth/base';
import { XrplPrivateKeyProvider } from '@web3auth/xrpl-provider';
import type { Payment } from 'xrpl';
import { convertStringToHex } from 'xrpl';
import type {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  Transaction,
  SignedMessage,
  SubmittedTransaction,
} from '@xrpl-connect/core';
import { createWalletError, STANDARD_NETWORKS } from '@xrpl-connect/core';

/**
 * Web3Auth network type
 */
export type Web3AuthNetworkType = 'mainnet' | 'testnet' | 'devnet';

/**
 * Web3Auth adapter options
 */
export interface Web3AuthAdapterOptions {
  /** Web3Auth Client ID from dashboard */
  clientId: string;
  /** Web3Auth network (defaults to mainnet) */
  web3AuthNetwork?: Web3AuthNetworkType;
  /** Chain configuration override */
  chainConfig?: {
    chainNamespace: 'other';
    chainId: string;
    rpcTarget: string;
    wsTarget?: string;
    displayName?: string;
    blockExplorer?: string;
    ticker?: string;
    tickerName?: string;
  };
}

/**
 * Web3Auth adapter implementation for XRPL
 */
export class Web3AuthAdapter implements WalletAdapter {
  readonly id = 'web3auth';
  readonly name = 'Web3Auth';
  readonly icon =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iIzAwQThFQSIvPgo8cGF0aCBkPSJNMjAgOEwxMiAyMEgyMEwyOCAyMEwyMCA4WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTEyIDIySDE2TDIwIDMwTDI0IDIySDI4TDIwIDM0TDEyIDIyWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==';
  readonly url = 'https://web3auth.io';

  private web3auth: Web3Auth | null = null;
  private provider: IProvider | null = null;
  private currentAccount: AccountInfo | null = null;
  private options: Web3AuthAdapterOptions;
  private initialized = false;

  constructor(options: Web3AuthAdapterOptions) {
    if (!options.clientId) {
      throw new Error('Web3Auth clientId is required');
    }
    this.options = options;
  }

  /**
   * Initialize Web3Auth instance
   * Post V10, Web3Auth doesn't need additional XRPL provider setup - it's handled on the Dashboard
   */
  private async initialize(): Promise<void> {
    if (this.initialized && this.web3auth) {
      console.log('[Web3AuthAdapter] Already initialized, skipping...');
      return;
    }

    try {
      console.log('[Web3AuthAdapter] Initializing Web3Auth...');
      console.log('[Web3AuthAdapter] Options:', {
        clientId: this.options.clientId?.substring(0, 20) + '...',
        web3AuthNetwork: this.options.web3AuthNetwork,
        chainConfig: this.options.chainConfig,
      });

      // Map Web3Auth network type to Web3Auth network constant
      const networkMap = {
        mainnet: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
        testnet: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
        devnet: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
      };

      const web3AuthNetwork = networkMap[this.options.web3AuthNetwork || 'devnet'];
      console.log('[Web3AuthAdapter] Using Web3Auth network:', web3AuthNetwork);

      // Configure XRPL chain
      const chainConfig = this.options.chainConfig || {
        chainNamespace: CHAIN_NAMESPACES.OTHER,
        chainId: '0x1', // XRPL doesn't use numeric chain IDs, this is just for Web3Auth
        rpcTarget: 'https://s.devnet.rippletest.net:51234', // Testnet RPC
        displayName: 'XRPL Testnet',
        blockExplorer: 'https://testnet.xrpl.org',
        ticker: 'XRP',
        tickerName: 'XRP',
      };
      console.log('[Web3AuthAdapter] XRPL chain config:', chainConfig);

      // Create XRPL provider
      const privateKeyProvider = new XrplPrivateKeyProvider({
        config: {
          chainConfig,
        },
      });
      console.log('[Web3AuthAdapter] Created XrplPrivateKeyProvider');

      // Create Web3Auth instance with XRPL provider
      const web3AuthConfig: any = {
        clientId: this.options.clientId,
        web3AuthNetwork,
        privateKeyProvider,
      };
      console.log('[Web3AuthAdapter] Creating Web3Auth instance with XRPL provider');

      this.web3auth = new Web3Auth(web3AuthConfig);

      console.log('[Web3AuthAdapter] Calling web3auth.init()...');
      await this.web3auth.init();
      console.log('[Web3AuthAdapter] Web3Auth initialized successfully');
      console.log('[Web3AuthAdapter] Web3Auth provider after init:', this.web3auth.provider);

      this.initialized = true;
    } catch (error) {
      console.error('[Web3AuthAdapter] Initialization error:', error);
      console.error(
        '[Web3AuthAdapter] Error details:',
        error instanceof Error ? error.message : error
      );
      console.error('[Web3AuthAdapter] Error stack:', error instanceof Error ? error.stack : 'N/A');
      this.initialized = false;
      this.web3auth = null;
      throw error;
    }
  }

  /**
   * Web3Auth is always "available" (doesn't require extension)
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Connect using Web3Auth social login
   */
  async connect(options?: ConnectOptions): Promise<AccountInfo> {
    try {
      // Initialize if not already done
      await this.initialize();
      console.log('[Web3AuthAdapter] Web3Auth instance:', this.web3auth);
      console.log('[Web3AuthAdapter] Web3Auth connected:', this.web3auth?.connected);
      console.log('[Web3AuthAdapter] Web3Auth status:', this.web3auth?.status);

      if (!this.web3auth) {
        throw new Error('Web3Auth not initialized');
      }

      // Connect via Web3Auth modal
      console.log('[Web3AuthAdapter] Calling web3auth.connect()...');
      const a = await this.web3auth.connect();
      console.log(a);
      this.provider = this.web3auth.provider;
      console.log('[Web3AuthAdapter] Provider returned:', this.provider);
      console.log('[Web3AuthAdapter] Provider type:', typeof this.provider);
      console.log(
        '[Web3AuthAdapter] Provider keys:',
        this.provider ? Object.keys(this.provider) : 'null'
      );
      console.log(
        '[Web3AuthAdapter] Provider.request method exists:',
        this.provider && typeof this.provider.request === 'function'
      );

      if (!this.provider) {
        throw new Error('Failed to connect to Web3Auth');
      }

      // Check what methods are available on the provider
      if (typeof this.provider.request === 'function') {
        console.log(
          '[Web3AuthAdapter] Provider.request is available, attempting xrpl_getAccounts...'
        );
      } else {
        console.error('[Web3AuthAdapter] Provider.request is NOT available!');
        console.log(
          '[Web3AuthAdapter] Available provider methods:',
          Object.getOwnPropertyNames(Object.getPrototypeOf(this.provider))
        );
      }

      // Get accounts from XRPL provider
      console.log('[Web3AuthAdapter] Calling provider.request({ method: "xrpl_getAccounts" })...');
      console.log(
        'shshshshhshhshshshhshsh',
        this.provider.request({
          method: 'xrpl_getAccounts',
        })
      );
      console.log(this.provider);
      const accounts = (await this.provider.request({
        method: 'xrpl_getAccounts',
      })) as any;
      console.log('[Web3AuthAdapter] Accounts received:', accounts);
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      console.log('[Web3AuthAdapter] Selected address:', address);

      // Determine network
      const network = this.resolveNetwork(options?.network);
      console.log('[Web3AuthAdapter] Network:', network);

      this.currentAccount = {
        address,
        network,
      };

      console.log('[Web3AuthAdapter] Connection successful:', this.currentAccount);
      return this.currentAccount;
    } catch (error) {
      console.error('[Web3AuthAdapter] Connection error:', error);
      console.error('[Web3AuthAdapter] Error stack:', error instanceof Error ? error.stack : 'N/A');

      // Check if user rejected
      if (error instanceof Error) {
        if (error.message.includes('User closed') || error.message.includes('User rejected')) {
          throw createWalletError.connectionRejected(this.name);
        }
      }
      throw createWalletError.connectionFailed(this.name, error as Error);
    }
  }

  /**
   * Disconnect from Web3Auth
   */
  async disconnect(): Promise<void> {
    try {
      if (this.web3auth?.connected) {
        await this.web3auth.logout();
      }
      this.provider = null;
      this.currentAccount = null;
    } catch (error) {
      // Silently handle disconnect errors
      console.warn('Web3Auth disconnect error:', error);
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
   * Sign and optionally submit a transaction
   */
  async signAndSubmit(
    transaction: Transaction,
    submit: boolean = true
  ): Promise<SubmittedTransaction> {
    if (!this.currentAccount || !this.provider) {
      throw createWalletError.notConnected();
    }

    try {
      // Ensure Account field is set
      const tx = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      } as Payment;

      if (submit) {
        // Submit transaction (signs and submits)
        const result = (await this.provider.request({
          method: 'xrpl_submitTransaction',
          params: {
            transaction: tx,
          },
        })) as { tx_json: { hash: string } };

        if (!result || !result.tx_json?.hash) {
          throw new Error('Failed to submit transaction');
        }

        return {
          hash: result.tx_json.hash,
        };
      } else {
        // Just sign the transaction
        const result = (await this.provider.request({
          method: 'xrpl_signTransaction',
          params: {
            transaction: tx,
          },
        })) as { tx_blob: string; hash: string };

        if (!result) {
          throw new Error('Failed to sign transaction');
        }

        return {
          hash: result.hash || '',
          tx_blob: result.tx_blob,
        };
      }
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('reject')) {
        throw createWalletError.signRejected();
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign a message
   */
  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    if (!this.currentAccount || !this.provider) {
      throw createWalletError.notConnected();
    }

    try {
      const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);

      // Convert message to hex
      const hexMsg = convertStringToHex(messageStr);

      // Sign message
      const result = (await this.provider.request({
        method: 'xrpl_signMessage',
        params: {
          message: hexMsg,
        },
      })) as { signature: string };

      if (!result || !result.signature) {
        throw new Error('Failed to sign message');
      }

      return {
        message: messageStr,
        signature: result.signature,
        publicKey: this.currentAccount.publicKey || '',
      };
    } catch (error) {
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Resolve network configuration
   */
  private resolveNetwork(config?: ConnectOptions['network']): NetworkInfo {
    if (!config) {
      return STANDARD_NETWORKS.mainnet;
    }

    if (typeof config === 'string') {
      const network = STANDARD_NETWORKS[config];
      if (!network) {
        throw createWalletError.unknown(`Unknown network: ${config}`);
      }
      return network;
    }

    return config;
  }
}
