/**
 * WalletConnect Adapter for XRPL using WalletConnect Sign Client v2
 */

import SignClient from '@walletconnect/sign-client';
import type { SignClientTypes, SessionTypes } from '@walletconnect/types';
import { WalletConnectModal } from '@walletconnect/modal';
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
 * XRPL methods supported by WalletConnect
 */
export enum XRPLMethod {
  SIGN_TRANSACTION = 'xrpl_signTransaction',
  SIGN_TRANSACTION_FOR = 'xrpl_signTransactionFor', // Multi-sig
}

/**
 * WalletConnect adapter options
 */
export interface WalletConnectAdapterOptions {
  projectId?: string; // WalletConnect/Reown project ID
  metadata?: SignClientTypes.Metadata; // App metadata
}

/**
 * WalletConnect adapter implementation using Sign Client v2
 */
export class WalletConnectAdapter implements WalletAdapter {
  readonly id = 'walletconnect';
  readonly name = 'WalletConnect';
  readonly icon =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE4NSIgdmlld0JveD0iMCAwIDMwMCAxODUiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik02MS40Mzc1IDM2LjQzNzVDMTA1LjQxMiAtNy41Mzc0NyAxNzguMDg4IC03LjUzNzQ3IDIyMi4wNjIgMzYuNDM3NUwyMjcuNDI4IDQxLjgwMzRDMjI5LjQxNSA0My43OTA5IDIyOS40MTUgNDcuMDQ2NiAyMjcuNDI4IDQ5LjAzNEwxOTUuODQgODAuNjIyQzE5NC44NDcgODEuNjE1MyAxOTMuMjgxIDgxLjYxNTMgMTkyLjI4OCA4MC42MjJMMTgxLjI1IDY5LjU4MzRDMTU0LjkzNyA0My4yNzAzIDExMi41NjMgNDMuMjcwMyA4Ni4yNSA2OS41ODM0TDc0LjE4NzUgODEuNjQ1OEM3My4xOTUzIDgyLjYzODEgNzEuNjI4OSA4Mi42MzgxIDcwLjYzNjcgODEuNjQ1OEwzOS4wNDg0IDUwLjA1NzZDMzcuMDYwOSA0OC4wNzAxIDM3LjA2MDkgNDQuODE0NCAzOS4wNDg0IDQyLjgyNjlMNjEuNDM3NSAzNi40Mzc1Wk0yNTcuODEyIDg4LjQzNzVMMjg1LjU2MiAxMTYuMTg4QzI4Ny41NSAxMTguMTc1IDI4Ny41NSAxMjEuNDMxIDI4NS41NjIgMTIzLjQxOUwyMTYuNjg4IDE5Mi4yOTJDMjE0LjcgMTk0LjI4IDIxMS40NDUgMTk0LjI4IDIwOS40NTcgMTkyLjI5Mkw2MC4xODc1IDQzLjAyMjVDNTguMiA0MS4wMzUgNTguMiAzNy43NzkzIDYwLjE4NzUgMzUuNzkxOEwxMjguMDYyIDMuNDM3NUMxMzAuMDUgMS40NSAxMzMuMzA1IDEuNDUgMTM1LjI5MyAzLjQzNzVMMjU3LjgxMiA4OC40Mzc1WiIgZmlsbD0iIzNiOTljZiIvPgo8L3N2Zz4=';
  readonly url = 'https://walletconnect.com';

  private client: SignClient | null = null;
  private session: SessionTypes.Struct | null = null;
  private modal: WalletConnectModal | null = null;
  private currentAccount: AccountInfo | null = null;
  private options: WalletConnectAdapterOptions;

  constructor(options: WalletConnectAdapterOptions = {}) {
    this.options = options;
  }

