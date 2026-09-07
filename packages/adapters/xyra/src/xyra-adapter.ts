/**
 * Xyra Wallet Adapter for XRPL Connect
 *
 * Browser-native wallet integration using popup-based signing flows.
 * No browser extensions or downloads required - Xyra runs entirely
 * in a secure popup window with client-side encryption.
 *
 * Uses the official @xyrawallet/sdk for popup management, origin
 * validation, and cross-window messaging via postMessage.
 */

import type {
  ConnectResponse,
  SignResponse,
  SignMessageResponse,
  Network,
  XyraSDK,
  XyraSDKConfig,
} from '@xyrawallet/sdk';
import type {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  Transaction,
  SignedTransaction,
  SignedMessage,
  SubmittedTransaction,
  WalletAdapterEvent,
} from '@xrpl-connect/core';
import {
  createWalletError,
  isWalletError,
  STANDARD_NETWORKS,
  createLogger,
} from '@xrpl-connect/core';
import type { XyraAdapterOptions, XyraConnectOptions } from './types';
import { XRPL_CONNECT_TO_XYRA_NETWORK } from './types';
import iconSvg from './assets/icon.svg';

const ICON_DATA_URL = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;

/**
 * Logger instance for Xyra adapter
 */
const logger = createLogger('[Xyra]');

/**
 * Xyra adapter implementation for XRPL Connect.
 *
 * Xyra is a browser-native wallet for XRPL mainnet and testnet.
 * It uses popup-based signing flows where cryptographic seeds never
 * leave the user's browser. No extensions or app installs are required.
 *
 * @example
 * ```typescript
 * import { WalletManager } from '@xrpl-connect/core';
 * import { XyraAdapter } from '@xrpl-connect/adapter-xyra';
 *
 * const walletManager = new WalletManager({
 *   adapters: [new XyraAdapter()],
 *   network: 'testnet',
 * });
 *
 * const account = await walletManager.connect('xyra');
 * console.log('Connected:', account.address);
 * ```
 */
export class XyraAdapter implements WalletAdapter {
  // ==================== Metadata ====================

  readonly id = 'xyra';
  readonly name = 'Xyra';
  readonly icon = ICON_DATA_URL;
  readonly url = 'https://xyra.now';

  // ==================== Private State ====================

  private sdk: XyraSDK | null = null;
  private sdkPromise: Promise<XyraSDK> | null = null;
  private readonly sdkConfig: XyraSDKConfig;
  private currentAccount: AccountInfo | null = null;
  private currentXyraNetwork: Network | null = null;
  private connectionGeneration = 0;
  private listeners: Map<WalletAdapterEvent, Set<(data?: unknown) => void>> = new Map();

  // ==================== Constructor ====================

  constructor(options: XyraAdapterOptions = {}) {
    this.sdkConfig = {
      walletUrl: options.walletUrl,
      timeout: options.timeout,
      popupWidth: options.popupWidth,
      popupHeight: options.popupHeight,
      signPopupHeight: options.signPopupHeight,
    };

    logger.debug('Xyra adapter initialized', {
      walletUrl: options.walletUrl || 'default',
      timeout: options.timeout || 'default',
    });
  }

  // ==================== Availability ====================

  /**
   * Xyra is always available — it's a web-based wallet that doesn't
   * require any browser extension or native app to be installed.
   * It opens in a popup window on demand.
   */
  async isAvailable(): Promise<boolean> {
    // Xyra is a web-based popup wallet — always available in browser environments.
    // Only unavailable in non-browser contexts (SSR, Node.js, etc.)
    if (typeof window === 'undefined') {
      return false;
    }

    // Check that popups are likely supported (not a guarantee, but a heuristic)
    return typeof window.open === 'function';
  }

  // ==================== Connection Lifecycle ====================

