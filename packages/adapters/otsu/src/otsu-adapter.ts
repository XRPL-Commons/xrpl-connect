/**
 * Otsu Wallet Adapter for XRPL Connect
 *
 * Browser extension wallet integration using the injected window.xrpl provider.
 * Otsu is an MV3 Chrome/Firefox extension that communicates with dApps via
 * postMessage-based content script bridging.
 *
 * The extension injects a provider object at window.xrpl with isOtsu=true.
 * This adapter bridges between the xrpl-connect WalletAdapter interface
 * and the Otsu provider API.
 */

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
import { createWalletError, STANDARD_NETWORKS, createLogger } from '@xrpl-connect/core';
import type { OtsuProvider } from './types';
import iconDataUrl from './assets/icon.png';

const logger = createLogger('[Otsu]');

/**
 * Otsu adapter implementation for XRPL Connect.
 *
 * Otsu Wallet is an MV3 browser extension for XRPL that supports
 * mainnet, testnet, and devnet. It provides granular dApp permission
 * scopes (read, sign, submit, switchNetwork) and transaction simulation
 * with risk scanning before user approval.
 *
 * @example
 * ```typescript
 * import { WalletManager } from '@xrpl-connect/core';
 * import { OtsuAdapter } from '@xrpl-connect/adapter-otsu';
 *
 * const walletManager = new WalletManager({
 *   adapters: [new OtsuAdapter()],
 *   network: 'testnet',
 * });
 *
 * const account = await walletManager.connect('otsu');
 * console.log('Connected:', account.address);
 * ```
 */
export class OtsuAdapter implements WalletAdapter {
  // ==================== Metadata ====================

  readonly id = 'otsu';
  readonly name = 'Otsu Wallet';
  readonly icon = iconDataUrl;
  readonly url = 'https://github.com/RomThpt/otsu-wallet';

  // ==================== Private State ====================

  private currentAccount: AccountInfo | null = null;
  private listeners: Map<WalletAdapterEvent, Set<(data?: unknown) => void>> = new Map();
  private providerListeners: Map<string, (data: unknown) => void> = new Map();

  // ==================== Availability ====================