  /**
   * WalletConnect is always available (uses QR code)
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Connect to WalletConnect
   */
  async connect(options?: ConnectOptions): Promise<AccountInfo> {
    const projectId = options?.projectId || this.options.projectId;

    if (!projectId) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error(
          'WalletConnect project ID is required. Get one from https://cloud.walletconnect.com or https://dashboard.reown.com'
        )
      );
    }

    try {
      // Determine network
      const network = this.resolveNetwork(options?.network);

      // Initialize SignClient
      this.client = await SignClient.init({
        projectId,
        metadata: this.options.metadata || {
          name: 'XRPL Connect',
          description: 'XRPL Wallet Connection',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://xrpl.org',
          icons: ['https://xrpl.org/favicon.ico'],
        },
      });

      // Prepare namespace for XRPL
      const requiredNamespaces = {
        xrpl: {
          chains: [network.walletConnectId || `xrpl:${network.id}`],
          methods: [XRPLMethod.SIGN_TRANSACTION, XRPLMethod.SIGN_TRANSACTION_FOR, 'xrpl_signMessage'],
          events: ['chainChanged', 'accountsChanged'],
        },
      };

      // Connect and get URI
      const { uri, approval } = await this.client.connect({
        requiredNamespaces,
      });

      if (!uri) {
        throw new Error('Failed to generate WalletConnect URI');
      }

      // Open modal with QR code
      this.modal = new WalletConnectModal({
        projectId,
        chains: [network.walletConnectId || `xrpl:${network.id}`],
      });

      this.modal.openModal({ uri });

      // Wait for approval
      this.session = await approval();

      // Close modal
      this.modal.closeModal();

      // Extract account info from session
      const accounts = this.session.namespaces.xrpl?.accounts || [];
      if (accounts.length === 0) {
        throw new Error('No accounts returned from WalletConnect session');
      }

      // Parse account (format: "xrpl:chainId:rAddress")
      const accountString = accounts[0];
      const address = accountString.split(':')[2];

      this.currentAccount = {
        address,
        network,
      };

      // Set up session event listeners
      this.setupEventListeners();

      return this.currentAccount;
    } catch (error) {
      if (this.modal) {
        this.modal.closeModal();
      }
      throw createWalletError.connectionFailed(this.name, error as Error);
    }
  }

  /**
   * Disconnect from WalletConnect
   */
  async disconnect(): Promise<void> {
    if (!this.client || !this.session) {
      return;
    }

    try {
      await this.client.disconnect({
        topic: this.session.topic,
        reason: {
          code: 6000,
          message: 'User disconnected',
        },
      });
      this.cleanup();
    } catch (error) {
      // Disconnect might fail if already disconnected, that's okay
      this.cleanup();
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
   * Sign and optionally submit a transaction using xrpl_signTransaction method
   * @param transaction - The transaction to sign
   * @param submit - Whether to submit to the ledger (default: true)
   */
  async signAndSubmit(transaction: Transaction, submit: boolean = true): Promise<SubmittedTransaction> {
    if (!this.client || !this.session || !this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      // Ensure Account field is set
      const tx = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      };

      // Request signature/submission via WalletConnect using XRPL RPC format
      const result = await this.client.request({
        topic: this.session.topic,
        chainId: this.currentAccount.network.walletConnectId || `xrpl:${this.currentAccount.network.id}`,
        request: {
          method: XRPLMethod.SIGN_TRANSACTION,
          params: {
            tx_json: tx,
            autofill: true,
            submit, // Controls whether to submit to ledger
          },
        },
      });

      // Result contains tx_json with the transaction
      const resultTx = (result as any).tx_json;

      return {
        hash: resultTx.hash || '',
        tx_blob: resultTx.TxnSignature,
      };
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('reject')) {
        throw createWalletError.signRejected();
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign a message - NOT SUPPORTED
   * WalletConnect does not currently support message signing for XRPL
   */
  async signMessage(_message: string | Uint8Array): Promise<SignedMessage> {
    throw createWalletError.unsupportedMethod(
      'Message signing is not supported via WalletConnect. Please use Xaman, Crossmark, or GemWallet for signing messages.'
    );
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

  /**
   * Setup event listeners for session
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    // Session delete event
    this.client.on('session_delete', () => {
      this.cleanup();
    });

    // Session expire event
    this.client.on('session_expire', () => {
      this.cleanup();
    });
  }

  /**
   * Cleanup adapter state
   */
  private cleanup(): void {
    if (this.modal) {
      this.modal.closeModal();
    }
    this.client = null;
    this.session = null;
    this.modal = null;
    this.currentAccount = null;
  }
}
