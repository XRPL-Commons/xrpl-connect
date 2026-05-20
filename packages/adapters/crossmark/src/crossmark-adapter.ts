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
import { createWalletError, resolveNetwork } from '@xrpl-connect/core';
import iconSvg from './assets/icon.svg';

const ICON_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(iconSvg)}`;

/**
 * Crossmark adapter options
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CrossmarkAdapterOptions {
  // Currently no specific options needed for Crossmark
}

/**
 * Crossmark adapter implementation
 */
export class CrossmarkAdapter implements WalletAdapter {
  readonly id = 'crossmark';
  readonly name = 'Crossmark';
  readonly icon = ICON_DATA_URL;
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
      if (!sdk.sync.isInstalled()) {
        return false;
      }
      return true;
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
      const network = resolveNetwork(options?.network);

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
   * Sign a transaction without submitting it to the ledger
   * @param transaction - The transaction to sign
   */
  async sign(transaction: Transaction): Promise<SignedTransaction> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      const tx = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      };
      const signResponse = await sdk.methods.signAndWait(tx as any);

      if (!signResponse.response.data.txBlob) {
        throw new Error('Failed to sign transaction with Crossmark');
      }
      return {
        hash: '',
        tx_blob: signResponse.response.data.txBlob,
      };
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('reject')) {
        throw createWalletError.signRejected();
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign and submit a transaction to the ledger
   * @param transaction - The transaction to sign and submit
   */
  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      const tx = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      };
      const signResponse = await sdk.methods.signAndSubmitAndWait(tx as any);

      if (!signResponse.response.data.resp.result.hash) {
        throw new Error('Failed to sign transaction with Crossmark');
      }
      return {
        hash: signResponse.response.data.resp.result.hash,
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
