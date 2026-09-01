/**
 * GemWallet Adapter for XRPL
 */

import {
  isInstalled,
  getNetwork,
  getPublicKey,
  signMessage,
  signTransaction,
  submitTransaction,
} from '@gemwallet/api';
import type {
  WalletAdapter,
  SupportsFetchAccount,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  Transaction,
  SignedTransaction,
  SignedMessage,
  SubmittedTransaction,
} from '@xrpl-connect/core';
import {
  createWalletError,
  isStandardNetworkId,
  isWalletError,
  resolveNetwork,
  TIME,
  withTimeout,
} from '@xrpl-connect/core';
import type { SubmittableTransaction } from 'xrpl';
import iconSvg from './assets/icon.svg';

const ICON_DATA_URL = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;

function isUserRejection(error: unknown): error is Error {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('reject') || message.includes('cancel');
}

/**
 * GemWallet adapter options
 */
// oxlint-disable-next-line typescript/no-empty-object-type
export interface GemWalletAdapterOptions {
  // Currently no specific options needed for GemWallet
}

/**
 * GemWallet adapter implementation
 */
export class GemWalletAdapter implements WalletAdapter, SupportsFetchAccount {
  readonly id = 'gemwallet';
  readonly name = 'GemWallet';
  readonly icon = ICON_DATA_URL;
  readonly url = 'https://gemwallet.app';

