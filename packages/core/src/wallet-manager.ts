/**
 * WalletManager - Core orchestrator for wallet connections
 */

import EventEmitter from 'eventemitter3';
import type {
  WalletAdapter,
  WalletAdapterEvent,
  WalletManagerOptions,
  AccountInfo,
  Transaction,
  SignedTransaction,
  SignedMessage,
  SubmittedTransaction,
  WalletEvent,
  ConnectOptions,
  NetworkConfig,
  NetworkInfo,
  StoredState,
  WalletCapabilities,
} from './types';
import { adapterSupports } from './types';
import { createWalletError, isWalletError } from './errors';
import { Logger, configureLogger, isLoggerInstance } from './logger';
import { Storage } from './storage';
import { TIME } from './constants';

/**
 * Main class for managing wallet connections
 */
export class WalletManager extends EventEmitter<WalletEvent> {
  adapters: Map<string, WalletAdapter> = new Map();
  private currentAdapter: WalletAdapter | null = null;
  private currentAccount: AccountInfo | null = null;
  private storage: Storage;
  private logger: Logger;
  private options: WalletManagerOptions;
  private adapterListeners: Array<{
    event: WalletAdapterEvent;
    callback: (data: unknown) => void;
  }> = [];

  constructor(options: WalletManagerOptions) {
    super();
    this.options = options;

    // Apply logger configuration globally so adapter-level loggers honour it,
    // then build the manager's own Logger. A user-supplied LoggerInstance
    // routes through `configureLogger`; LoggerOptions also drive the local logger.
    configureLogger(options.logger);
    this.logger = new Logger(isLoggerInstance(options.logger) ? undefined : options.logger);

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
   * Connect to a wallet
   */
  async connect(walletId: string, options?: ConnectOptions): Promise<AccountInfo> {
    this.logger.info(`Connecting to wallet: ${walletId}`);

    // Get adapter
    const adapter = this.adapters.get(walletId);
    if (!adapter) {
      throw createWalletError.notFound(walletId);
    }

    // Check if already connected
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

      // Subscribe to adapter events if supported. Track every registration so
      // disconnect() can call the matching off() and stop late callbacks from
      // mutating manager state after the session is gone.
      this.subscribeToAdapter(adapter);

      this.logger.info(`Connected to ${adapter.name}`, account);
      this.emit('connect', account);

      return account;
    } catch (error) {
      this.logger.error(`Failed to connect to ${adapter.name}:`, error);
      // Preserve adapter-thrown WalletError so user-rejection / not-installed / etc.
      // surface with their original code & category instead of collapsing into CONNECTION_FAILED.
      if (isWalletError(error)) {
        throw error;
      }
      throw createWalletError.connectionFailed(adapter.name, error as Error);
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

  /**
   * Sign a transaction without submitting it to the ledger
   * @param transaction - The transaction to sign
   * @returns SignedTransaction with tx_blob and/or signature
   */
  async sign(transaction: Transaction): Promise<SignedTransaction> {
    if (!this.currentAdapter) {
      throw createWalletError.notConnected();
    }
    this.assertSupports('sign');

    this.logger.debug('Signing transaction', transaction);

    try {
      const result = await this.currentAdapter.sign(transaction);
      this.stampSigner(result);
      this.logger.info('Transaction signed', result.tx_blob || result.signature);
      return result;
    } catch (error) {
      this.logger.error('Failed to sign transaction:', error);
      if (isWalletError(error)) {
        throw error;
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign and submit a transaction to the ledger
   * @param transaction - The transaction to sign and submit
   * @returns SubmittedTransaction with hash from ledger confirmation
   */
  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    if (!this.currentAdapter) {
      throw createWalletError.notConnected();
    }
    this.assertSupports('signAndSubmit');

    this.logger.debug('Signing and submitting transaction', transaction);

    try {
      const result = await this.currentAdapter.signAndSubmit(transaction);
      this.logger.info('Transaction submitted', result.hash || result.id);
      return result;
    } catch (error) {
      this.logger.error('Failed to submit transaction:', error);
      if (isWalletError(error)) {
        throw error;
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign a message
   */
  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    if (!this.currentAdapter) {
      throw createWalletError.notConnected();
    }
    this.assertSupports('signMessage');

    this.logger.debug('Signing message');

    try {
      const signed = await this.currentAdapter.signMessage(message);
      this.stampSigner(signed);
      this.logger.info('Message signed');
      return signed;
    } catch (error) {
      this.logger.error('Failed to sign message:', error);
      if (isWalletError(error)) {
        throw error;
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Get list of available wallets (installed/accessible)
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
   * Whether the connected wallet (or a given adapter) supports a capability.
   * Returns `false` when no wallet is connected and no adapter is passed.
   *
   * Lets callers hide/disable UI for operations a wallet can't perform (e.g.
   * a "Sign message" button for Xaman/WalletConnect) instead of letting the
   * call fail at runtime.
   */
  supports(
    capability: keyof WalletCapabilities,
    adapter: WalletAdapter | null = this.currentAdapter
  ): boolean {
    return adapter ? adapterSupports(adapter, capability) : false;
  }

  /**
   * Re-fetch the account live from the connected wallet and refresh the cached
   * value, emitting `accountChanged` if it changed. Use this when you need the
   * current on-wallet account rather than the cached `account` getter (e.g. the
   * user may have switched accounts in the wallet).
   */
  async fetchAccount(): Promise<AccountInfo | null> {
    if (!this.currentAdapter) {
      throw createWalletError.notConnected();
    }

    const account = await this.currentAdapter.getAccount();
    if (account && account.address !== this.currentAccount?.address) {
      this.handleAccountChanged(account);
    } else if (account) {
      this.currentAccount = account;
    }
    return account;
  }

  /**
   * Get current connection state
   */
  get connected(): boolean {
    return this.currentAdapter !== null && this.currentAccount !== null;
  }

  /**
   * Get current account
   */
  get account(): AccountInfo | null {
    return this.currentAccount;
  }

  /**
   * Get current wallet adapter
   */
  get wallet(): WalletAdapter | null {
    return this.currentAdapter;
  }

  /**
   * Get all registered adapters
   */
  get wallets(): WalletAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Default network configured on the manager, if any.
   */
  get defaultNetwork(): NetworkConfig | undefined {
    return this.options.network;
  }

  /**
   * Throw a typed `UNSUPPORTED_METHOD` error if the connected wallet declares
   * it can't perform the given capability.
   */
  private assertSupports(capability: keyof WalletCapabilities): void {
    if (this.currentAdapter && !adapterSupports(this.currentAdapter, capability)) {
      throw createWalletError.unsupportedMethod(
        `${this.currentAdapter.name} does not support "${capability}"`
      );
    }
  }

  /**
   * Populate `signerAddress` on a sign result with the connected account when
   * the adapter didn't already set it, so callers always know which account
   * produced the signature.
   */
  private stampSigner(result: { signerAddress?: string }): void {
    if (result.signerAddress == null && this.currentAccount) {
      result.signerAddress = this.currentAccount.address;
    }
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
   * Register adapter listeners and remember them so we can detach later.
   */
  private subscribeToAdapter(adapter: WalletAdapter): void {
    if (!adapter.on) return;

    const register = (event: WalletAdapterEvent, callback: (data: unknown) => void): void => {
      adapter.on!(event, callback);
      this.adapterListeners.push({ event, callback });
    };

    register('disconnect', () => this.handleAdapterDisconnect());
    register('accountChanged', (data) => this.handleAccountChanged(data as AccountInfo));
    register('networkChanged', (data) => this.handleNetworkChanged(data as NetworkInfo));
  }

  /**
   * Detach every listener registered via subscribeToAdapter.
   */
  private unsubscribeFromAdapter(adapter: WalletAdapter): void {
    if (adapter.off) {
      for (const { event, callback } of this.adapterListeners) {
        try {
          adapter.off(event, callback);
        } catch (error) {
          this.logger.warn(`Failed to detach adapter listener for ${event}:`, error);
        }
      }
    }
    this.adapterListeners = [];
  }

  /**
   * Cleanup connection state
   */
  private async cleanup(): Promise<void> {
    if (this.currentAdapter) {
      this.unsubscribeFromAdapter(this.currentAdapter);
    }
    this.currentAdapter = null;
    this.currentAccount = null;
    await this.storage.clearState();
  }
}
