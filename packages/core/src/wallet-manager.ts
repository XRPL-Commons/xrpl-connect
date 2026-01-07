/**
 * WalletManager - Core orchestrator for wallet connections
 *
 * This class provides a unified interface for managing wallet connections,
 * signing transactions, and handling wallet events across multiple adapters.
 *
 * @module wallet-manager
 */

import EventEmitter from 'eventemitter3';
import type {
  WalletAdapter,
  WalletManagerOptions,
  AccountInfo,
  Transaction,
  SignedMessage,
  SubmittedTransaction,
  WalletEvent,
  ConnectOptions,
  NetworkInfo,
  StoredState,
  OperationResult,
} from './types';
import { WalletErrorCode, success, failure } from './types';
import {
  createWalletError,
  isWalletError,
  ensureWalletError,
  type WalletError,
} from './errors';
import { Logger } from './logger';
import { Storage } from './storage';
import { TIME } from './constants';

/**
 * Event data types for WalletManager events
 */
export interface WalletManagerEventData {
  connect: AccountInfo;
  disconnect: void;
  accountChanged: AccountInfo;
  networkChanged: NetworkInfo;
  error: WalletError;
}

/**
 * Main class for managing wallet connections
 *
 * @example
 * ```typescript
 * import { WalletManager, XamanAdapter, CrossmarkAdapter } from 'xrpl-connect';
 *
 * const manager = new WalletManager({
 *   adapters: [new XamanAdapter(), new CrossmarkAdapter()],
 *   network: 'mainnet',
 *   autoConnect: true,
 * });
 *
 * // Connect to a wallet
 * try {
 *   const account = await manager.connect('xaman', { apiKey: 'your-api-key' });
 *   console.log('Connected:', account.address);
 * } catch (error) {
 *   if (isWalletError(error)) {
 *     console.log('Error:', error.code, error.recoveryHint);
 *   }
 * }
 *
 * // Or use the safe method that returns a result
 * const result = await manager.connectSafe('xaman', { apiKey: 'your-api-key' });
 * if (result.success) {
 *   console.log('Connected:', result.data.address);
 * } else {
 *   console.log('Error:', result.error.code, result.error.recoveryHint);
 * }
 * ```
 */
export class WalletManager extends EventEmitter<WalletEvent> {
  /** Map of registered wallet adapters by their ID */
  adapters: Map<string, WalletAdapter> = new Map();

  /** Currently connected adapter */
  private currentAdapter: WalletAdapter | null = null;

  /** Currently connected account */
  private currentAccount: AccountInfo | null = null;

  /** Storage for persisting connection state */
  private storage: Storage;

  /** Logger instance */
  private logger: Logger;

  /** Manager configuration options */
  private options: WalletManagerOptions;

