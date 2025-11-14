/**
 * WalletManager - Core orchestrator for wallet connections
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
} from './types';
import { createWalletError } from './errors';
import { Logger } from './logger';
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
   * Sign and optionally submit a transaction to the ledger
   * This unified method works consistently across all wallets
   * @param transaction - The transaction to sign
   * @param submit - Whether to submit the transaction to the ledger (default: true)
   * @returns SubmittedTransaction with hash and optional submission details
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

    this.logger.debug('Signing message');

    try {
      const signed = await this.currentAdapter.signMessage(message);
      this.logger.info('Message signed');
      return signed;
    } catch (error) {
      this.logger.error('Failed to sign message:', error);
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
}
