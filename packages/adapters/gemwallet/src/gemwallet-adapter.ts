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
  readonly icon =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSI+PHBhdGggZmlsbD0iIzAwQThFQSIgZD0iTTIwIDM5LjkxMS41OTMgMTcuNDIyaDM4LjgxNHoiLz48cGF0aCBmaWxsPSIjMzNEM0Y0IiBkPSJNMzMuMTg1IDUuMzMzSDYuODE1TC41OTMgMTcuNDIzaDM4LjgxNHoiLz48cGF0aCBmaWxsPSIjNDBFRUZGIiBkPSJtMjAgMzkuOTExLTcuMDM3LTIyLjQ4OWgxNC4wNzR6TTE0LjIyMiAxNC40IDguNjY3IDUuMzMzSDIwem0xMS4yNTkgMEwyMCA1LjMzM2gxMS4zMzN6Ii8+PHBhdGggZmlsbD0iI0ZGRiIgZD0iTTYuMjk2IDYuNDg5IDMuNDA3IDUuMzMzbDIuODktMS4xNTVMNy4yNTguNzFsLjk2MyAzLjQ2NyAyLjg5IDEuMTU1LTIuODkgMS4xNTYtLjk2MyAzLjQ2N3ptMjcuNDA4IDExLjI4OS0xLjg1Mi0uNzExIDEuODUyLS44LjY2Ni0yLjIyMy41OTMgMi4yMjMgMS44NTIuOC0xLjg1Mi43MUwzNC4zNyAyMHoiLz48cGF0aCBkPSJNMjEuODUyIDUuMzMzIDYuMjk2IDI0LjA5bC0xLjMzMy0xLjUxMSAxNC4zNy0xNy4yNDV6bTguNzQxIDBMMTAuNzQgMjkuMTU2IDcuNjMgMjUuNiAyNC40NDQgNS4zMzN6IiBvcGFjaXR5PSIuMiIgZmlsbD0iI0ZGRiIvPjwvZz48L3N2Zz4=';
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
   * Sign and optionally submit a transaction
   * @param transaction - The transaction to sign
   * @param submit - Whether to submit to the ledger (default: true)
   */
  async signAndSubmit(
    transaction: Transaction,
    submit: boolean = true
  ): Promise<SubmittedTransaction> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      // Ensure Account field is set
      const tx: Transaction = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      };

      if (submit) {
        // Use submitTransaction which autofills, signs, AND submits
        const submitResponse = await submitTransaction({
          transaction: tx,
        });

        if (!submitResponse.result || !submitResponse.result.hash) {
          throw new Error('Failed to submit transaction with GemWallet');
        }

        const { hash } = submitResponse.result;

        return {
          hash,
        };
      } else {
        // Just sign the transaction without submitting
        const signResponse = await signTransaction({
          transaction: tx,
        });

        if (!signResponse.result) {
          throw new Error('Failed to sign transaction with GemWallet');
        }

        const { signature } = signResponse.result;

        return {
          hash: '', // GemWallet doesn't return hash for sign-only
          signature,
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