  /**
   * Create a new WalletManager instance
   *
   * @param options - Configuration options
   */
  constructor(options: WalletManagerOptions) {
    super();
    this.options = options;

    // Initialize logger
    this.logger = new Logger(options.logger);

    // Initialize storage
    this.storage = new Storage(options.storage);

    // Register adapters
    options.adapters.forEach((adapter) => {
      this.adapters.set(adapter.id, adapter);
      this.logger.debug(`Registered adapter: ${adapter.name} (${adapter.id})`);
    });

    // Auto-connect if enabled
    if (options.autoConnect) {
      this.autoConnect();
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Attempt to auto-connect from stored state
   */
  private async autoConnect(): Promise<void> {
    try {
      const stored = await this.storage.loadState();
      if (stored && this.isStateValid(stored)) {
        this.logger.debug('Attempting auto-reconnect', stored);
        await this.reconnect();
      }
    } catch (error) {
      this.logger.warn('Auto-connect failed:', error);
    }
  }

  /**
   * Check if stored state is still valid (not too old)
   */
  private isStateValid(state: StoredState): boolean {
    const age = Date.now() - state.timestamp;
    return age < TIME.STATE_MAX_AGE;
  }

  /**
   * Handle adapter disconnect event
   */
  private async handleAdapterDisconnect(): Promise<void> {
    this.logger.info('Wallet disconnected (adapter event)');
    await this.cleanup();
    this.emit('disconnect');
  }

  /**
   * Handle account changed event
   */
  private handleAccountChanged(account: AccountInfo): void {
    this.logger.info('Account changed', account);
    this.currentAccount = account;
    this.emit('accountChanged', account);
  }

  /**
   * Handle network changed event
   */
  private handleNetworkChanged(network: NetworkInfo): void {
    this.logger.info('Network changed', network);
    if (this.currentAccount) {
      this.currentAccount.network = network;
    }
    this.emit('networkChanged', network);
  }

  /**
   * Cleanup connection state
   */
  private async cleanup(): Promise<void> {
    this.currentAdapter = null;
    this.currentAccount = null;
    await this.storage.clearState();
  }

  // ===========================================================================
  // Connection Methods
  // ===========================================================================

  /**
   * Connect to a wallet
   *
   * @param walletId - The ID of the wallet adapter to use
   * @param options - Connection options
   * @returns The connected account information
   * @throws {WalletError} If connection fails
   *
   * @example
   * ```typescript
   * try {
   *   const account = await manager.connect('xaman', { apiKey: 'your-key' });
   *   console.log('Connected to:', account.address);
   * } catch (error) {
   *   if (isWalletError(error)) {
   *     console.log('Error code:', error.code);
   *     console.log('Recovery hint:', error.recoveryHint);
   *   }
   * }
   * ```
   */
  async connect(walletId: string, options?: ConnectOptions): Promise<AccountInfo> {
    this.logger.info(`Connecting to wallet: ${walletId}`);

    // Get adapter
    const adapter = this.adapters.get(walletId);
    if (!adapter) {
      throw createWalletError.notFound(walletId);
    }

    // Check if already connected to a different wallet
    if (this.currentAdapter && this.currentAdapter.id !== walletId) {
      throw createWalletError.alreadyConnected(this.currentAdapter.name);
    }

    try {
      // Check availability
      const available = await adapter.isAvailable();
      if (!available) {
        throw createWalletError.notAvailable(adapter.name);
      }

      // Merge network options
      const connectOptions: ConnectOptions = {
        ...options,
        network: options?.network || this.options.network,
      };

      // Connect
      const account = await adapter.connect(connectOptions);

      // Update state
      this.currentAdapter = adapter;
      this.currentAccount = account;

      // Save to storage
      const state: StoredState = {
        walletId: adapter.id,
        account,
        network: account.network,
        timestamp: Date.now(),
      };
      await this.storage.saveState(state);

      // Subscribe to adapter events if supported
      if (adapter.on) {
        adapter.on('disconnect', () => this.handleAdapterDisconnect());
        adapter.on('accountChanged', (data) => this.handleAccountChanged(data as AccountInfo));
        adapter.on('networkChanged', (data) => this.handleNetworkChanged(data as NetworkInfo));
      }

      this.logger.info(`Connected to ${adapter.name}`, account);
      this.emit('connect', account);

      return account;
    } catch (error) {
      this.logger.error(`Failed to connect to ${adapter.name}:`, error);

      // Re-throw if already a WalletError
      if (isWalletError(error)) {
        throw error;
      }

      // Wrap in a connection failed error
      throw createWalletError.connectionFailed(adapter.name, error as Error);
    }
  }

  /**
   * Connect to a wallet (safe version that returns a result)
   *
   * This method never throws - it returns a discriminated union result
   * that you can check for success or failure.
   *
   * @param walletId - The ID of the wallet adapter to use
   * @param options - Connection options
   * @returns A result object indicating success or failure
   *
   * @example
   * ```typescript
   * const result = await manager.connectSafe('xaman', { apiKey: 'your-key' });
   * if (result.success) {
   *   console.log('Connected to:', result.data.address);
   * } else {
   *   console.log('Error:', result.error.code);
   *   console.log('Recovery:', result.error.recoveryHint);
   * }
   * ```
   */
  async connectSafe(walletId: string, options?: ConnectOptions): Promise<OperationResult<AccountInfo>> {
    try {
      const account = await this.connect(walletId, options);
      return success(account);
    } catch (error) {
      const walletError = ensureWalletError(error, WalletErrorCode.CONNECTION_FAILED);
      return failure(walletError.code, walletError.message, walletError.recoveryHint);
    }
  }

  /**
   * Disconnect from current wallet
   */
  async disconnect(): Promise<void> {
    if (!this.currentAdapter) {
      this.logger.warn('No wallet connected');
      return;
    }

    const walletName = this.currentAdapter.name;
    this.logger.info(`Disconnecting from ${walletName}`);

    try {
      await this.currentAdapter.disconnect();
      await this.cleanup();
      this.logger.info(`Disconnected from ${walletName}`);
      this.emit('disconnect');
    } catch (error) {
      this.logger.error(`Failed to disconnect from ${walletName}:`, error);
      throw error;
    }
  }

  /**
   * Reconnect to previously connected wallet
   *
   * @returns The reconnected account, or null if no previous connection
   */
  async reconnect(): Promise<AccountInfo | null> {
    const stored = await this.storage.loadState();
    if (!stored) {
      this.logger.debug('No stored state found for reconnection');
      return null;
    }

    try {
      return await this.connect(stored.walletId);
    } catch (error) {
      this.logger.warn('Reconnection failed:', error);
      await this.storage.clearState();
      return null;
    }
  }

  // ===========================================================================
  // Transaction Methods
  // ===========================================================================

  /**
   * Sign and optionally submit a transaction to the ledger
   *
   * This unified method works consistently across all wallets.
   *
   * @param transaction - The transaction to sign
   * @param submit - Whether to submit the transaction to the ledger (default: true)
   * @returns The submitted transaction result with hash and optional submission details
   * @throws {WalletError} If signing or submission fails
   *
   * @example
   * ```typescript
   * const tx = {
   *   TransactionType: 'Payment',
   *   Destination: 'rDestination...',
   *   Amount: '1000000', // 1 XRP in drops
   * };
   *
   * try {
   *   const result = await manager.signAndSubmit(tx);
   *   console.log('Transaction hash:', result.hash);
   * } catch (error) {
   *   if (isWalletError(error)) {
   *     if (error.code === WalletErrorCode.SIGN_REJECTED) {
   *       console.log('User rejected the transaction');
   *     }
   *   }
   * }
   * ```
   */
  async signAndSubmit(
    transaction: Transaction,
    submit: boolean = true
  ): Promise<SubmittedTransaction> {
    if (!this.currentAdapter) {
      throw createWalletError.notConnected();
    }

    this.logger.debug(`${submit ? 'Signing and submitting' : 'Signing'} transaction`, transaction);

    try {
      const result = await this.currentAdapter.signAndSubmit(transaction, submit);
      this.logger.info(`Transaction ${submit ? 'submitted' : 'signed'}`, result.hash || result.id);
      return result;
    } catch (error) {
      this.logger.error(`Failed to ${submit ? 'submit' : 'sign'} transaction:`, error);

      // Re-throw if already a WalletError
      if (isWalletError(error)) {
        throw error;
      }

      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign and submit a transaction (safe version that returns a result)
   *
   * @param transaction - The transaction to sign
   * @param submit - Whether to submit the transaction (default: true)
   * @returns A result object indicating success or failure
   */
  async signAndSubmitSafe(
    transaction: Transaction,
    submit: boolean = true
  ): Promise<OperationResult<SubmittedTransaction>> {
    try {
      const result = await this.signAndSubmit(transaction, submit);
      return success(result);
    } catch (error) {
      const walletError = ensureWalletError(error, WalletErrorCode.SIGN_FAILED);
      return failure(walletError.code, walletError.message, walletError.recoveryHint);
    }
  }

  /**
   * Sign a message
   *
   * @param message - The message to sign (string or Uint8Array)
   * @returns The signed message with signature and public key
   * @throws {WalletError} If signing fails
   */
  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    if (!this.currentAdapter) {
      throw createWalletError.notConnected();
    }

    this.logger.debug('Signing message');

    try {
      const signed = await this.currentAdapter.signMessage(message);
      this.logger.info('Message signed');
      return signed;
    } catch (error) {
      this.logger.error('Failed to sign message:', error);

      // Re-throw if already a WalletError
      if (isWalletError(error)) {
        throw error;
      }

      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign a message (safe version that returns a result)
   *
   * @param message - The message to sign
   * @returns A result object indicating success or failure
   */
  async signMessageSafe(message: string | Uint8Array): Promise<OperationResult<SignedMessage>> {
    try {
      const result = await this.signMessage(message);
      return success(result);
    } catch (error) {
      const walletError = ensureWalletError(error, WalletErrorCode.SIGN_FAILED);
      return failure(walletError.code, walletError.message, walletError.recoveryHint);
    }
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Get list of available wallets (installed/accessible)
   *
   * @returns Array of available wallet adapters
   */
  async getAvailableWallets(): Promise<WalletAdapter[]> {
    const available: WalletAdapter[] = [];

    for (const adapter of this.adapters.values()) {
      try {
        const isAvailable = await adapter.isAvailable();
        if (isAvailable) {
          available.push(adapter);
        }
      } catch (error) {
        this.logger.warn(`Failed to check availability for ${adapter.name}:`, error);
      }
    }

    return available;
  }

  /**
   * Get a specific wallet adapter by ID
   *
   * @param walletId - The adapter ID
   * @returns The wallet adapter, or undefined if not found
   */
  getAdapter(walletId: string): WalletAdapter | undefined {
    return this.adapters.get(walletId);
  }

  /**
   * Check if a specific wallet is available
   *
   * @param walletId - The adapter ID
   * @returns True if the wallet is available
   */
  async isWalletAvailable(walletId: string): Promise<boolean> {
    const adapter = this.adapters.get(walletId);
    if (!adapter) {
      return false;
    }

    try {
      return await adapter.isAvailable();
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // State Properties
  // ===========================================================================

  /**
   * Check if currently connected to a wallet
   */
  get connected(): boolean {
    return this.currentAdapter !== null && this.currentAccount !== null;
  }

  /**
   * Get current account (null if not connected)
   */
  get account(): AccountInfo | null {
    return this.currentAccount;
  }

  /**
   * Get current wallet adapter (null if not connected)
   */
  get wallet(): WalletAdapter | null {
    return this.currentAdapter;
  }

  /**
   * Get current wallet ID (null if not connected)
   */
  get walletId(): string | null {
    return this.currentAdapter?.id ?? null;
  }

  /**
   * Get current network (null if not connected)
   */
  get network(): NetworkInfo | null {
    return this.currentAccount?.network ?? null;
  }

  /**
   * Get all registered adapters
   */
  get wallets(): WalletAdapter[] {
    return Array.from(this.adapters.values());
  }
}
