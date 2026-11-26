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
  SignedTransaction,
  SignedMessage,
  SubmittedTransaction,
  WalletEventMap,
  ConnectOptions,
  ConnectOptionsFor,
  NetworkConfig,
  NetworkInfo,
  PendingConnection,
  StoredState,
  WalletCapabilities,
  ReconnectOptions,
  WalletIdentifier,
} from './types';
import {
  adapterSupports,
  supportsFetchAccount,
  supportsReconnectOptions,
  supportsPendingConnection,
  getMissingAdapterConfiguration,
  isAdapterConfigured,
  isStandardNetworkId,
  STANDARD_NETWORKS,
  WalletErrorCode,
} from './types';
import { createWalletError, isWalletError, type WalletError } from './errors';
import { Logger, configureLogger, isLoggerInstance } from './logger';
import { Storage } from './storage';
import { TIME } from './constants';
import { withTimeout } from './async';

const AVAILABILITY_TIMED_OUT = Symbol('availability-timed-out');

type RestoreResult = AccountInfo | null | { error: unknown };

/**
 * Compare the network an adapter reports with the network a session requested.
 * Returns the `NETWORK_MISMATCH` error to raise, or `null` when the reported
 * network is acceptable. Without a requested network every network is
 * acceptable unless its standard identity contradicts its WalletConnect chain.
 */
function findNetworkMismatch(
  requestedNetwork: NetworkConfig | undefined,
  accountNetwork: NetworkInfo
): WalletError | null {
  const requestedNetworkId =
    typeof requestedNetwork === 'string' ? requestedNetwork : requestedNetwork?.id;
  const explicitRequestedWalletConnectId =
    typeof requestedNetwork === 'object' ? requestedNetwork.walletConnectId : undefined;
  const canonicalAccountWalletConnectId = isStandardNetworkId(accountNetwork.id)
    ? STANDARD_NETWORKS[accountNetwork.id].walletConnectId
    : undefined;
  const accountNetworkIsContradictory =
    canonicalAccountWalletConnectId !== undefined &&
    accountNetwork.walletConnectId !== undefined &&
    accountNetwork.walletConnectId !== canonicalAccountWalletConnectId;
  if (requestedNetworkId === undefined) {
    return accountNetworkIsContradictory
      ? createWalletError.networkMismatch(
          canonicalAccountWalletConnectId,
          accountNetwork.walletConnectId!
        )
      : null;
  }

  const canonicalRequestedWalletConnectId = isStandardNetworkId(requestedNetworkId)
    ? STANDARD_NETWORKS[requestedNetworkId].walletConnectId
    : undefined;
  const requestedWalletConnectId =
    canonicalRequestedWalletConnectId ?? explicitRequestedWalletConnectId;
  const accountWalletConnectId = canonicalAccountWalletConnectId ?? accountNetwork.walletConnectId;
  const requestedNetworkIsContradictory =
    canonicalRequestedWalletConnectId !== undefined &&
    explicitRequestedWalletConnectId !== undefined &&
    explicitRequestedWalletConnectId !== canonicalRequestedWalletConnectId;
  const idsMatch = accountNetwork.id === requestedNetworkId;
  const walletConnectIdsMatch =
    requestedWalletConnectId !== undefined && requestedWalletConnectId === accountWalletConnectId;

  if (
    !requestedNetworkIsContradictory &&
    !accountNetworkIsContradictory &&
    (idsMatch || walletConnectIdsMatch)
  ) {
    return null;
  }
  return createWalletError.networkMismatch(
    requestedNetworkIsContradictory
      ? canonicalRequestedWalletConnectId
      : accountNetworkIsContradictory
        ? (requestedWalletConnectId ?? requestedNetworkId)
        : requestedNetworkId,
    requestedNetworkIsContradictory
      ? explicitRequestedWalletConnectId!
      : accountNetworkIsContradictory
        ? accountNetwork.walletConnectId!
        : accountNetwork.id
  );
}

function cloneNetworkConfig(network: NetworkConfig | undefined): NetworkConfig | undefined {
  return typeof network === 'object' ? { ...network } : network;
}

