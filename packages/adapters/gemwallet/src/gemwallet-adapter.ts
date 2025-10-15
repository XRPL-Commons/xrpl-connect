/**
 * GemWallet Adapter for XRPL
 */

import { isInstalled, getPublicKey, signMessage, signTransaction, submitTransaction } from '@gemwallet/api';
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
 * GemWallet adapter options
 */
export interface GemWalletAdapterOptions {
  // Currently no specific options needed for GemWallet
}

/**
 * GemWallet adapter implementation
 */
export class GemWalletAdapter implements WalletAdapter {
  readonly id = 'gemwallet';
  readonly name = 'GemWallet';
  readonly icon = 'https://gemwallet.app/assets/logo.svg';
  readonly url = 'https://gemwallet.app';

  private currentAccount: AccountInfo | null = null;

  constructor(_options: GemWalletAdapterOptions = {}) {
    // Options not currently used
  }

  /**
   * Check if GemWallet is installed
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await isInstalled();
      return result.result?.isInstalled || false;
    } catch {
      return false;
    }
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
      const network = this.resolveNetwork(options?.network);

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

      // Sign with GemWallet
      const signResponse = await signTransaction({
        transaction: txToSign as any, // GemWallet types may not match all xrpl transaction types
      });

      if (!signResponse.result) {
        throw new Error('Failed to sign transaction with GemWallet');
      }

      const { signature } = signResponse.result;

      return {
        hash: '', // GemWallet doesn't return hash directly
        signature: signature || undefined,
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

  /**
   * Submit a transaction to the ledger
   * GemWallet will automatically autofill, sign, and submit the transaction
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

      // Submit transaction with GemWallet (autofills, signs, and submits)
      const submitResponse = await submitTransaction({
        transaction: txToSubmit as any,
      });

      if (!submitResponse.result || !submitResponse.result.hash) {
        throw new Error('Failed to submit transaction with GemWallet');
      }

      const { hash } = submitResponse.result;

      return {
        hash,
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
}
