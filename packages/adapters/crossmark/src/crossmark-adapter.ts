/**
 * Crossmark Adapter for XRPL
 */

import sdk from '@crossmarkio/sdk';
import type {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  Transaction,
  SignedTransaction,
  SignedMessage,
  SubmittedTransaction,
} from '@xrpl-connect/core';
import { createWalletError, STANDARD_NETWORKS } from '@xrpl-connect/core';

/**
 * Crossmark adapter options
 */
export interface CrossmarkAdapterOptions {
  // Currently no specific options needed for Crossmark
}

/**
 * Crossmark adapter implementation
 */
export class CrossmarkAdapter implements WalletAdapter {
  readonly id = 'crossmark';
  readonly name = 'Crossmark';
  readonly icon = 'https://crossmark.io/assets/logo.svg';
  readonly url = 'https://crossmark.io';

  private currentAccount: AccountInfo | null = null;

  constructor(_options: CrossmarkAdapterOptions = {}) {
    // Options not currently used
  }

  /**
   * Check if Crossmark is installed
   */
  async isAvailable(): Promise<boolean> {
    try {
      return typeof window !== 'undefined' && typeof sdk !== 'undefined';
    } catch {
      return false;
    }
  }

  /**
   * Connect to Crossmark wallet
   */
  async connect(options?: ConnectOptions): Promise<AccountInfo> {
    try {
      // Check if Crossmark is available
      const available = await this.isAvailable();
      if (!available) {
        throw createWalletError.notInstalled(this.name);
      }

      // Determine network
      const network = this.resolveNetwork(options?.network);

      // Generate a random hash for signing
      const hash = this.generateRandomHash();

      // Request sign-in from Crossmark
      const signInResponse = await sdk.methods.signInAndWait(hash);

      if (!signInResponse || !signInResponse.response || !signInResponse.response.data) {
        throw new Error('Failed to sign in with Crossmark');
      }

      const { address, publicKey } = signInResponse.response.data;

      if (!address) {
        throw new Error('No address returned from Crossmark');
      }

      this.currentAccount = {
        address,
        publicKey,
        network,
      };

      return this.currentAccount;
    } catch (error) {
      throw createWalletError.connectionFailed(this.name, error as Error);
    }
  }

  /**
   * Disconnect from Crossmark
   */
  async disconnect(): Promise<void> {
    this.currentAccount = null;
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
   * Sign a transaction
   */
  async sign(transaction: Transaction): Promise<SignedTransaction> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      // Ensure Account field is set
      const txToSign = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      };

      // Request signature from Crossmark
      const signResponse = await sdk.methods.signAndWait(txToSign as any);

      if (!signResponse || !signResponse.response || !signResponse.response.data) {
        throw new Error('Failed to sign transaction with Crossmark');
      }

      const { txBlob } = signResponse.response.data;

      return {
        hash: '',
        tx_blob: txBlob,
      };
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
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);

      // Crossmark doesn't have a dedicated signMessage method
      // We can use signInAndWait with the message as the hash
      const signResponse = await sdk.methods.signInAndWait(messageStr);

      if (!signResponse || !signResponse.response || !signResponse.response.data) {
        throw new Error('Failed to sign message with Crossmark');
      }

      const { signature, publicKey } = signResponse.response.data;

      return {
        message: messageStr,
        signature: signature || '',
        publicKey: publicKey || this.currentAccount.publicKey || '',
      };
    } catch (error) {
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Submit a transaction to the ledger
   * This combines signing and submission in one step
   */
  async submit(transaction: Transaction): Promise<SubmittedTransaction> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      // Ensure Account field is set
      const txToSubmit = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      };

      // First sign the transaction
      const signResponse = await sdk.methods.signAndWait(txToSubmit as any);

      if (!signResponse || !signResponse.response || !signResponse.response.data) {
        throw new Error('Failed to sign transaction with Crossmark');
      }

      const { txBlob } = signResponse.response.data;

      // Then submit the signed transaction
      const id = sdk.sync.submit(this.currentAccount.address, txBlob);

      return {
        hash: '',
        id: id || '',
      };
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('reject')) {
        throw createWalletError.signRejected();
      }
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

  /**
   * Generate a random hash for signing
   */
  private generateRandomHash(): string {
    const array = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
