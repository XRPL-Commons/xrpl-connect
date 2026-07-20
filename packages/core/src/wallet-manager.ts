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
  ReconnectOptions,
  StoredState,
} from './types';
import { supportsNetworkSwitch, supportsReconnectOptions } from './types';
import { createWalletError, isWalletError } from './errors';
import { Logger, configureLogger, isLoggerInstance } from './logger';
import { Storage } from './storage';
import { TIME } from './constants';
import { withTimeout } from './async';

const AVAILABILITY_TIMED_OUT = Symbol('availability-timed-out');

interface ConnectionAttempt {
  adapter: WalletAdapter;
  automatic: boolean;
  cancelled: boolean;
  adapterConnectStarted: boolean;
  disconnectRequestedAfterConnect: boolean;
  cleanupPromise?: Promise<void>;
}

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
  private sessionGeneration = 0;
  private disconnecting = false;
  private networkEventRevision = 0;
  private networkEventPersistence: Promise<void> = Promise.resolve();
  private networkMutationQueue: { tail: Promise<void> } = { tail: Promise.resolve() };
  private storageMutationQueue: Promise<void> = Promise.resolve();
  private currentReconnectOptions: ReconnectOptions | undefined;
  private connectionAttempt: ConnectionAttempt | null = null;
  private reconnectGeneration = 0;
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
      await this.reconnectFromStorage(true);
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
    this.reconnectGeneration += 1;
    if (this.currentAdapter?.id === walletId && this.currentAccount && !this.disconnecting) {
      return this.cloneAccount(this.currentAccount);
    }
    const attempt = this.connectionAttempt;
    if (attempt) {
      if (!attempt.automatic) {
        throw createWalletError.alreadyConnected(attempt.adapter.name);
      }
      await this.cancelConnectionAttempt(attempt);
    }
    return this.startConnection(walletId, options, undefined, false);
  }

  private startConnection(
    walletId: string,
    options: ConnectOptions | undefined,
    expectedState: StoredState | undefined,
    automatic: boolean
  ): Promise<AccountInfo> {
    const adapter = this.adapters.get(walletId);
    if (!adapter) {
      throw createWalletError.notFound(walletId);
    }
    if (this.currentAdapter) {
      throw createWalletError.alreadyConnected(this.currentAdapter.name);
    }
    if (this.connectionAttempt) {
      throw createWalletError.alreadyConnected(this.connectionAttempt.adapter.name);
    }

    const attempt: ConnectionAttempt = {
      adapter,
      automatic,
      cancelled: false,
      adapterConnectStarted: false,
      disconnectRequestedAfterConnect: false,
    };
    this.connectionAttempt = attempt;
    return this.connectInternal(adapter, options, expectedState, attempt);
  }

  private async connectInternal(
    adapter: WalletAdapter,
    options: ConnectOptions | undefined,
    expectedState: StoredState | undefined,
    attempt: ConnectionAttempt
  ): Promise<AccountInfo> {
    this.logger.info(`Connecting to wallet: ${adapter.id}`);

    let adapterConnected = false;
    let connectionCommitted = false;

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
      this.assertConnectionAttemptActive(attempt);

      // Merge network options
      const connectOptions: ConnectOptions = {
        ...options,
        network: options?.network || this.options.network,
      };

      // Connect and detach manager state from adapter-owned mutable objects.
      attempt.adapterConnectStarted = true;
      const adapterAccount = await adapter.connect(connectOptions);
      adapterConnected = true;
      this.assertConnectionAttemptActive(attempt);
      const account = this.cloneAccount(adapterAccount);

      if (expectedState && supportsReconnectOptions(adapter)) {
        if (account.address !== expectedState.account.address) {
          throw createWalletError.connectionFailed(
            adapter.name,
            new Error(
              `Reconnected account mismatch. Expected "${expectedState.account.address}" but wallet returned "${account.address}".`
            )
          );
        }
        if (account.network.id !== expectedState.network.id) {
          throw createWalletError.networkMismatch(expectedState.network.id, account.network.id);
        }
      }

      // Let adapters explicitly select the minimal JSON-safe reconnect state.
      // Never persist arbitrary caller-provided options.
      const reconnectOptions = supportsReconnectOptions(adapter)
        ? adapter.serializeReconnectOptions(connectOptions)
        : undefined;
      this.assertConnectionAttemptActive(attempt);
      const state = this.createStoredState(adapter, account, account.network, reconnectOptions);
      await this.enqueueStorageMutation(() => this.storage.saveState(state));
      this.assertConnectionAttemptActive(attempt);

      // Commit manager state only after reconnect validation, option
      // serialization, and persistence have completed successfully.
      // The generation distinguishes this session from any earlier connection
      // that reused the same adapter or account object.
      const session = ++this.sessionGeneration;
      this.disconnecting = false;
      this.networkEventRevision = 0;
      this.networkEventPersistence = Promise.resolve();
      this.networkMutationQueue = { tail: Promise.resolve() };
      this.currentAdapter = adapter;
      this.currentAccount = account;
      this.currentReconnectOptions = reconnectOptions ? { ...reconnectOptions } : undefined;

      // Subscribe to adapter events if supported. Track every registration so
      // disconnect() can call the matching off() and stop late callbacks from
      // mutating manager state after the session is gone.
      this.subscribeToAdapter(adapter, session);
      connectionCommitted = true;

      this.logger.info(`Connected to ${adapter.name}`, account);
      this.emit('connect', account);

      return account;
    } catch (error) {
      if (adapterConnected && !connectionCommitted) {
        const newerSessionUsesAdapter = this.currentAdapter === adapter;
        const newerAttemptUsesAdapter =
          this.connectionAttempt !== attempt && this.connectionAttempt?.adapter === adapter;
        if (!attempt.cancelled && !this.currentAdapter) {
          await this.enqueueStorageMutation(() => this.storage.clearState());
        }
        if (
          !newerSessionUsesAdapter &&
          !newerAttemptUsesAdapter &&
          !attempt.disconnectRequestedAfterConnect
        ) {
          try {
            await adapter.disconnect();
          } catch (disconnectError) {
            this.logger.warn(
              `Failed to clean up ${adapter.name} after connection failure:`,
              disconnectError
            );
          }
        }
      }
      this.logger.error(`Failed to connect to ${adapter.name}:`, error);
      // Preserve adapter-thrown WalletError so user-rejection / not-installed / etc.
      // surface with their original code & category instead of collapsing into CONNECTION_FAILED.
      if (isWalletError(error)) {
        throw error;
      }
      throw createWalletError.connectionFailed(adapter.name, error as Error);
    } finally {
      if (this.connectionAttempt === attempt) {
        this.connectionAttempt = null;
      }
    }
  }

  /**
   * Disconnect from current wallet
   */
  async disconnect(): Promise<void> {
    this.reconnectGeneration += 1;
    const attempt = this.connectionAttempt;
    if (attempt) {
      await this.cancelConnectionAttempt(attempt);
    }
    if (!this.currentAdapter) {
      this.logger.warn('No wallet connected');
      return;
    }

    const walletName = this.currentAdapter.name;
    const adapter = this.currentAdapter;
    const session = this.sessionGeneration;
    this.logger.info(`Disconnecting from ${walletName}`);
    this.disconnecting = true;

    try {
      await adapter.disconnect();
      if (this.currentAdapter !== adapter || this.sessionGeneration !== session) {
        return;
      }
      await this.cleanup();
      this.logger.info(`Disconnected from ${walletName}`);
      this.emit('disconnect');
    } catch (error) {
      if (this.sessionGeneration === session) this.disconnecting = false;
      this.logger.error(`Failed to disconnect from ${walletName}:`, error);
      throw error;
    }
  }

  /**
   * Reconnect to previously connected wallet
   */
  async reconnect(): Promise<AccountInfo | null> {
    return this.reconnectFromStorage(false);
  }

  private async reconnectFromStorage(automatic: boolean): Promise<AccountInfo | null> {
    if (this.currentAdapter || this.connectionAttempt) {
      this.logger.debug('Skipping reconnect because a wallet session is already active');
      return null;
    }

    const reconnectGeneration = ++this.reconnectGeneration;
    const sessionGeneration = this.sessionGeneration;
    const stored = await this.enqueueStorageMutation(() => this.storage.loadState());
    if (!stored) {
      this.logger.debug('No stored state found for reconnection');
      return null;
    }
    if (automatic && !this.isStateValid(stored)) return null;
    if (
      this.currentAdapter ||
      this.connectionAttempt ||
      this.sessionGeneration !== sessionGeneration ||
      this.reconnectGeneration !== reconnectGeneration
    ) {
      return null;
    }

    try {
      if (automatic) this.logger.debug('Attempting auto-reconnect', stored);
      // Replay the original connect options so wallet-specific selections
      // (e.g. the Ledger derivation path / account index) are restored instead
      // of reconnecting to the default account.
      return await this.startConnection(
        stored.walletId,
        {
          ...stored.connectOptions,
          network: stored.network,
          autoReconnect: true,
        },
        stored,
        automatic
      );
    } catch (error) {
      this.logger.warn('Reconnection failed:', error);
      if (
        !this.currentAdapter &&
        !this.connectionAttempt &&
        this.sessionGeneration === sessionGeneration &&
        this.reconnectGeneration === reconnectGeneration
      ) {
        await this.enqueueStorageMutation(() => this.storage.clearState());
      }
      return null;
    }
  }

  /**
   * Sign a transaction without submitting it to the ledger
   * @param transaction - The transaction to sign
   * @returns SignedTransaction with signed transaction JSON, a blob, and/or a signature
   */
  async sign(transaction: Transaction): Promise<SignedTransaction> {
    if (!this.currentAdapter) {
      throw createWalletError.notConnected();
    }

    this.logger.debug('Signing transaction', transaction);

    try {
      const result = await this.currentAdapter.sign(transaction);
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

    this.logger.debug('Signing message');

    try {
      const signed = await this.currentAdapter.signMessage(message);
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
   * Get the current network reported by the connected adapter.
   *
   * @throws `NOT_CONNECTED` when no wallet session is active.
   * @throws `UNKNOWN_ERROR` for malformed responses and untyped adapter failures.
   */
  async getNetwork(): Promise<NetworkInfo> {
    if (!this.currentAdapter) {
      throw createWalletError.notConnected();
    }
    const adapter = this.currentAdapter;
    const session = this.sessionGeneration;
    try {
      this.getSessionAccount(adapter, session);
      const network = await adapter.getNetwork();
      this.getSessionAccount(adapter, session);
      return this.validateNetwork(network, adapter.name);
    } catch (error) {
      if (isWalletError(error)) throw error;
      throw createWalletError.unknown(
        `Failed to read the active network from ${adapter.name}.`,
        error as Error
      );
    }
  }

  /**
   * Switch the active network at runtime.
   *
   * The connected adapter must implement {@link SupportsNetworkSwitch}. The
   * manager never simulates a switch locally because that could make the dApp
   * report a different network from the wallet that will sign the transaction.
   *
   * @returns the authoritative network reported by the adapter after switching.
   * @throws `NOT_CONNECTED` when no wallet session is active.
   * @throws `UNSUPPORTED_METHOD` when the adapter cannot request a native switch.
   * @throws `UNKNOWN_ERROR` for malformed responses and untyped adapter failures.
   */
  async switchNetwork(network: NetworkConfig): Promise<NetworkInfo> {
    if (!this.currentAdapter) {
      throw createWalletError.notConnected();
    }

    const adapter = this.currentAdapter;
    const session = this.sessionGeneration;
    if (!supportsNetworkSwitch(adapter)) {
      throw createWalletError.unsupportedMethod(
        `${adapter.name} does not support runtime network switching`
      );
    }

    return this.enqueueNetworkMutation(async () => {
      try {
        const account = this.getSessionAccount(adapter, session);
        const previousNetwork = { ...account.network };
        const eventRevision = this.networkEventRevision;
        this.logger.info('Switching network via adapter', network);
        const result = await adapter.switchNetwork(network);
        let currentAccount = this.getSessionAccount(adapter, session);

        const applied = this.validateNetwork(result, adapter.name);
        const eventRevisionAtResolution = this.networkEventRevision;
        if (eventRevisionAtResolution !== eventRevision) {
          const eventPersistenceAtResolution = this.networkEventPersistence;
          await eventPersistenceAtResolution;
          currentAccount = this.getSessionAccount(adapter, session);
          if (this.networkEventRevision !== eventRevisionAtResolution) {
            await this.networkEventPersistence;
            return { ...this.getSessionAccount(adapter, session).network };
          }
          if (this.networksEqual(currentAccount.network, applied)) {
            return { ...applied };
          }
        }
        await this.applyNetwork(
          adapter,
          session,
          applied,
          eventRevisionAtResolution === eventRevision
            ? !this.networksEqual(previousNetwork, applied)
            : !this.networksEqual(currentAccount.network, applied)
        );
        if (this.networkEventRevision !== eventRevisionAtResolution) {
          await this.networkEventPersistence;
          return { ...this.getSessionAccount(adapter, session).network };
        }
        return { ...applied };
      } catch (error) {
        if (isWalletError(error)) throw error;
        throw createWalletError.unknown(
          `Failed to switch ${adapter.name} to the requested network.`,
          error as Error
        );
      }
    });
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
   * Handle adapter disconnect event
   */
  private async handleAdapterDisconnect(adapter: WalletAdapter, session: number): Promise<void> {
    if (!this.isCurrentSession(adapter, session)) return;
    this.logger.info('Wallet disconnected (adapter event)');
    await this.cleanup();
    this.emit('disconnect');
  }

  /**
   * Handle account changed event
   */
  private handleAccountChanged(
    adapter: WalletAdapter,
    session: number,
    account: AccountInfo
  ): void {
    if (!this.isCurrentSession(adapter, session)) return;
    const currentAccount = this.cloneAccount(account);
    this.logger.info('Account changed', currentAccount);
    this.currentAccount = currentAccount;
    // Reconnect options select the account established by connect(). Once an
    // adapter reports a different account, those selectors are no longer safe
    // to persist alongside later session updates.
    this.currentReconnectOptions = undefined;
    this.emit('accountChanged', currentAccount);
  }

  /**
   * Handle network changed event
   */
  private handleNetworkChanged(adapter: WalletAdapter, session: number, value: unknown): void {
    if (!this.isCurrentSession(adapter, session)) return;
    try {
      const network = this.validateNetwork(value, adapter.name);
      this.networkEventRevision += 1;
      const account = this.getSessionAccount(adapter, session);
      const changed = !this.networksEqual(account.network, network);

      this.logger.info('Network changed', network);
      this.networkEventPersistence = this.applyNetwork(adapter, session, network, changed);
      void this.networkEventPersistence.catch((error) => {
        if (isWalletError(error) && error.code === 'NOT_CONNECTED') return;
        this.logger.warn(`Failed to persist a network change from ${adapter.name}:`, error);
        this.emit('error', error);
      });
    } catch (error) {
      this.logger.warn(`Failed to apply a network change from ${adapter.name}:`, error);
      this.emit('error', error);
    }
  }

  /**
   * Apply an authoritative network change: update the cached account, persist a
   * snapshot of the current session, and emit `networkChanged` when requested.
   */
  private async applyNetwork(
    adapter: WalletAdapter,
    session: number,
    network: NetworkInfo,
    emitEvent: boolean
  ): Promise<void> {
    const account = this.getSessionAccount(adapter, session);
    const currentAccount = { ...account, network: { ...network } };
    this.currentAccount = currentAccount;
    const state = this.createStoredState(
      adapter,
      currentAccount,
      network,
      this.currentReconnectOptions
    );
    const persistence = this.enqueueStorageMutation(() => this.storage.saveState(state));
    if (emitEvent) this.emit('networkChanged', network);
    await persistence;
    this.getSessionAccount(adapter, session);
  }

  private createStoredState(
    adapter: WalletAdapter,
    account: AccountInfo,
    network: NetworkInfo,
    reconnectOptions?: ReconnectOptions
  ): StoredState {
    const storedNetwork = { ...network };
    return {
      walletId: adapter.id,
      account: { ...account, network: storedNetwork },
      network: storedNetwork,
      timestamp: Date.now(),
      ...(reconnectOptions ? { connectOptions: { ...reconnectOptions } } : {}),
    };
  }

  private cloneAccount(account: AccountInfo): AccountInfo {
    return { ...account, network: { ...account.network } };
  }

  private validateNetwork(network: unknown, walletName: string): NetworkInfo {
    if (
      !network ||
      typeof network !== 'object' ||
      typeof (network as Partial<NetworkInfo>).id !== 'string' ||
      typeof (network as Partial<NetworkInfo>).name !== 'string' ||
      typeof (network as Partial<NetworkInfo>).wss !== 'string' ||
      ((network as Partial<NetworkInfo>).rpc !== undefined &&
        typeof (network as Partial<NetworkInfo>).rpc !== 'string') ||
      ((network as Partial<NetworkInfo>).walletConnectId !== undefined &&
        typeof (network as Partial<NetworkInfo>).walletConnectId !== 'string')
    ) {
      throw createWalletError.unknown(`${walletName} returned an invalid network response.`);
    }
    return network as NetworkInfo;
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

  private isCurrentSession(adapter: WalletAdapter, session: number): boolean {
    return (
      !this.disconnecting &&
      this.currentAdapter === adapter &&
      this.currentAccount !== null &&
      this.sessionGeneration === session
    );
  }

  private assertConnectionAttemptActive(attempt: ConnectionAttempt): void {
    if (attempt.cancelled || this.connectionAttempt !== attempt) {
      throw createWalletError.notConnected();
    }
  }

  private async cancelConnectionAttempt(attempt: ConnectionAttempt): Promise<void> {
    attempt.cancelled = true;
    if (this.connectionAttempt === attempt) {
      this.connectionAttempt = null;
    }

    attempt.cleanupPromise ??= Promise.all([
      this.enqueueStorageMutation(() => this.storage.clearState()),
      attempt.adapterConnectStarted
        ? (() => {
            // This teardown owns all cleanup for a cancelled attempt. A late
            // connect result must never schedule a second disconnect that can
            // race a replacement using the same adapter.
            attempt.disconnectRequestedAfterConnect = true;
            return attempt.adapter.disconnect().catch((error) => {
              this.logger.warn(`Failed to cancel connection to ${attempt.adapter.name}:`, error);
              throw error;
            });
          })()
        : Promise.resolve(),
    ]).then(() => undefined);
    await attempt.cleanupPromise;
  }

  private getSessionAccount(adapter: WalletAdapter, session: number): AccountInfo {
    if (!this.isCurrentSession(adapter, session)) {
      throw createWalletError.notConnected();
    }
    return this.currentAccount as AccountInfo;
  }

  private enqueueNetworkMutation<T>(mutation: () => Promise<T>): Promise<T> {
    const queue = this.networkMutationQueue;
    const result = queue.tail.then(mutation);
    queue.tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private enqueueStorageMutation<T>(mutation: () => Promise<T>): Promise<T> {
    const result = this.storageMutationQueue.then(mutation);
    this.storageMutationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  /**
   * Register adapter listeners and remember them so we can detach later.
   */
  private subscribeToAdapter(adapter: WalletAdapter, session: number): void {
    if (!adapter.on) return;

    const register = (event: WalletAdapterEvent, callback: (data: unknown) => void): void => {
      adapter.on!(event, callback);
      this.adapterListeners.push({ event, callback });
    };

    register('disconnect', () => {
      void this.handleAdapterDisconnect(adapter, session).catch((error) => {
        this.logger.warn(`Failed to handle a disconnect event from ${adapter.name}:`, error);
      });
    });
    register('accountChanged', (data) =>
      this.handleAccountChanged(adapter, session, data as AccountInfo)
    );
    register('networkChanged', (data) => this.handleNetworkChanged(adapter, session, data));
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
    this.sessionGeneration += 1;
    this.disconnecting = false;
    this.networkEventRevision = 0;
    this.networkEventPersistence = Promise.resolve();
    this.networkMutationQueue = { tail: Promise.resolve() };
    this.currentAdapter = null;
    this.currentAccount = null;
    this.currentReconnectOptions = undefined;
    await this.enqueueStorageMutation(() => this.storage.clearState());
  }
}