  /**
   * Check if the Otsu Wallet extension is installed.
   *
   * The extension injects a provider object at window.xrpl with
   * isOtsu=true. Returns false in non-browser environments.
   */
  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false;
    }
    return true;
  }

  // ==================== Connection Lifecycle ====================

  /**
   * Connect to Otsu Wallet.
   *
   * Triggers the extension's connection flow which opens a notification
   * popup where the user can approve the connection and select permission
   * scopes. The extension supports granular scopes: read, sign, submit,
   * and switchNetwork.
   *
   * @param options - Connection options (network config, etc.)
   * @returns Account info with address and network
   */
  async connect(options?: ConnectOptions): Promise<AccountInfo> {
    const provider = this.getProvider();

    try {
      logger.debug('Connecting to Otsu Wallet');

      const response = await provider.connect({
        scopes: ['read', 'sign', 'submit', 'switchNetwork'],
      });

      const networkInfo = await this.fetchNetworkInfo(provider, options?.network);

      this.currentAccount = {
        address: response.address,
        network: networkInfo,
      };

      this.setupProviderListeners(provider);
      this.emit('connect', this.currentAccount);

      logger.debug('Connected to Otsu Wallet', { address: response.address });

      return this.currentAccount;
    } catch (error) {
      logger.error('Connection failed', error);

      const walletError = this.mapError(error, 'connect');
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Disconnect from Otsu Wallet.
   *
   * Calls the extension's disconnect method to revoke the dApp's
   * permission, then clears local state.
   */
  async disconnect(): Promise<void> {
    logger.debug('Disconnecting from Otsu Wallet');

    try {
      const provider = this.getProviderSafe();
      if (provider) {
        this.removeProviderListeners(provider);
        await provider.disconnect();
      }
    } catch {
      // Ignore disconnect errors
    }

    this.currentAccount = null;
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
   * Queries the extension for the active network and maps it to
   * an xrpl-connect NetworkInfo object.
   */
  async getNetwork(): Promise<NetworkInfo> {
    if (this.currentAccount) {
      return this.currentAccount.network;
    }
    return STANDARD_NETWORKS.mainnet;
  }

  // ==================== Signing Operations ====================

  /**
   * Sign a transaction without submitting it to the ledger.
   *
   * Opens the extension's signing popup where the user can review
   * the transaction details, simulation results, and risk warnings
   * before approving.
   *
   * @param transaction - The XRPL transaction object
   * @returns The signed transaction with tx_blob and hash
   */
  async sign(transaction: Transaction): Promise<SignedTransaction> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    const provider = this.getProvider();

    try {
      logger.debug('Signing transaction', {
        type: (transaction as Record<string, unknown>).TransactionType,
      });

      const response = await provider.signTransaction(
        transaction as unknown as Record<string, unknown>
      );

      logger.debug('Transaction signed', { hash: response.hash });

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
   * Opens the extension's signing popup. On approval, the transaction
   * is signed and submitted to the connected network.
   *
   * @param transaction - The XRPL transaction object
   * @returns The submitted transaction result with hash
   */
  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    const provider = this.getProvider();

    try {
      logger.debug('Signing and submitting transaction', {
        type: (transaction as Record<string, unknown>).TransactionType,
      });

      const response = await provider.signAndSubmit(
        transaction as unknown as Record<string, unknown>
      );

      logger.debug('Transaction signed and submitted', { hash: response.hash });

      return {
        hash: response.hash,
      };
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
   * @param message - The message to sign (string or Uint8Array)
   * @returns The signed message with signature and public key
   */
  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    const provider = this.getProvider();

    try {
      const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);

      logger.debug('Signing message', { length: messageStr.length });

      const response = await provider.signMessage(messageStr);

      logger.debug('Message signed');

      return {
        message: messageStr,
        signature: response.signature,
        publicKey: this.currentAccount.publicKey || '',
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

  // ==================== Private Helpers ====================

  /**
   * Get the injected provider, throwing if not available.
   */
  private getProvider(): OtsuProvider {
    if (typeof window === 'undefined' || !window.xrpl?.isOtsu) {
      throw createWalletError.notInstalled('Otsu Wallet');
    }
    return window.xrpl;
  }

  /**
   * Get the injected provider without throwing.
   */
  private getProviderSafe(): OtsuProvider | null {
    if (typeof window === 'undefined' || !window.xrpl?.isOtsu) {
      return null;
    }
    return window.xrpl;
  }

  /**
   * Fetch network info from the provider and map to xrpl-connect NetworkInfo.
   */
  private async fetchNetworkInfo(
    provider: OtsuProvider,
    networkConfig?: string | NetworkInfo
  ): Promise<NetworkInfo> {
    try {
      const { network } = await provider.getNetwork();

      if (STANDARD_NETWORKS[network]) {
        return STANDARD_NETWORKS[network];
      }

      // Fallback: try to match by name
      const lower = network.toLowerCase();
      if (lower.includes('main')) return STANDARD_NETWORKS.mainnet;
      if (lower.includes('test')) return STANDARD_NETWORKS.testnet;
      if (lower.includes('dev')) return STANDARD_NETWORKS.devnet;
    } catch {
      // If getNetwork fails, use the requested network config
    }

    // Use the requested network or default to mainnet
    if (networkConfig) {
      if (typeof networkConfig === 'string' && STANDARD_NETWORKS[networkConfig]) {
        return STANDARD_NETWORKS[networkConfig];
      }
      if (typeof networkConfig === 'object') {
        return networkConfig;
      }
    }

    return STANDARD_NETWORKS.mainnet;
  }

  /**
   * Set up listeners on the Otsu provider to forward events.
   */
  private setupProviderListeners(provider: OtsuProvider): void {
    const accountHandler = (data: unknown) => {
      if (this.currentAccount && data && typeof data === 'object' && 'address' in data) {
        this.currentAccount = {
          ...this.currentAccount,
          address: (data as { address: string }).address,
        };
        this.emit('accountChanged', this.currentAccount);
      }
    };

    const networkHandler = (data: unknown) => {
      if (this.currentAccount && data && typeof data === 'object' && 'network' in data) {
        const networkId = (data as { network: string }).network;
        const networkInfo = STANDARD_NETWORKS[networkId] || this.currentAccount.network;
        this.currentAccount = {
          ...this.currentAccount,
          network: networkInfo,
        };
        this.emit('networkChanged', networkInfo);
      }
    };

    const disconnectHandler = () => {
      this.currentAccount = null;
      this.emit('disconnect');
    };

    provider.on('accountChanged', accountHandler);
    provider.on('networkChanged', networkHandler);
    provider.on('disconnected', disconnectHandler);

    this.providerListeners.set('accountChanged', accountHandler);
    this.providerListeners.set('networkChanged', networkHandler);
    this.providerListeners.set('disconnected', disconnectHandler);
  }

  /**
   * Remove listeners from the Otsu provider.
   */
  private removeProviderListeners(provider: OtsuProvider): void {
    for (const [event, handler] of this.providerListeners) {
      provider.off(event, handler);
    }
    this.providerListeners.clear();
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
   * Map Otsu provider errors to xrpl-connect WalletError instances.
   */
  private mapError(
    error: unknown,
    operation: 'connect' | 'sign'
  ): ReturnType<typeof createWalletError.connectionFailed> {
    if (!(error instanceof Error)) {
      if (operation === 'connect') {
        return createWalletError.connectionFailed('Otsu Wallet', new Error(String(error)));
      }
      return createWalletError.signFailed(new Error(String(error)));
    }

    const message = error.message.toLowerCase();

    // User rejected the request
    if (message.includes('reject') || message.includes('denied') || message.includes('cancelled')) {
      if (operation === 'connect') {
        return createWalletError.connectionRejected('Otsu Wallet');
      }
      return createWalletError.signRejected();
    }

    // Extension not installed
    if (message.includes('not installed') || message.includes('not found')) {
      return createWalletError.notInstalled('Otsu Wallet');
    }

    // Timeout
    if (message.includes('timeout')) {
      if (operation === 'connect') {
        return createWalletError.connectionFailed(
          'Otsu Wallet',
          new Error('Connection timed out. Please try again.')
        );
      }
      return createWalletError.signFailed(new Error('Signing timed out. Please try again.'));
    }

    // Generic fallback
    if (operation === 'connect') {
      return createWalletError.connectionFailed('Otsu Wallet', error);
    }
    return createWalletError.signFailed(error);
  }
}