/**
 * Summarize a signing failure for logs. The error object itself is never
 * logged: a wrapped error such as an xrpl.js `RippledError` keeps the raw
 * ledger response in its fields, which can echo the signed transaction.
 */
function describeFailure(error: WalletError): Record<string, string> {
  const summary: Record<string, string> = { code: error.code, message: error.message };
  const cause = error.originalError?.message;
  if (cause && !error.message.includes(cause)) summary.cause = cause;
  return summary;
}

/**
 * Main class for managing wallet connections
 */
export class WalletManager extends EventEmitter<WalletEventMap> {
  adapters: Map<string, WalletAdapter> = new Map();
  private currentAdapter: WalletAdapter | null = null;
  private currentAccount: AccountInfo | null = null;
  /**
   * Network the active session was requested on (manager default or per call).
   * Wallet-reported networks never replace it; while they differ, signing fails.
   */
  private sessionNetwork: NetworkConfig | undefined;
  private connectingAdapter: WalletAdapter | null = null;
  private storage: Storage;
  private logger: Logger;
  private options: WalletManagerOptions;
  private adapterListeners: Array<{
    event: WalletAdapterEvent;
    callback: (data: unknown) => void;
  }> = [];
  private sessionGeneration = 0;
  private connectionAttemptGeneration = 0;
  private reconnectGeneration = 0;
  private pendingRestore?: Promise<RestoreResult>;
  private pendingReconnects = 0;
  /** A reconnect left a stored session it could not restore in place for a later retry. */
  private retainedStoredSession = false;
  private stateRevision = 0;
  private storageTail: Promise<void> = Promise.resolve();
  private adapterTeardowns = new Map<WalletAdapter, Promise<void>>();
  private disconnectOperations = new Map<WalletAdapter, Promise<void>>();

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
   * Restore stored state or complete a returned wallet authorization
   */
  private async autoConnect(): Promise<void> {
    try {
      await this.reconnect();
    } catch (error) {
      this.logger.warn('Auto-connect failed:', error);
    }
  }

  /**
   * Check if stored state is still valid (not too old)
   */
  private isStateValid(state: StoredState): boolean {
    const age = Date.now() - state.timestamp;
    return Number.isFinite(state.timestamp) && age >= 0 && age < TIME.STATE_MAX_AGE;
  }

  /**
   * Connect to a wallet
   */
  async connect<const Wallet extends WalletIdentifier>(
    walletId: Wallet,
    options?: ConnectOptionsFor<Wallet>
  ): Promise<AccountInfo> {
    return this.connectInternal(walletId, options);
  }

