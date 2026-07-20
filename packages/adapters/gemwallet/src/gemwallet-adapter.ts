/**
 * GemWallet Adapter for XRPL
 */

import {
  isInstalled,
  getPublicKey,
  signMessage,
  signTransaction,
  submitTransaction,
} from '@gemwallet/api';
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
import { createWalletError, resolveNetwork, TIME, withTimeout } from '@xrpl-connect/core';
import type { SubmittableTransaction } from 'xrpl';
import iconSvg from './assets/icon.svg';

const ICON_DATA_URL = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;

/**
 * GemWallet adapter options
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GemWalletAdapterOptions {
  // Currently no specific options needed for GemWallet
}

/**
 * GemWallet adapter implementation
 */
export class GemWalletAdapter implements WalletAdapter {
  readonly id = 'gemwallet';
  readonly name = 'GemWallet';
  readonly icon = ICON_DATA_URL;
  readonly url = 'https://gemwallet.app';

  private currentAccount: AccountInfo | null = null;

  constructor(_options: GemWalletAdapterOptions = {}) {
    // Options not currently used
  }

  /**
   * Check if GemWallet is installed
   */
  async isAvailable(): Promise<boolean> {
    return withTimeout(
      async () => {
        try {
          const result = await isInstalled();
          return result.result?.isInstalled || false;
        } catch {
          return false;
        }
      },
      TIME.AVAILABILITY_TIMEOUT,
      false
    );
  }

  /**
   * Connect to GemWallet
   */
  async connect(options?: ConnectOptions): Promise<AccountInfo> {
    try {
      // Check if GemWallet is installed
      const available = await this.isAvailable();
      if (!available) {
        throw createWalletError.notInstalled(this.name);
      }

      // Determine network
      const network = resolveNetwork(options?.network);

      // Get public key (which also returns the address)
      const publicKeyResponse = await getPublicKey();

      if (!publicKeyResponse.result || !publicKeyResponse.result.address) {
        throw new Error('Failed to get address from GemWallet');
      }

      const { address, publicKey } = publicKeyResponse.result;

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
   * Disconnect from GemWallet
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

      const signResponse = await signTransaction({
        transaction: tx as SubmittableTransaction,
      });

      if (!signResponse.result) {
        throw new Error('Failed to sign transaction with GemWallet');
      }

      return {
        hash: '',
        tx_blob: signResponse.result.signature || '',
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

      const submitResponse = await submitTransaction({
        transaction: tx as SubmittableTransaction,
      });

      if (!submitResponse.result || !submitResponse.result.hash) {
        throw new Error('Failed to submit transaction with GemWallet');
      }

      return {
        hash: submitResponse.result.hash,
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

      // Sign message with GemWallet
      const signResponse = await signMessage(messageStr);

      if (!signResponse.result || !signResponse.result.signedMessage) {
        throw new Error('Failed to sign message with GemWallet');
      }

      const { signedMessage } = signResponse.result;

      return {
        message: messageStr,
        signature: signedMessage,
        publicKey: this.currentAccount.publicKey || '',
      };
    } catch (error) {
      throw createWalletError.signFailed(error as Error);
    }
  }
}
