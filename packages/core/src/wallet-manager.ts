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
  ManagedSignedTransaction,
  ManagedSignedMessage,
  SubmittedTransaction,
  WalletEvent,
  ConnectOptions,
  NetworkConfig,
  NetworkInfo,
  StoredState,
  WalletCapabilities,
} from './types';
import { adapterSupports, supportsFetchAccount } from './types';
import { createWalletError, isWalletError } from './errors';
import { Logger, configureLogger, isLoggerInstance } from './logger';
import { Storage } from './storage';
import { TIME } from './constants';
import { withTimeout } from './async';

const AVAILABILITY_TIMED_OUT = Symbol('availability-timed-out');

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
  private sessionGeneration = 0;
  private stateRevision = 0;
  private storageTail: Promise<void> = Promise.resolve();

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
      const availability = await withTimeout<
        | { available: boolean; error?: never }
        | { available?: never; error: unknown }
        | typeof AVAILABILITY_TIMED_OUT
      >(
        async () => {
          try {
            return { available: await adapter.isAvailable() };
          } catch (error) {
            return { error };
          }
        },
        TIME.AVAILABILITY_TIMEOUT,
        AVAILABILITY_TIMED_OUT
      );
      if (availability === AVAILABILITY_TIMED_OUT) {
        this.logger.warn(
          `Timed out checking availability for ${adapter.name} after ${TIME.AVAILABILITY_TIMEOUT}ms`
        );
        throw createWalletError.notAvailable(adapter.name);
      }
      if ('error' in availability) {
        throw availability.error;
      }
      if (!availability.available) {
        throw createWalletError.notAvailable(adapter.name);
      }

      // Merge network options
      const connectOptions: ConnectOptions = {
        ...options,
        network: options?.network || this.options.network,
      };

      // Connect
      const account = await adapter.connect(connectOptions);

      // Update state before persistence so disconnect can invalidate this
      // session while a storage operation is pending.
      this.currentAdapter = adapter;
      this.currentAccount = this.cloneAccount(account);
      const generation = ++this.sessionGeneration;
      this.stateRevision += 1;

      await this.persistState(adapter, generation, this.currentAccount);
      if (!this.isActiveSession(adapter, generation) || !this.currentAccount) {
        throw createWalletError.notConnected();
      }

      // Subscribe to adapter events if supported. Track every registration so
      // disconnect() can call the matching off() and stop late callbacks from
      // mutating manager state after the session is gone.
      this.subscribeToAdapter(adapter, generation);

      const connectedAccount = this.currentAccount;
      this.logger.info(`Connected to ${adapter.name}`, connectedAccount);
      this.emit('connect', connectedAccount);

      return connectedAccount;
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

    const adapter = this.currentAdapter;
    const generation = this.sessionGeneration;
    const walletName = adapter.name;
    this.logger.info(`Disconnecting from ${walletName}`);

    try {
      await adapter.disconnect();
      const cleaned = await this.cleanup(adapter, generation);
      if (!cleaned) await this.storageTail;
      this.logger.info(`Disconnected from ${walletName}`);
      if (cleaned) this.emit('disconnect');
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
      await this.queueStorage(() => this.storage.clearState());
      return null;
    }
  }

  /**
   * Sign a transaction without submitting it to the ledger
   * @param transaction - The transaction to sign
   * @returns SignedTransaction with signed transaction JSON, a blob, and/or a signature
   */
  async sign(transaction: Transaction): Promise<ManagedSignedTransaction> {
    if (!this.currentAdapter || !this.currentAccount) {
      throw createWalletError.notConnected();
    }
    this.assertSupports('sign');

    this.logger.debug('Signing transaction', transaction);

    const adapter = this.currentAdapter;
    const signerAddress = this.currentAccount.address;
    try {
      const result = await adapter.sign(transaction);
      const signed: ManagedSignedTransaction = {
        ...result,
        signerAddress: result.signerAddress ?? signerAddress,
      };
      this.logger.info('Transaction signed', signed.tx_blob || signed.signature);
      return signed;
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
  async signMessage(message: string | Uint8Array): Promise<ManagedSignedMessage> {
    if (!this.currentAdapter || !this.currentAccount) {
      throw createWalletError.notConnected();
    }
    this.assertSupports('signMessage');

    this.logger.debug('Signing message');

    const adapter = this.currentAdapter;
    const signerAddress = this.currentAccount.address;
    try {
      const result = await adapter.signMessage(message);
      const signed: ManagedSignedMessage = {
        ...result,
        signerAddress: result.signerAddress ?? signerAddress,
      };
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
   * Get registered wallets whose availability check succeeds within the
   * configured availability timeout.
   */
  async getAvailableWallets(): Promise<WalletAdapter[]> {
    const adapters = Array.from(this.adapters.values());

    // Check availability in parallel, capping each adapter with a timeout so a
    // single slow or hung `isAvailable()` can't stall the whole list.
    const results = await Promise.all(
      adapters.map(async (adapter) => {
        const result = await withTimeout<boolean | typeof AVAILABILITY_TIMED_OUT>(
          async () => {
            try {
              return await adapter.isAvailable();
            } catch (error) {
              this.logger.warn(`Failed to check availability for ${adapter.name}:`, error);
              return false;
            }
          },
          TIME.AVAILABILITY_TIMEOUT,
          AVAILABILITY_TIMED_OUT
        );
        if (result === AVAILABILITY_TIMED_OUT) {
          this.logger.warn(
            `Timed out checking availability for ${adapter.name} after ${TIME.AVAILABILITY_TIMEOUT}ms`
          );
          return false;
        }
        return result;
      })
    );

    return adapters.filter((_, index) => results[index]);
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
    if (!this.currentAdapter || !this.currentAccount) {
      throw createWalletError.notConnected();
    }

    const adapter = this.currentAdapter;
    if (!supportsFetchAccount(adapter)) {
      throw createWalletError.unsupportedMethod(
        `${adapter.name} does not support live account refresh`
      );
    }

    const generation = this.sessionGeneration;
    const startingRevision = this.stateRevision;
    const previous = this.cloneAccount(this.currentAccount);
    const fetched = await adapter.fetchAccount();

    if (!this.isActiveSession(adapter, generation)) {
      throw createWalletError.notConnected();
    }

    // An adapter event that arrives during the live query is authoritative.
    // Its persistence was queued synchronously by the event handler.
    if (this.stateRevision !== startingRevision) {
      await this.storageTail;
      if (!this.isActiveSession(adapter, generation)) {
        throw createWalletError.notConnected();
      }
      return this.currentAccount;
    }

    if (!fetched) {
      const cleaned = await this.cleanup(adapter, generation);
      if (cleaned) this.emit('disconnect');
      return null;
    }

    const account = this.cloneAccount(fetched);

    const addressChanged = previous.address !== account.address;
    const networkChanged = !this.networksEqual(previous.network, account.network);

    this.currentAccount = account;
    const committedRevision = ++this.stateRevision;
    await this.persistState(adapter, generation, account);

    if (!this.isActiveSession(adapter, generation)) {
      throw createWalletError.notConnected();
    }

    if (this.stateRevision !== committedRevision) {
      await this.storageTail;
      if (!this.isActiveSession(adapter, generation)) {
        throw createWalletError.notConnected();
      }
      return this.currentAccount;
    }

    if (addressChanged) this.emit('accountChanged', account);
    if (networkChanged) this.emit('networkChanged', account.network);
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
   * Handle adapter disconnect event
   */
  private handleAdapterDisconnect(adapter: WalletAdapter, generation: number): void {
    if (!this.isActiveSession(adapter, generation)) return;

    this.logger.info('Wallet disconnected (adapter event)');
    void this.cleanup(adapter, generation)
      .then((cleaned) => {
        if (cleaned) this.emit('disconnect');
      })
      .catch((error) => {
        this.logger.warn('Failed to clean up disconnected wallet:', error);
      });
  }

  /**
   * Handle account changed event
   */
  private handleAccountChanged(
    adapter: WalletAdapter,
    generation: number,
    account: AccountInfo
  ): void {
    if (!this.isActiveSession(adapter, generation)) return;

    this.logger.info('Account changed', account);
    const nextAccount = this.cloneAccount(account);
    this.currentAccount = nextAccount;
    this.stateRevision += 1;
    void this.persistState(adapter, generation, nextAccount);
    this.emit('accountChanged', nextAccount);
  }

  /**
   * Handle network changed event
   */
  private handleNetworkChanged(
    adapter: WalletAdapter,
    generation: number,
    network: NetworkInfo
  ): void {
    if (!this.isActiveSession(adapter, generation) || !this.currentAccount) return;

    this.logger.info('Network changed', network);
    const nextAccount = this.cloneAccount({ ...this.currentAccount, network });
    this.currentAccount = nextAccount;
    this.stateRevision += 1;
    void this.persistState(adapter, generation, nextAccount);
    this.emit('networkChanged', nextAccount.network);
  }

  /** Serialize storage mutations so cleanup is always the final old-session write. */
  private queueStorage(operation: () => Promise<void>): Promise<void> {
    const result = this.storageTail.then(operation, operation);
    this.storageTail = result.catch((error) => {
      this.logger.warn('Failed to persist wallet state:', error);
    });
    return result;
  }

  /** Persist an immutable session snapshot without restoring stale state. */
  private persistState(
    adapter: WalletAdapter,
    generation: number,
    account: AccountInfo
  ): Promise<void> {
    const snapshot = this.cloneAccount(account);
    return this.queueStorage(async () => {
      if (!this.isActiveSession(adapter, generation)) return;
      const existing = await this.storage.loadState();
      if (!this.isActiveSession(adapter, generation)) return;
      await this.storage.saveState({
        ...(existing ?? {}),
        walletId: adapter.id,
        account: snapshot,
        network: snapshot.network,
        timestamp: Date.now(),
      });
    });
  }

  private isActiveSession(adapter: WalletAdapter, generation: number): boolean {
    return this.currentAdapter === adapter && this.sessionGeneration === generation;
  }

  private cloneAccount(account: AccountInfo): AccountInfo {
    return { ...account, network: { ...account.network } };
  }

  private networksEqual(left: NetworkInfo, right: NetworkInfo): boolean {
    return (
      left.id === right.id &&
      left.name === right.name &&
      left.wss === right.wss &&
      left.rpc === right.rpc &&
      left.walletConnectId === right.walletConnectId
    );
  }

  /**
   * Register adapter listeners and remember them so we can detach later.
   */
  private subscribeToAdapter(adapter: WalletAdapter, generation: number): void {
    if (!adapter.on) return;

    const register = (event: WalletAdapterEvent, callback: (data: unknown) => void): void => {
      adapter.on!(event, callback);
      this.adapterListeners.push({ event, callback });
    };

    register('disconnect', () => this.handleAdapterDisconnect(adapter, generation));
    register('accountChanged', (data) =>
      this.handleAccountChanged(adapter, generation, data as AccountInfo)
    );
    register('networkChanged', (data) =>
      this.handleNetworkChanged(adapter, generation, data as NetworkInfo)
    );
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
  private async cleanup(adapter: WalletAdapter, generation: number): Promise<boolean> {
    if (!this.isActiveSession(adapter, generation)) return false;

    this.unsubscribeFromAdapter(adapter);
    this.currentAdapter = null;
    this.currentAccount = null;
    this.sessionGeneration += 1;
    this.stateRevision += 1;
    await this.queueStorage(() => this.storage.clearState());
    return true;
  }
}