  private async connectInternal(
    walletId: WalletIdentifier,
    options?: ConnectOptions,
    expectedState?: StoredState,
    completingAuthorization = false
  ): Promise<AccountInfo> {
    this.logger.info(`Connecting to wallet: ${walletId}`);

    // Get adapter
    const adapter = this.adapters.get(walletId);
    if (!adapter) {
      throw createWalletError.notFound(walletId);
    }

    // A connection attempt owns the manager until it either commits or rolls
    // back. This prevents two adapters from connecting concurrently and avoids
    // reconnecting an adapter that already backs the active session.
    const activeAdapter = this.currentAdapter ?? this.connectingAdapter;
    if (activeAdapter) {
      throw createWalletError.alreadyConnected(activeAdapter.name);
    }

    const missingConfiguration = getMissingAdapterConfiguration(adapter, options);
    if (missingConfiguration.length > 0) {
      throw createWalletError.configurationRequired(adapter.name, missingConfiguration);
    }

    this.connectingAdapter = adapter;
    const connectionAttempt = ++this.connectionAttemptGeneration;

    let adapterConnected = false;
    let connectionCommitted = false;
    let generation: number | undefined;

    try {
      const pendingTeardown = this.adapterTeardowns.get(adapter);
      if (pendingTeardown) {
        try {
          await pendingTeardown;
        } catch (error) {
          this.logger.warn(`Previous ${adapter.name} teardown failed; retrying connection:`, error);
        }
        if (
          connectionAttempt !== this.connectionAttemptGeneration ||
          this.connectingAdapter !== adapter
        ) {
          throw createWalletError.notConnected();
        }
      }

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
      if (
        connectionAttempt !== this.connectionAttemptGeneration ||
        this.connectingAdapter !== adapter
      ) {
        throw createWalletError.notConnected();
      }

      // Merge network options
      const connectOptions: ConnectOptions = {
        ...options,
        network: options?.network ?? this.options.network,
      };

      // A redirect-based login leaves the page before it can commit, and its
      // returned authorization completes on a later page load. Record the
      // network it was requested on so that completion requests the same one.
      if (!expectedState && !completingAuthorization && supportsPendingConnection(adapter)) {
        await this.recordPendingConnection(adapter.id, connectOptions.network);
        if (
          connectionAttempt !== this.connectionAttemptGeneration ||
          this.connectingAdapter !== adapter
        ) {
          throw createWalletError.notConnected();
        }
      }

      // Connect
      const account = await adapter.connect(connectOptions);
      adapterConnected = true;
      if (
        connectionAttempt !== this.connectionAttemptGeneration ||
        this.connectingAdapter !== adapter
      ) {
        throw createWalletError.notConnected();
      }

      const networkMismatch = findNetworkMismatch(connectOptions.network, account.network);
      if (networkMismatch) throw networkMismatch;

      if (expectedState && supportsReconnectOptions(adapter)) {
        if (account.address !== expectedState.account.address) {
          throw createWalletError.connectionFailed(
            adapter.name,
            new Error(
              `Reconnected account mismatch. Expected "${expectedState.account.address}" but wallet returned "${account.address}".`
            )
          );
        }
      }

      // Let adapters explicitly select the minimal JSON-safe reconnect state.
      // Never persist arbitrary caller-provided options.
      const reconnectOptions = supportsReconnectOptions(adapter)
        ? adapter.serializeReconnectOptions(connectOptions)
        : undefined;

      // Commit state before persistence so a concurrent disconnect can
      // invalidate this session and prevent a stale storage write.
      this.currentAdapter = adapter;
      this.currentAccount = this.cloneAccount(account);
      this.sessionNetwork = cloneNetworkConfig(connectOptions.network);
      generation = ++this.sessionGeneration;
      this.stateRevision += 1;

      await this.persistState(adapter, generation, this.currentAccount, reconnectOptions, true);
      this.retainedStoredSession = false;
      if (!this.isActiveSession(adapter, generation) || !this.currentAccount) {
        throw createWalletError.notConnected();
      }

      // Subscribe to adapter events if supported. Track every registration so
      // disconnect() can call the matching off() and stop late callbacks from
      // mutating manager state after the session is gone.
      this.subscribeToAdapter(adapter, generation);
      connectionCommitted = true;

      const connectedAccount = this.cloneAccount(this.currentAccount);
      this.logger.info(`Connected to ${adapter.name}`, this.cloneAccount(connectedAccount));
      this.emit('connect', this.cloneAccount(connectedAccount));

      return connectedAccount;
    } catch (error) {
      if (adapterConnected && !connectionCommitted) {
        let shouldDisconnectAdapter = true;
        if (generation !== undefined) {
          const cleaned = await this.cleanup(adapter, generation);
          if (!cleaned) {
            await this.storageTail;
            shouldDisconnectAdapter = false;
          }
        }
        const newerConnectionOwnsSameAdapter =
          connectionAttempt !== this.connectionAttemptGeneration &&
          (this.connectingAdapter === adapter || this.currentAdapter === adapter);
        if (shouldDisconnectAdapter && !newerConnectionOwnsSameAdapter) {
          try {
            await this.teardownAdapter(adapter);
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
      if (
        connectionAttempt === this.connectionAttemptGeneration &&
        this.connectingAdapter === adapter
      ) {
        this.connectingAdapter = null;
      }
    }
  }

  /**
   * Disconnect from current wallet
   */
  async disconnect(): Promise<void> {
    this.reconnectGeneration += 1;
    this.pendingRestore = undefined;
    let signalFailed = false;
    let signalError: unknown;
    try {
      this.emit('disconnecting');
    } catch (error) {
      signalFailed = true;
      signalError = error;
    }

    let disconnectFailed = false;
    let disconnectError: unknown;
    try {
      await this.disconnectCurrentState();
    } catch (error) {
      disconnectFailed = true;
      disconnectError = error;
    }

    if (disconnectFailed) throw disconnectError;
    if (signalFailed) throw signalError;
  }

  private async disconnectCurrentState(): Promise<void> {
    const adapter = this.currentAdapter;
    if (!adapter) {
      const connectingAdapter = this.connectingAdapter;
      if (connectingAdapter) {
        this.connectionAttemptGeneration += 1;
        this.connectingAdapter = null;
        const teardown = this.teardownAdapter(connectingAdapter);
        await this.queueStorage(() => this.storage.clearState());
        try {
          await teardown;
        } catch (error) {
          this.logger.warn(`Failed to cancel connection to ${connectingAdapter.name}:`, error);
        }
        if (this.disconnectOperations.size > 0) {
          await this.awaitDisconnectOperations();
        }
        return;
      }
      if (this.disconnectOperations.size > 0) {
        await this.awaitDisconnectOperations();
        return;
      }
      if (this.pendingReconnects > 0 || this.retainedStoredSession) {
        this.retainedStoredSession = false;
        await this.queueStorage(() => this.storage.clearState());
      }
      return;
    }

    this.startDisconnect(adapter, this.sessionGeneration);
    await this.awaitDisconnectOperations();
  }

  /** Start or join the teardown for the active adapter session. */
  private startDisconnect(adapter: WalletAdapter, generation: number): Promise<void> {
    const existing = this.disconnectOperations.get(adapter);
    if (existing) return existing;

    const operation = this.performDisconnect(adapter, generation);
    this.disconnectOperations.set(adapter, operation);
    void operation
      .finally(() => {
        if (this.disconnectOperations.get(adapter) === operation) {
          this.disconnectOperations.delete(adapter);
        }
      })
      .catch(() => undefined);
    return operation;
  }

  /** Join every provider teardown that was active when disconnect was requested. */
  private async awaitDisconnectOperations(): Promise<void> {
    const results = await Promise.allSettled([...this.disconnectOperations.values()]);
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    if (failure) throw failure.reason;
  }

  private async performDisconnect(adapter: WalletAdapter, generation: number): Promise<void> {
    const walletName = adapter.name;
    this.logger.info(`Disconnecting from ${walletName}`);

    const cleanup = this.cleanup(adapter, generation);
    const teardown = this.teardownAdapter(adapter);
    const cleaned = await cleanup;
    if (!cleaned) await this.storageTail;

    let eventFailed = false;
    let eventError: unknown;
    // Notify consumers when local state clears, even if provider logout is slow.
    // A newer session may have committed while storage cleanup was pending.
    if (cleaned && this.currentAdapter === null && this.sessionGeneration === generation + 1) {
      try {
        this.emit('disconnect');
      } catch (error) {
        eventFailed = true;
        eventError = error;
      }
    }

    let teardownFailed = false;
    let teardownError: unknown;
    try {
      await teardown;
      this.logger.info(`Disconnected from ${walletName}`);
    } catch (error) {
      this.logger.error(`Failed to disconnect from ${walletName}:`, error);
      teardownFailed = true;
      teardownError = error;
    }

    if (teardownFailed) throw teardownError;
    if (eventFailed) throw eventError;
  }

  /**
   * Restore a previous session or complete a returned wallet authorization.
   * Concurrent callers share the attempt. Set throwOnError to distinguish a
   * failed restore from the absence of a saved session.
   */
  async reconnect(options?: { throwOnError?: boolean }): Promise<AccountInfo | null> {
    let restore = this.pendingRestore;
    if (!restore) {
      if (this.currentAdapter && this.currentAccount) {
        return this.cloneAccount(this.currentAccount);
      }
      if (this.connectingAdapter) {
        throw createWalletError.alreadyConnected(this.connectingAdapter.name);
      }
      restore = this.restoreSession();
      this.pendingRestore = restore;
    }

    try {
      const result = await restore;
      if (result && 'error' in result) {
        if (options?.throwOnError) throw result.error;
        return null;
      }
      return result && this.cloneAccount(result);
    } finally {
      if (this.pendingRestore === restore) this.pendingRestore = undefined;
    }
  }

  private async restoreSession(): Promise<RestoreResult> {
    const reconnectGeneration = this.reconnectGeneration;
    this.pendingReconnects += 1;
    this.retainedStoredSession = false;
    let attemptedStateSnapshot: string | null = null;
    let restoringAdapter: WalletAdapter | undefined;
    let completingAuthorization = false;

    try {
      const stored = await this.storage.loadState();
      if (reconnectGeneration !== this.reconnectGeneration) return null;
      attemptedStateSnapshot = stored ? JSON.stringify(stored) : null;
      restoringAdapter = stored ? this.adapters.get(stored.walletId) : undefined;

      // A stored session stays authoritative over a returned authorization,
      // unless it was marked as awaiting that authorization.
      const awaited = stored?.pendingAuthorization;
      const candidates = !stored
        ? [...this.adapters.values()]
        : awaited !== undefined && this.adapters.has(awaited)
          ? [this.adapters.get(awaited)!]
          : [];
      for (const adapter of candidates) {
        let pending = false;
        try {
          pending =
            supportsPendingConnection(adapter) &&
            isAdapterConfigured(adapter) &&
            adapter.hasPendingConnection();
        } catch (error) {
          this.logger.warn(`Failed to check pending authorization for ${adapter.name}:`, error);
        }
        if (reconnectGeneration !== this.reconnectGeneration) return null;
        if (pending) {
          completingAuthorization = true;
          // Request the network the login was requested on, with the same
          // precedence as a restore.
          const requestedNetwork = await this.loadPendingConnectionNetwork(adapter.id);
          if (reconnectGeneration !== this.reconnectGeneration) return null;
          return await this.connectInternal(
            adapter.id,
            { network: this.options.network ?? requestedNetwork },
            undefined,
            true
          );
        }
      }
      if (!stored) return null;
      if (!this.isStateValid(stored)) {
        this.logger.debug('Stored state expired; clearing it');
        await this.clearStateIfSnapshotMatches(reconnectGeneration, attemptedStateSnapshot);
        return null;
      }

      // Replay the original connect options so wallet-specific selections
      // (e.g. the Ledger derivation path / account index) are restored instead
      // of reconnecting to the default account. The network is connection
      // policy: the manager's configured network wins, then the network the
      // session was requested on. The wallet's last-reported network (and its
      // endpoint) is never replayed from storage.
      return await this.connectInternal(
        stored.walletId,
        {
          ...stored.connectOptions,
          network: this.options.network ?? stored.requestedNetwork,
        },
        stored
      );
    } catch (error) {
      // disconnect() invalidates reconnect work before cancelling or replacing
      // its adapter. A stale failure must not clear a newer session's storage.
      if (reconnectGeneration !== this.reconnectGeneration) return null;
      // Recoverable caller-action errors must remain visible and must not erase
      // the persisted session. A later retry can succeed after the caller
      // supplies the missing adapter configuration or resolves the overlap.
      if (
        isWalletError(error) &&
        (error.code === WalletErrorCode.ALREADY_CONNECTED ||
          error.code === WalletErrorCode.CONFIGURATION_REQUIRED)
      ) {
        throw error;
      }
      // A failed authorization says nothing about the stored session it would
      // have replaced, so that session stays for a later retry.
      if (completingAuthorization) {
        this.logger.warn('Returned wallet authorization failed:', error);
        this.retainedStoredSession = attemptedStateSnapshot !== null;
        return { error };
      }
      // For adapters that restore without user interaction, a timeout says
      // nothing about whether the session is still valid. Keep it until it
      // expires so a later reconnect can retry, instead of making a slow
      // network cost the user a new wallet authorization.
      if (
        isWalletError(error) &&
        error.code === WalletErrorCode.OPERATION_TIMEOUT &&
        restoringAdapter?.keepsSessionOnRestoreTimeout === true
      ) {
        this.logger.warn('Reconnection timed out; keeping the stored session:', error);
        this.retainedStoredSession = true;
        return { error };
      }
      this.logger.warn('Reconnection failed:', error);
      await this.clearStateIfSnapshotMatches(reconnectGeneration, attemptedStateSnapshot);
      return { error };
    } finally {
      this.pendingReconnects -= 1;
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
    this.assertSessionNetwork();

    // Log only the transaction type and hash: transactions, signed blobs and
    // signatures must not reach application log pipelines.
    this.logger.debug('Signing transaction', { type: transaction.TransactionType });

    const adapter = this.currentAdapter;
    const signerAddress = this.currentAccount.address;
    try {
      const signed = this.bindSigner(await adapter.sign(transaction), signerAddress);
      this.logger.info('Transaction signed', {
        type: transaction.TransactionType,
        hash: signed.hash,
      });
      return signed;
    } catch (error) {
      const failure = isWalletError(error) ? error : createWalletError.signFailed(error as Error);
      this.logger.error('Failed to sign transaction:', describeFailure(failure));
      throw failure;
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
    this.assertSessionNetwork();

    this.logger.debug('Signing and submitting transaction', { type: transaction.TransactionType });

    try {
      const result = await this.currentAdapter.signAndSubmit(transaction);
      this.logger.info('Transaction submitted', {
        type: transaction.TransactionType,
        hash: result.hash,
      });
      return result;
    } catch (error) {
      const failure = isWalletError(error) ? error : createWalletError.signFailed(error as Error);
      this.logger.error('Failed to submit transaction:', describeFailure(failure));
      throw failure;
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
    this.assertSessionNetwork();

    this.logger.debug('Signing message');

    const adapter = this.currentAdapter;
    const signerAddress = this.currentAccount.address;
    try {
      const signed = this.bindSigner(await adapter.signMessage(message), signerAddress);
      this.logger.info('Message signed');
      return signed;
    } catch (error) {
      const failure = isWalletError(error) ? error : createWalletError.signFailed(error as Error);
      this.logger.error('Failed to sign message:', describeFailure(failure));
      throw failure;
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
        if (getMissingAdapterConfiguration(adapter).length > 0) {
          return false;
        }
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
   * Query the connected adapter and refresh cached account information, emitting
   * account/network change events for differences. Freshness is adapter-specific:
   * Xaman queries its OAuth subject and retains the session network context.
   * Success does not universally verify the wallet's current network selection.
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
      return this.currentAccount ? this.cloneAccount(this.currentAccount) : null;
    }

    if (!fetched) {
      const cleaned = await this.cleanup(adapter, generation);
      if (cleaned && this.currentAdapter === null && this.sessionGeneration === generation + 1) {
        this.emit('disconnect');
      }
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
      return this.currentAccount ? this.cloneAccount(this.currentAccount) : null;
    }

    if (addressChanged) this.emit('accountChanged', this.cloneAccount(account));
    if (networkChanged) {
      this.emit('networkChanged', { ...account.network });
      this.reportNetworkMismatch(adapter, generation, account.network);
    }
    return this.cloneAccount(account);
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
    return this.currentAccount ? this.cloneAccount(this.currentAccount) : null;
  }

  /**
   * Get current wallet adapter
   */
  get wallet(): WalletAdapter | null {
    return this.currentAdapter;
  }

  /** The adapter whose connection attempt currently owns the manager, if any. */
  get connectingWallet(): WalletAdapter | null {
    return this.connectingAdapter;
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
   * The `NETWORK_MISMATCH` error signing currently rejects with, because the
   * connected wallet reports a network other than the one the session was
   * requested on. `null` when signing is not blocked by the network, including
   * when no wallet is connected. Recomputed from the latest wallet-reported
   * network on each access.
   */
  get networkMismatch(): WalletError | null {
    return this.currentAccount
      ? findNetworkMismatch(this.sessionNetwork, this.currentAccount.network)
      : null;
  }

  /**
   * Bind a signature to the account that started the request. A signer the
   * wallet reports must be that account; when the wallet reports none, the
   * account asserted by the wallet session is stamped (not verified).
   */
  private bindSigner<Result extends SignedTransaction | SignedMessage>(
    result: Result,
    signerAddress: string
  ): Result & { signerAddress: string } {
    if (result.signerAddress !== undefined && result.signerAddress !== signerAddress) {
      throw createWalletError.signerMismatch(signerAddress, result.signerAddress);
    }
    return { ...result, signerAddress };
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
   * Throw `NETWORK_MISMATCH` while the wallet reports a network other than the
   * one the session was requested on, applying the same comparison as connect.
   */
  private assertSessionNetwork(): void {
    const mismatch = this.networkMismatch;
    if (mismatch) throw mismatch;
  }

  /**
   * Emit an `error` event when a wallet-reported network change leaves the
   * session on a network it was not requested on. The session stays connected
   * so the user can switch back; signing fails until then.
   */
  private reportNetworkMismatch(
    adapter: WalletAdapter,
    generation: number,
    network: NetworkInfo
  ): void {
    if (!this.isActiveSession(adapter, generation)) return;
    const mismatch = findNetworkMismatch(this.sessionNetwork, network);
    if (!mismatch) return;
    this.logger.warn('Wallet network does not match the requested network; signing is blocked');
    this.emit('error', mismatch);
  }

  /**
   * Handle adapter disconnect event
   */
  private handleAdapterDisconnect(adapter: WalletAdapter, generation: number): void {
    if (!this.isActiveSession(adapter, generation)) return;

    this.logger.info('Wallet disconnected (adapter event)');
    void this.cleanup(adapter, generation)
      .then((cleaned) => {
        if (cleaned && this.currentAdapter === null && this.sessionGeneration === generation + 1) {
          this.emit('disconnect');
        }
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
    const previousNetwork = this.currentAccount?.network;
    const nextAccount = this.cloneAccount(account);
    this.currentAccount = nextAccount;
    this.stateRevision += 1;
    void this.persistState(adapter, generation, nextAccount);
    this.emit('accountChanged', this.cloneAccount(nextAccount));
    if (!previousNetwork || !this.networksEqual(previousNetwork, nextAccount.network)) {
      this.reportNetworkMismatch(adapter, generation, nextAccount.network);
    }
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
    const previousNetwork = this.currentAccount.network;
    const nextAccount = this.cloneAccount({ ...this.currentAccount, network });
    this.currentAccount = nextAccount;
    this.stateRevision += 1;
    void this.persistState(adapter, generation, nextAccount);
    this.emit('networkChanged', { ...nextAccount.network });
    // A wallet may report one switch through accountChanged and then
    // networkChanged (WalletConnect does); its mismatch is reported once.
    if (!this.networksEqual(previousNetwork, nextAccount.network)) {
      this.reportNetworkMismatch(adapter, generation, nextAccount.network);
    }
  }

  /** Serialize storage mutations so cleanup is always the final old-session write. */
  private queueStorage(operation: () => Promise<void>): Promise<void> {
    const result = this.storageTail.then(operation, operation);
    this.storageTail = result.catch((error) => {
      this.logger.warn('Failed to persist wallet state:', error);
    });
    return result;
  }

  /**
   * Record a login on `walletId` whose authorization may return to a later page
   * load. When a failed restore left a session behind, the returning login has
   * to replace it, so that session is marked as awaiting it. Marking instead of
   * clearing keeps the session for a later retry if the login is cancelled or fails.
   */
  private recordPendingConnection(
    walletId: WalletIdentifier,
    requestedNetwork: NetworkConfig | undefined
  ): Promise<void> {
    const connection: PendingConnection = { walletId, timestamp: Date.now() };
    if (requestedNetwork !== undefined) {
      connection.requestedNetwork = cloneNetworkConfig(requestedNetwork);
    }
    const replacesRetainedSession = this.retainedStoredSession;
    return this.queueStorage(async () => {
      await this.storage.savePendingConnection(connection);
      if (!replacesRetainedSession) return;
      const stored = await this.storage.loadState();
      if (!stored || stored.pendingAuthorization === walletId) return;
      await this.storage.saveState({ ...stored, pendingAuthorization: walletId });
    });
  }

  /**
   * The network a login on `walletId` was requested on, while its record is
   * recent enough to belong to the authorization returning now.
   */
  private async loadPendingConnectionNetwork(
    walletId: WalletIdentifier
  ): Promise<NetworkConfig | undefined> {
    const connection = await this.storage.loadPendingConnection();
    if (!connection || connection.walletId !== walletId) return undefined;
    const age = Date.now() - connection.timestamp;
    if (!Number.isFinite(age) || age < 0 || age >= TIME.PENDING_CONNECTION_MAX_AGE) {
      return undefined;
    }
    return connection.requestedNetwork;
  }

  /** Clear only the state this reconnect attempt actually loaded. */
  private clearStateIfSnapshotMatches(
    reconnectGeneration: number,
    attemptedStateSnapshot: string | null
  ): Promise<void> {
    if (!attemptedStateSnapshot) return Promise.resolve();

    return this.queueStorage(async () => {
      if (
        reconnectGeneration !== this.reconnectGeneration ||
        this.currentAdapter !== null ||
        this.connectingAdapter !== null
      ) {
        return;
      }

      const currentState = await this.storage.loadState();
      if (
        reconnectGeneration === this.reconnectGeneration &&
        this.currentAdapter === null &&
        this.connectingAdapter === null &&
        currentState &&
        JSON.stringify(currentState) === attemptedStateSnapshot
      ) {
        await this.storage.clearState();
      }
    });
  }

  /** Deduplicate provider teardown and block reuse of the same adapter until it settles. */
  private teardownAdapter(adapter: WalletAdapter): Promise<void> {
    const existing = this.adapterTeardowns.get(adapter);
    if (existing) return existing;

    const teardown = Promise.resolve().then(() => adapter.disconnect());
    this.adapterTeardowns.set(adapter, teardown);
    void teardown
      .finally(() => {
        if (this.adapterTeardowns.get(adapter) === teardown) {
          this.adapterTeardowns.delete(adapter);
        }
      })
      .catch(() => undefined);
    return teardown;
  }

  /**
   * Persist an immutable session snapshot without restoring stale state. A new
   * session also replaces the stored reconnect options and ends the pending
   * connection, which it either completed or replaced.
   */
  private persistState(
    adapter: WalletAdapter,
    generation: number,
    account: AccountInfo,
    reconnectOptions?: ReconnectOptions,
    newSession = false
  ): Promise<void> {
    const snapshot = this.cloneAccount(account);
    const requestedNetwork = cloneNetworkConfig(this.sessionNetwork);
    return this.queueStorage(async () => {
      if (!this.isActiveSession(adapter, generation)) return;
      const existing = await this.storage.loadState();
      if (!this.isActiveSession(adapter, generation)) return;
      const state: StoredState = {
        ...(existing ?? {}),
        walletId: adapter.id,
        account: snapshot,
        network: snapshot.network,
        timestamp: Date.now(),
      };
      delete state.pendingAuthorization;
      if (requestedNetwork === undefined) delete state.requestedNetwork;
      else state.requestedNetwork = requestedNetwork;
      if (newSession) {
        if (reconnectOptions) state.connectOptions = reconnectOptions;
        else delete state.connectOptions;
      }
      await this.storage.saveState(state);
      if (newSession) await this.storage.clearPendingConnection();
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
    this.sessionNetwork = undefined;
    this.sessionGeneration += 1;
    this.stateRevision += 1;
    await this.queueStorage(() => this.storage.clearState());
    return true;
  }
}
