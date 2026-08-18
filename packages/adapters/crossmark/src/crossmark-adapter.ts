/**
 * Crossmark Adapter for XRPL
 */

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

import { createWalletError, isWalletError, resolveNetwork } from '@xrpl-connect/core';
import iconSvg from './assets/icon.svg';
import { CrossmarkSDK } from './sdk';

const { default: sdk, typings } = CrossmarkSDK;
const ICON_DATA_URL = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;

function isUserRejection(error: unknown): error is Error {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('reject') || message.includes('cancel');
}

function isRejectedResponse(response: unknown): boolean {
  if (!response || typeof response !== 'object') return false;

  const data = (response as { response?: { data?: { meta?: { isRejected?: unknown } } } }).response
    ?.data;
  return data?.meta?.isRejected === true;
}

/**
 * Crossmark adapter options
 */
// oxlint-disable-next-line typescript/no-empty-object-type
export interface CrossmarkAdapterOptions {
  // Currently no specific options needed for Crossmark
}

/**
 * Crossmark adapter implementation
 */
export class CrossmarkAdapter implements WalletAdapter, SupportsFetchAccount {
  readonly id = 'crossmark';
  readonly name = 'Crossmark';
  readonly icon = ICON_DATA_URL;
  readonly url = 'https://crossmark.io';

  private currentAccount: AccountInfo | null = null;
  private connectionGeneration = 0;
  private accountRefreshRevision = 0;

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

      if (isRejectedResponse(signInResponse)) {
        throw createWalletError.connectionRejected(this.name);
      }
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
      this.connectionGeneration += 1;

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
   * Disconnect from Crossmark
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
   * Fetch the active account and network directly from Crossmark.
   */
  async fetchAccount(): Promise<AccountInfo | null> {
    if (!this.currentAccount) return null;
    const generation = this.connectionGeneration;
    const refreshRevision = ++this.accountRefreshRevision;

    let addressResponse: unknown;
    try {
      addressResponse = await sdk.api.awaitRequest({ command: typings.COMMANDS.ADDRESS });
    } catch (error) {
      throw createWalletError.connectionFailed(this.name, error as Error);
    }

    if (generation !== this.connectionGeneration) throw createWalletError.notConnected();
    if (refreshRevision !== this.accountRefreshRevision) return this.currentAccount;
    if (!this.currentAccount) return null;

    const address = (addressResponse as unknown as { response?: { data?: { address?: string } } })
      .response?.data?.address;

    if (!address) {
      this.currentAccount = null;
      return null;
    }

    let networkResponse: unknown;
    try {
      networkResponse = await sdk.api.awaitRequest({ command: typings.COMMANDS.NETWORK });
    } catch (error) {
      throw createWalletError.connectionFailed(this.name, error as Error);
    }

    if (generation !== this.connectionGeneration) throw createWalletError.notConnected();
    if (refreshRevision !== this.accountRefreshRevision) return this.currentAccount;
    if (!this.currentAccount) return null;

    const network = (
      networkResponse as unknown as {
        response?: {
          data?: {
            network?: {
              protocol?: string;
              type?: string;
              label?: string;
              wss?: string;
              rpc?: string;
            };
          };
        };
      }
    ).response?.data?.network;

    if (!network?.type || !network.label || !network.wss) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error('Crossmark returned incomplete network information')
      );
    }

    const previousAccount = this.currentAccount;
    this.currentAccount = {
      address,
      publicKey: previousAccount?.address === address ? previousAccount.publicKey : undefined,
      network: this.toNetworkInfo({
        protocol: network.protocol,
        type: network.type,
        label: network.label,
        wss: network.wss,
        rpc: network.rpc,
      }),
    };

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

  private toNetworkInfo(network: {
    protocol?: string;
    type: string;
    label: string;
    wss: string;
    rpc?: string;
  }): NetworkInfo {
    const type = network.type.toLowerCase();
    const protocol = (network.protocol || network.label).toLowerCase();
    const label = network.label.toLowerCase();
    const isXrpl = label === 'xrpl' || label === 'xrp ledger';
    const isStandardXrpl = isXrpl && ['mainnet', 'testnet', 'devnet'].includes(type);
    const chain = label || protocol;
    const networkId = isStandardXrpl ? type : `${chain.replace(/[^a-z0-9]+/g, '-')}-${type}`;

    return {
      id: networkId,
      name: isStandardXrpl
        ? `${type.charAt(0).toUpperCase()}${type.slice(1)}`
        : `${network.label} ${network.type}`,
      wss: network.wss,
      rpc: network.rpc,
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
      const tx = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      };
      const signResponse = await sdk.methods.signAndWait(
        tx as Parameters<typeof sdk.methods.signAndWait>[0]
      );

      if (isRejectedResponse(signResponse)) throw createWalletError.signRejected();
      if (!signResponse.response.data.txBlob) {
        throw new Error('Failed to sign transaction with Crossmark');
      }
      return {
        hash: '',
        tx_blob: signResponse.response.data.txBlob,
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
      const tx = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      };
      const signResponse = await sdk.methods.signAndSubmitAndWait(
        tx as Parameters<typeof sdk.methods.signAndSubmitAndWait>[0]
      );

      if (isRejectedResponse(signResponse)) throw createWalletError.signRejected();
      if (!signResponse.response.data.resp.result.hash) {
        throw new Error('Failed to sign transaction with Crossmark');
      }
      return {
        hash: signResponse.response.data.resp.result.hash,
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

      // Crossmark doesn't have a dedicated signMessage method
      // We can use signInAndWait with the message as the hash
      const signResponse = await sdk.methods.signInAndWait(messageStr);

      if (isRejectedResponse(signResponse)) throw createWalletError.signRejected();
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
      if (isWalletError(error)) throw error;
      if (isUserRejection(error)) throw createWalletError.signRejected(error);
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