  /**
   * Connect to Xyra wallet.
   *
   * Opens a popup window where the user selects an account and
   * approves the connection. The requesting origin is displayed
   * prominently so the user can verify the source.
   *
   * @param options - Connection options (network config, auto-reconnect, etc.)
   * @returns Account info with address, public key, and network
   */
  async connect(options?: ConnectOptions<XyraConnectOptions>): Promise<AccountInfo> {
    const generation = ++this.connectionGeneration;
    try {
      // Resolve the target Xyra network from the xrpl-connect network config
      const xyraNetwork = this.resolveXyraNetwork(options?.network);

      logger.debug('Connecting to Xyra', { network: xyraNetwork });

      // Call the Xyra SDK connect flow (opens popup)
      const sdk = await this.getSdk();
      if (generation !== this.connectionGeneration) throw createWalletError.notConnected();
      const response: ConnectResponse = await sdk.connect({
        network: xyraNetwork,
      });
      if (generation !== this.connectionGeneration) throw createWalletError.notConnected();

      logger.debug('Connected to Xyra', {
        address: response.address,
        network: response.network,
      });

      // Map the response to xrpl-connect AccountInfo
      const networkInfo = this.xyraNetworkToInfo(response.network);
      const requestedNetworkInfo = this.xyraNetworkToInfo(xyraNetwork);
      if (networkInfo.id !== requestedNetworkInfo.id) {
        throw createWalletError.networkMismatch(requestedNetworkInfo.id, networkInfo.id);
      }

      // Keep the wallet's validated response as the signing network authority.
      this.currentXyraNetwork = response.network;

      this.currentAccount = {
        address: response.address,
        publicKey: response.publicKey,
        network: networkInfo,
      };

      // Emit connect event
      this.emit('connect', this.currentAccount);

      return this.currentAccount;
    } catch (error) {
      if (generation !== this.connectionGeneration) throw createWalletError.notConnected();
      logger.error('Connection failed', error);

      const walletError = this.mapError(error, 'connect');
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Disconnect from Xyra wallet.
   *
   * Clears the local connection state. Xyra is stateless (no persistent
   * sessions), so there is no server-side session to terminate.
   */
  async disconnect(): Promise<void> {
    logger.debug('Disconnecting from Xyra');

    this.connectionGeneration += 1;
    this.currentAccount = null;
    this.currentXyraNetwork = null;

    this.emit('disconnect');
  }

  // ==================== Account & Network ====================

  /**
   * Get the currently connected account information.
   */
  async getAccount(): Promise<AccountInfo | null> {
    return this.currentAccount;
  }

  /**
   * Get the current network information.
   *
   * Returns the network the user connected with.
   */
  async getNetwork(): Promise<NetworkInfo> {
    if (!this.currentAccount) throw createWalletError.notConnected();
    return this.currentAccount.network;
  }

  // ==================== Signing Operations ====================

  /**
   * Sign a transaction without submitting it to the ledger.
   *
   * Opens a popup window showing the full transaction details
   * and the requesting origin. The user must explicitly approve
   * the transaction before it is signed.
   *
   * @param transaction - The XRPL transaction object
   * @returns The signed transaction with tx_blob
   */
  async sign(transaction: Transaction): Promise<SignedTransaction> {
    if (!this.currentAccount || !this.currentXyraNetwork) {
      throw createWalletError.notConnected();
    }

    try {
      const network = this.currentXyraNetwork;

      logger.debug('Signing transaction', {
        type: (transaction as Record<string, unknown>).TransactionType,
        network,
      });

      const sdk = await this.getSdk();
      const response: SignResponse = await sdk.sign({
        transaction: transaction as Record<string, unknown>,
        network,
      });

      logger.debug('Transaction signed', {
        hash: response.hash,
      });

      return {
        hash: response.hash,
        tx_blob: response.tx_blob,
      };
    } catch (error) {
      logger.error('Sign failed', error);

      const walletError = this.mapError(error, 'sign');
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Sign and submit a transaction to the ledger.
   *
   * Opens a popup window showing the full transaction details
   * and the requesting origin. The user must explicitly approve
   * the transaction before it is signed and submitted.
   *
   * @param transaction - The XRPL transaction object
   * @returns The submitted transaction result
   */
  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    if (!this.currentAccount || !this.currentXyraNetwork) {
      throw createWalletError.notConnected();
    }

    try {
      const network = this.currentXyraNetwork;

      logger.debug('Signing and submitting transaction', {
        type: (transaction as Record<string, unknown>).TransactionType,
        network,
      });

      const sdk = await this.getSdk();
      const response: SignResponse = await sdk.signAndSubmit({
        transaction: transaction as Record<string, unknown>,
        network,
      });

      logger.debug('Transaction signed and submitted', {
        hash: response.hash,
      });

      const result: SubmittedTransaction = {
        hash: response.hash,
      };

      if (response.submitResult) {
        result.submitResult = response.submitResult;
      }

      return result;
    } catch (error) {
      logger.error('Sign and submit failed', error);

      const walletError = this.mapError(error, 'sign');
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Sign an arbitrary message for authentication or proof of ownership.
   *
   * Opens a popup showing the message to be signed. The user must
   * approve before the message is signed with their private key.
   *
   * @param message - The message to sign (string or Uint8Array)
   * @returns The signed message with signature and public key
   */
  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      // Convert Uint8Array to string if needed
      const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);

      logger.debug('Signing message', {
        length: messageStr.length,
      });

      const sdk = await this.getSdk();
      const response: SignMessageResponse = await sdk.signMessage({
        message: messageStr,
      });

      logger.debug('Message signed', {
        address: response.address,
      });

      return {
        message: response.message,
        signature: response.signature,
        publicKey: response.publicKey,
        signerAddress: response.address,
      };
    } catch (error) {
      logger.error('Sign message failed', error);

      const walletError = this.mapError(error, 'sign');
      this.emit('error', walletError);
      throw walletError;
    }
  }

  // ==================== Event Listeners ====================

  /**
   * Register an event listener.
   */
  on(event: WalletAdapterEvent, callback: (data?: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Remove an event listener.
   */
  off(event: WalletAdapterEvent, callback: (data?: unknown) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  // ==================== Cleanup ====================

  /**
   * Destroy the adapter and clean up SDK resources.
   */
  destroy(): void {
    this.connectionGeneration += 1;
    this.sdk?.destroy();
    this.sdk = null;
    this.sdkPromise = null;
    this.currentAccount = null;
    this.currentXyraNetwork = null;
    this.listeners.clear();
    logger.debug('Xyra adapter destroyed');
  }

  // ==================== Private Helpers ====================

  private getSdk(): Promise<XyraSDK> {
    if (this.sdk) return Promise.resolve(this.sdk);

    if (this.sdkPromise) return this.sdkPromise;

    const sdkPromise = import('@xyrawallet/sdk')
      .then(({ XyraSDK: XyraSDKConstructor }) => {
        const sdk = new XyraSDKConstructor(this.sdkConfig);
        if (this.sdkPromise !== sdkPromise) {
          sdk.destroy();
          throw new Error('Xyra adapter was destroyed while the SDK was initializing');
        }
        this.sdk = sdk;
        return sdk;
      })
      .catch((error: unknown) => {
        if (this.sdkPromise === sdkPromise) this.sdkPromise = null;
        throw error;
      });
    this.sdkPromise = sdkPromise;

    return sdkPromise;
  }

  /**
   * Emit an event to registered listeners.
   */
  private emit(event: WalletAdapterEvent, data?: unknown): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (err) {
          logger.error(`Error in ${event} listener`, err);
        }
      });
    }
  }

  /**
   * Resolve an xrpl-connect NetworkConfig to a Xyra SDK Network string.
   *
   * Xyra has no devnet or custom-network support. When omitted, this adapter
   * deliberately asks the SDK for testnet; the SDK response is still checked
   * below and remains authoritative for all subsequent signing operations.
   */
  private resolveXyraNetwork(networkConfig?: string | NetworkInfo): Network {
    if (networkConfig === undefined) {
      // Default to xrpl-testnet if no network specified
      return 'xrpl-testnet';
    }

    // If it's a NetworkInfo object, extract the id
    const networkId = typeof networkConfig === 'string' ? networkConfig : networkConfig.id;

    // Xyra accepts only the canonical xrpl-connect mainnet and testnet IDs.
    if (networkId === 'mainnet' || networkId === 'testnet') {
      return XRPL_CONNECT_TO_XYRA_NETWORK[networkId];
    }

    throw createWalletError.networkNotSupported(networkId, this.name);
  }

  /**
   * Map a Xyra SDK Network string back to an xrpl-connect NetworkInfo.
   *
   * This is not the same as the shared `resolveNetwork` helper from
   * `@xrpl-connect/core`: that helper resolves a user-supplied
   * `ConnectOptions['network']` (string id or `NetworkInfo`) to a
   * `NetworkInfo`, whereas this method translates a Xyra-SDK-native
   * network identifier returned by the wallet itself.
   */
  private xyraNetworkToInfo(xyraNetwork: Network): NetworkInfo {
    if (xyraNetwork === 'xrpl-mainnet') {
      return STANDARD_NETWORKS.mainnet;
    }
    if (xyraNetwork === 'xrpl-testnet') {
      return STANDARD_NETWORKS.testnet;
    }

    throw createWalletError.networkNotSupported(String(xyraNetwork), this.name);
  }

  /**
   * Map Xyra SDK errors to xrpl-connect WalletError instances.
   */
  private mapError(
    error: unknown,
    operation: 'connect' | 'sign'
  ): ReturnType<typeof createWalletError.connectionFailed> {
    if (isWalletError(error)) return error;

    if (!(error instanceof Error)) {
      if (operation === 'connect') {
        return createWalletError.connectionFailed('Xyra', new Error(String(error)));
      }
      return createWalletError.signFailed(new Error(String(error)));
    }

    const message = error.message.toLowerCase();

    // Popup was closed by user (rejection)
    if (
      message.includes('popup closed') ||
      message.includes('user closed') ||
      message.includes('popupclosed')
    ) {
      if (operation === 'connect') {
        return createWalletError.connectionRejected('Xyra');
      }
      return createWalletError.signRejected();
    }

    // Popup was blocked by browser
    if (message.includes('popup blocked') || message.includes('popupblocked')) {
      return createWalletError.connectionFailed(
        'Xyra',
        new Error('Popup was blocked by the browser. Please allow popups for this site.')
      );
    }

    // Timeout
    if (message.includes('timeout')) {
      if (operation === 'connect') {
        return createWalletError.connectionFailed(
          'Xyra',
          new Error('Connection timed out. Please try again.')
        );
      }
      return createWalletError.signFailed(new Error('Signing timed out. Please try again.'));
    }

    // Invalid network
    if (message.includes('invalid network') || message.includes('invalidnetwork')) {
      return createWalletError.networkNotSupported(error.message, 'Xyra');
    }

    // Generic fallback
    if (operation === 'connect') {
      return createWalletError.connectionFailed('Xyra', error);
    }
    return createWalletError.signFailed(error);
  }
}
