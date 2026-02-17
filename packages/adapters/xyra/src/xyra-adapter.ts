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

import { XyraSDK } from '@xyrawallet/sdk';
import type {
  ConnectResponse,
  SignResponse,
  SignMessageResponse,
  Network,
} from '@xyrawallet/sdk';
import type {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  Transaction,
  SignedMessage,
  SubmittedTransaction,
  WalletAdapterEvent,
} from '@xrpl-connect/core';
import { createWalletError, STANDARD_NETWORKS, createLogger } from '@xrpl-connect/core';
import type { XyraAdapterOptions, XyraConnectOptions } from './types';
import { XRPL_CONNECT_TO_XYRA_NETWORK, XYRA_TO_XRPL_CONNECT_NETWORK } from './types';

/**
 * Logger instance for Xyra adapter
 */
const logger = createLogger('[Xyra]');

/**
 * Xyra adapter implementation for XRPL Connect.
 *
 * Xyra is a browser-native wallet for XRPL and Xahau networks.
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
  readonly icon =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMDAgMzAwIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ieHlyYS1pY29uLWdyYWRpZW50LTEiIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIiBncmFkaWVudFVuaXRzPSJvYmplY3RCb3VuZGluZ0JveCI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM2M2UwZmYiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjNWE3Y2ZmIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNiMjZiZmYiIC8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJ4eXJhLWljb24tZ3JhZGllbnQtMiIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiIGdyYWRpZW50VW5pdHM9Im9iamVjdEJvdW5kaW5nQm94Ij4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzYzZTBmZiIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiM1YTdjZmYiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI2IyNmJmZiIgLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxnIHRyYW5zZm9ybT0ibWF0cml4KDEuMzY5ODA2IDAgMCAxLjM2OTgwNiAtNDQ4LjMzMjY0NCAtMTMwLjE5MzgyMikiPgogICAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNDM2LjgwMSAyMDQuNTUpIj4KICAgICAgPGVsbGlwc2Ugcng9IjkwIiByeT0iMzgiIHRyYW5zZm9ybT0ibWF0cml4KDAuODE5MTUyIDAuNTczNTc2IC0wLjU3MzU3NiAwLjgxOTE1MiAwIDApIiBmaWxsPSJub25lIiBzdHJva2U9InVybCgjeHlyYS1pY29uLWdyYWRpZW50LTEpIiBzdHJva2Utd2lkdGg9IjE4IiBzdHJva2UtbGluZWNhcD0icm91bmQiIC8+CiAgICAgIDxlbGxpcHNlIHJ4PSI5MCIgcnk9IjM4IiB0cmFuc2Zvcm09Im1hdHJpeCgwLjgxOTE1MiAtMC41NzM1NzYgMC41NzM1NzYgMC44MTkxNTIgMCAwKSIgb3BhY2l0eT0iMC45NSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ1cmwoI3h5cmEtaWNvbi1ncmFkaWVudC0yKSIgc3Ryb2tlLXdpZHRoPSIxOCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiAvPgogICAgPC9nPgogIDwvZz4KPC9zdmc+';
  readonly url = 'https://xyra.now';

  // ==================== Private State ====================

  private sdk: XyraSDK;
  private currentAccount: AccountInfo | null = null;
  private currentXyraNetwork: Network | null = null;
  private listeners: Map<WalletAdapterEvent, Set<(data?: unknown) => void>> = new Map();

  // ==================== Constructor ====================

  constructor(options: XyraAdapterOptions = {}) {
    this.sdk = new XyraSDK({
      walletUrl: options.walletUrl,
      timeout: options.timeout,
      popupWidth: options.popupWidth,
      popupHeight: options.popupHeight,
      signPopupHeight: options.signPopupHeight,
    });

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
    try {
      // Resolve the target Xyra network from the xrpl-connect network config
      const xyraNetwork = this.resolveXyraNetwork(options?.network);

      logger.debug('Connecting to Xyra', { network: xyraNetwork });

      // Call the Xyra SDK connect flow (opens popup)
      const response: ConnectResponse = await this.sdk.connect({
        network: xyraNetwork,
      });

      logger.debug('Connected to Xyra', {
        address: response.address,
        network: response.network,
      });

      // Store the Xyra network for subsequent signing operations
      this.currentXyraNetwork = response.network;

      // Map the response to xrpl-connect AccountInfo
      const networkInfo = this.resolveNetworkInfo(response.network);

      this.currentAccount = {
        address: response.address,
        publicKey: response.publicKey,
        network: networkInfo,
      };

      // Emit connect event
      this.emit('connect', this.currentAccount);

      return this.currentAccount;
    } catch (error) {
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
   * Returns the network the user connected with. If not connected,
   * defaults to XRPL mainnet.
   */
  async getNetwork(): Promise<NetworkInfo> {
    if (this.currentAccount) {
      return this.currentAccount.network;
    }

    // Default to mainnet if not connected
    return STANDARD_NETWORKS.mainnet;
  }

  // ==================== Signing Operations ====================

  /**
   * Sign a transaction and optionally submit it to the network.
   *
   * Opens a popup window showing the full transaction details
   * and the requesting origin. The user must explicitly approve
   * the transaction before it is signed.
   *
   * @param transaction - The XRPL transaction object
   * @param submit - If true, submit to the network after signing (default: true)
   * @returns The signed/submitted transaction result
   */
  async signAndSubmit(
    transaction: Transaction,
    submit: boolean = true
  ): Promise<SubmittedTransaction> {
    if (!this.currentAccount || !this.currentXyraNetwork) {
      throw createWalletError.notConnected();
    }

    try {
      const network = this.currentXyraNetwork;

      logger.debug('Signing transaction', {
        type: (transaction as Record<string, unknown>).TransactionType,
        network,
        submit,
      });

      let response: SignResponse;

      if (submit) {
        response = await this.sdk.signAndSubmit({
          transaction: transaction as Record<string, unknown>,
          network,
        });
      } else {
        response = await this.sdk.sign({
          transaction: transaction as Record<string, unknown>,
          network,
        });
      }

      logger.debug('Transaction signed', {
        hash: response.hash,
        submitted: response.submitted,
      });

      // Map to xrpl-connect SubmittedTransaction format
      const result: SubmittedTransaction = {
        hash: response.hash,
        tx_blob: response.tx_blob,
        submitted: response.submitted,
      };

      // Include submit result details if available
      if (response.submitResult) {
        result.submitResult = response.submitResult;
      }

      return result;
    } catch (error) {
      logger.error('Sign failed', error);

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
      const messageStr =
        typeof message === 'string' ? message : new TextDecoder().decode(message);

      logger.debug('Signing message', {
        length: messageStr.length,
      });

      const response: SignMessageResponse = await this.sdk.signMessage({
        message: messageStr,
      });

      logger.debug('Message signed', {
        address: response.address,
      });

      return {
        message: response.message,
        signature: response.signature,
        publicKey: response.publicKey,
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
    this.sdk.destroy();
    this.currentAccount = null;
    this.currentXyraNetwork = null;
    this.listeners.clear();
    logger.debug('Xyra adapter destroyed');
  }

  // ==================== Private Helpers ====================

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
   * Handles the mapping between xrpl-connect's network identifiers
   * ('mainnet', 'testnet', 'devnet') and Xyra's network format
   * ('xrpl-mainnet', 'xrpl-testnet').
   */
  private resolveXyraNetwork(networkConfig?: string | NetworkInfo): Network {
    if (!networkConfig) {
      // Default to xrpl-testnet if no network specified
      return 'xrpl-testnet';
    }

    // If it's a NetworkInfo object, extract the id
    const networkId = typeof networkConfig === 'string' ? networkConfig : networkConfig.id;

    // Check if it's already a valid Xyra network string
    const validXyraNetworks: Network[] = [
      'xrpl-mainnet',
      'xrpl-testnet',
    ];
    if (validXyraNetworks.includes(networkId as Network)) {
      return networkId as Network;
    }

    // Map from xrpl-connect network ID to Xyra network
    const mapped = XRPL_CONNECT_TO_XYRA_NETWORK[networkId];
    if (mapped) {
      return mapped;
    }

    // Try to infer from the network ID string
    const lower = networkId.toLowerCase();

    if (lower.includes('test') || lower.includes('altnet')) {
      return 'xrpl-testnet';
    }

    if (lower.includes('main') || lower === 'livenet') {
      return 'xrpl-mainnet';
    }

    // Fallback to testnet for safety
    logger.warn(`Unknown network "${networkId}", defaulting to xrpl-testnet`);
    return 'xrpl-testnet';
  }

  /**
   * Map a Xyra SDK Network string back to an xrpl-connect NetworkInfo.
   */
  private resolveNetworkInfo(xyraNetwork: Network): NetworkInfo {
    const connectNetworkId = XYRA_TO_XRPL_CONNECT_NETWORK[xyraNetwork];

    // Check standard networks first
    if (connectNetworkId && STANDARD_NETWORKS[connectNetworkId]) {
      return STANDARD_NETWORKS[connectNetworkId];
    }

        // Fallback to XRPL testnet
    return STANDARD_NETWORKS.testnet;
  }

  /**
   * Map Xyra SDK errors to xrpl-connect WalletError instances.
   */
  private mapError(
    error: unknown,
    operation: 'connect' | 'sign'
  ): ReturnType<typeof createWalletError.connectionFailed> {
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