  private currentAccount: AccountInfo | null = null;
  private connectionGeneration = 0;
  private accountRefreshRevision = 0;

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
    const generation = ++this.connectionGeneration;
    try {
      // Check if GemWallet is installed
      const available = await this.isAvailable();
      if (generation !== this.connectionGeneration) throw createWalletError.notConnected();
      if (!available) {
        throw createWalletError.notInstalled(this.name);
      }

      // Resolve an explicit requested network for validation after querying the
      // wallet. An omitted network must come from GemWallet's live state.
      const requestedNetwork =
        options?.network === undefined ? undefined : this.resolveRequestedNetwork(options.network);

      // Get public key (which also returns the address)
      const publicKeyResponse = await getPublicKey();
      if (generation !== this.connectionGeneration) throw createWalletError.notConnected();

      if (publicKeyResponse.type === 'reject') {
        throw createWalletError.connectionRejected(this.name);
      }
      if (!publicKeyResponse.result || !publicKeyResponse.result.address) {
        throw new Error('Failed to get address from GemWallet');
      }

      const { address, publicKey } = publicKeyResponse.result;
      const network = await this.getLiveNetwork();
      if (generation !== this.connectionGeneration) throw createWalletError.notConnected();
      if (requestedNetwork && requestedNetwork.id !== network.id) {
        throw createWalletError.networkMismatch(requestedNetwork.id, network.id);
      }

      this.currentAccount = {
        address,
        publicKey,
        network,
      };

      return this.currentAccount;
    } catch (error) {
      if (isWalletError(error)) throw error;
      if (isUserRejection(error)) {
        throw createWalletError.connectionRejected(this.name, error);
      }
      throw createWalletError.connectionFailed(this.name, error as Error);
    }
  }

  /**
   * Disconnect from GemWallet
   */
  async disconnect(): Promise<void> {
    this.connectionGeneration += 1;
    this.currentAccount = null;
  }

  /**
   * Get current account
   */
  async getAccount(): Promise<AccountInfo | null> {
    return this.currentAccount;
  }

  /**
   * Fetch the active account and network directly from GemWallet.
   */
  async fetchAccount(): Promise<AccountInfo | null> {
    if (!this.currentAccount) return null;
    const generation = this.connectionGeneration;
    const refreshRevision = ++this.accountRefreshRevision;

    let accountResponse: Awaited<ReturnType<typeof getPublicKey>>;
    try {
      accountResponse = await getPublicKey();
    } catch (error) {
      throw createWalletError.connectionFailed(this.name, error as Error);
    }

    if (generation !== this.connectionGeneration) throw createWalletError.notConnected();
    if (refreshRevision !== this.accountRefreshRevision) return this.currentAccount;
    if (!this.currentAccount) return null;

    if (accountResponse.type === 'reject') {
      throw createWalletError.connectionRejected(this.name);
    }
    if (!accountResponse.result?.address) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error('GemWallet returned incomplete account information')
      );
    }

    const network = await this.getLiveNetwork();

    if (generation !== this.connectionGeneration) throw createWalletError.notConnected();
    if (refreshRevision !== this.accountRefreshRevision) return this.currentAccount;
    if (!this.currentAccount) return null;

    this.currentAccount = {
      address: accountResponse.result.address,
      publicKey: accountResponse.result.publicKey,
      network,
    };

    return this.currentAccount;
  }

  private async getLiveNetwork(): Promise<NetworkInfo> {
    let networkResponse: Awaited<ReturnType<typeof getNetwork>>;
    try {
      networkResponse = await getNetwork();
    } catch (error) {
      throw createWalletError.connectionFailed(this.name, error as Error);
    }

    const network = networkResponse?.result;
    if (!network?.chain || !network.network || !network.websocket) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error('GemWallet returned incomplete network information')
      );
    }

    return this.toNetworkInfo(network);
  }

  private async assertCurrentNetwork(): Promise<void> {
    if (!this.currentAccount) throw createWalletError.notConnected();
    const generation = this.connectionGeneration;
    const liveNetwork = await this.getLiveNetwork();
    if (generation !== this.connectionGeneration || !this.currentAccount) {
      throw createWalletError.notConnected();
    }
    if (liveNetwork.id !== this.currentAccount.network.id) {
      throw createWalletError.networkMismatch(this.currentAccount.network.id, liveNetwork.id);
    }
  }

  private resolveRequestedNetwork(network: string | NetworkInfo): NetworkInfo {
    if (typeof network === 'string' && !isStandardNetworkId(network)) {
      throw createWalletError.networkNotSupported(network, this.name);
    }
    return resolveNetwork(network);
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

  private toNetworkInfo(network: {
    chain: string;
    network: string;
    websocket: string;
  }): NetworkInfo {
    const chain = network.chain.toLowerCase();
    const type = network.network.toLowerCase();
    const isStandardXrpl = chain === 'xrpl' && ['mainnet', 'testnet', 'devnet'].includes(type);

    return {
      id: isStandardXrpl ? type : `${chain}-${type}`,
      name: isStandardXrpl
        ? `${type.charAt(0).toUpperCase()}${type.slice(1)}`
        : `${network.chain} ${network.network}`,
      wss: network.websocket,
    };
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
      await this.assertCurrentNetwork();
      const tx = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      };

      const signResponse = await signTransaction({
        transaction: tx as SubmittableTransaction,
      });

      if (signResponse.type === 'reject') throw createWalletError.signRejected();
      if (!signResponse.result) {
        throw new Error('Failed to sign transaction with GemWallet');
      }

      return {
        hash: '',
        tx_blob: signResponse.result.signature || '',
      };
    } catch (error) {
      if (isWalletError(error)) throw error;
      if (isUserRejection(error)) throw createWalletError.signRejected(error);
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
      await this.assertCurrentNetwork();
      const tx = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      };

      const submitResponse = await submitTransaction({
        transaction: tx as SubmittableTransaction,
      });

      if (submitResponse.type === 'reject') throw createWalletError.signRejected();
      if (!submitResponse.result || !submitResponse.result.hash) {
        throw new Error('Failed to submit transaction with GemWallet');
      }

      return {
        hash: submitResponse.result.hash,
      };
    } catch (error) {
      if (isWalletError(error)) throw error;
      if (isUserRejection(error)) throw createWalletError.signRejected(error);
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

      if (signResponse.type === 'reject') throw createWalletError.signRejected();
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
      if (isWalletError(error)) throw error;
      if (isUserRejection(error)) throw createWalletError.signRejected(error);
      throw createWalletError.signFailed(error as Error);
    }
  }
}
