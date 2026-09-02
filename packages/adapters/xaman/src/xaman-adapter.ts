/**
 * Xaman (formerly Xumm) Wallet Adapter
 */

import { Xumm } from 'xumm';
import {
  decode,
  encodeForMultiSigning,
  hashes,
  verifyKeypairSignature,
  verifySignature,
} from 'xrpl';
import {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  Transaction,
  SignedTransaction,
  SignedMessage,
  SubmittedTransaction,
  SupportsDeepLink,
  SupportsFetchAccount,
  WalletCapabilities,
  WalletConnectionOptionsById,
} from '@xrpl-connect/core';
import {
  createWalletError,
  createLogger,
  isWalletError,
  resolveNetwork,
  WalletErrorCode,
} from '@xrpl-connect/core';
import iconSvg from './assets/icon.svg';

const ICON_DATA_URL = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;
const SIGNING_TIMEOUT_MS = 5 * 60 * 1000;
const RESOLVED_PAYLOAD_RETRY_MAX_MS = 5_000;
const RESOLVED_PAYLOAD_RETRY_TIMEOUT_MS = 30_000;
const SIGNING_OUTPUT_FIELDS = new Set(['TxnSignature']);

const XAMAN_NETWORKS_BY_ID = new Map<number, XamanNetwork>([
  [0, { forceNetwork: 'MAINNET', networkId: 0, id: 'mainnet', name: 'Mainnet' }],
  [1, { forceNetwork: 'TESTNET', networkId: 1, id: 'testnet', name: 'Testnet' }],
  [2, { forceNetwork: 'DEVNET', networkId: 2, id: 'devnet', name: 'Devnet' }],
  [21337, { forceNetwork: 'XAHAU', networkId: 21337, id: 'xahau', name: 'Xahau' }],
  [
    21338,
    {
      forceNetwork: 'XAHAUTESTNET',
      networkId: 21338,
      id: 'xahau-testnet',
      name: 'Xahau Testnet',
    },
  ],
  [
    31338,
    {
      forceNetwork: 'JSHOOKS',
      networkId: 31338,
      id: 'jshooks-testnet',
      name: 'JS Hooks Testnet',
    },
  ],
]);

const XAMAN_NETWORK_ALIASES = new Map<string, number>([
  ['mainnet', 0],
  ['production', 0],
  ['livenet', 0],
  ['xrplmainnet', 0],
  ['testnet', 1],
  ['xrpltestnet', 1],
  ['devnet', 2],
  ['xrpldevnet', 2],
  ['xahau', 21337],
  ['xahaumainnet', 21337],
  ['xahautestnet', 21338],
  ['jshooks', 31338],
  ['jshookstestnet', 31338],
]);

type XamanPayloadOutcome = 'signed' | 'rejected' | 'expired';

interface XamanNetwork {
  forceNetwork: string;
  networkId: number;
  id: string;
  name: string;
}

interface ActivePayloadOperation {
  client: Xumm;
  controller: AbortController;
  phase: 'creating' | 'waiting' | 'fetching' | 'done';
  opened: boolean;
  submit: boolean;
  stopRequested: boolean;
  outcomeForced: boolean;
  uuid?: string;
  close?: () => void;
  ready: Promise<void>;
  resolveReady: () => void;
  stopDecision: Promise<void>;
  resolveStopDecision: () => void;
  forcedOutcome: Promise<XamanPayloadOutcome>;
  forceOutcome: (outcome: XamanPayloadOutcome) => void;
  done: Promise<void>;
  resolveDone: () => void;
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

/**
 * Logger instance for Xaman adapter
 */
const logger = createLogger('[Xaman]');

/**
 * Xaman adapter options
 */
export interface XamanReturnUrl {
  /** URL or registered deep link opened by the Xaman app after signing */
  app?: string;
  /** URL opened by Xaman's browser flow after signing */
  web?: string;
}

export interface XamanAdapterOptions {
  apiKey?: string; // Xumm API key (can also be provided in connect options)
  onQRCode?: (uri: string) => void; // Callback for QR code URI
  onDeepLink?: (uri: string) => string; // Transform URI for deep linking
  /** Optional navigation destinations offered after a signing request is resolved */
  returnUrl?: XamanReturnUrl;
}

export type XamanConnectOptions = WalletConnectionOptionsById['xaman'];

/**
 * Xaman wallet adapter implementation
 */
export class XamanAdapter implements WalletAdapter, SupportsDeepLink, SupportsFetchAccount {
  readonly id = 'xaman';
  readonly name = 'Xaman';
  readonly icon = ICON_DATA_URL;
  readonly url = 'https://xaman.app';
  // Xaman has no native arbitrary-message signing; signMessage() is a stub that
  // returns an empty signature, so advertise it as unsupported.
  readonly capabilities: WalletCapabilities = { signMessage: false };

  private client: Xumm | null = null;
  private clientApiKey: string | null = null;
  private sdkApiKey: string | null = null;
  private currentAccount: AccountInfo | null = null;
  private options: XamanAdapterOptions;
  private activePayloadOperations = new Set<ActivePayloadOperation>();
  private connectionGeneration = 0;
  private supersededRestorationGeneration: number | null = null;
  private accountRefreshRevision = 0;
  private connecting = false;
  private restoringState = false;
  private disconnecting = false;
  private connectionAttemptDone: Promise<void> | null = null;
  private disconnectPromise: Promise<void> | null = null;
  // Per-connection option overrides. Populated by connect() and cleared by
  // cleanup(); avoids mutating constructor-supplied options across calls.
  private activeCallbacks: {
    onQRCode?: (uri: string) => void;
    onDeepLink?: (uri: string) => string;
    returnUrl?: XamanReturnUrl;
  } = {};

  constructor(options: XamanAdapterOptions = {}) {
    this.options = options;
  }

  getMissingConfiguration(options?: ConnectOptions<XamanConnectOptions>): readonly string[] {
    return options?.apiKey || this.options.apiKey ? [] : ['apiKey'];
  }

  /**
   * Xaman is always available (uses OAuth flow, no extension needed)
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async checkXamanState(
    options?: ConnectOptions<XamanConnectOptions>
  ): Promise<AccountInfo | null> {
    const apiKey = options?.apiKey || this.options.apiKey;

    if (!apiKey) {
      throw createWalletError.configurationRequired(this.name, ['apiKey']);
    }

    if (this.sdkApiKey && this.sdkApiKey !== apiKey) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error(
          'Cannot change the Xaman API key after the browser SDK has initialized. Reload the page before using a different API key.'
        )
      );
    }

    if (this.connecting || this.disconnecting || this.activePayloadOperations.size > 0) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error('Wait for the active Xaman operation to finish before restoring state.')
      );
    }
    const requestedNetwork =
      options?.network === undefined ? undefined : this.resolveRequestedNetwork(options.network);
    const requestedXamanNetwork = requestedNetwork
      ? this.resolveXamanNetwork(requestedNetwork)
      : undefined;

    if (this.currentAccount && this.clientApiKey === apiKey) {
      if (requestedXamanNetwork) {
        const currentXamanNetwork = this.resolveXamanNetwork(this.currentAccount.network);
        if (currentXamanNetwork.networkId !== requestedXamanNetwork.networkId) {
          throw createWalletError.networkMismatch(
            requestedXamanNetwork.forceNetwork,
            currentXamanNetwork.forceNetwork
          );
        }
      }
      return this.currentAccount;
    }
    if (this.client) await this.disconnect();

    const generation = ++this.connectionGeneration;
    this.connecting = true;
    this.restoringState = true;
    const attemptDone = deferred<void>();
    this.connectionAttemptDone = attemptDone.promise;
    let client: Xumm | null = null;

    try {
      this.sdkApiKey = apiKey;
      client = new Xumm(apiKey);
      this.client = client;
      this.clientApiKey = apiKey;
      const address = await client.user.account;
      if (generation !== this.connectionGeneration || this.client !== client) {
        if (this.supersededRestorationGeneration === generation) return null;
        throw new Error('Xaman state restoration was superseded or disconnected');
      }
      if (!address) {
        await client.logout();
        if (generation === this.connectionGeneration) this.cleanup();
        return null;
      }

      const resolvedNetwork = await this.getAuthoritativeNetwork(client);
      const resolvedXamanNetwork = this.resolveXamanNetwork(resolvedNetwork);
      if (requestedXamanNetwork) {
        this.validateXamanNetwork(
          requestedXamanNetwork,
          resolvedXamanNetwork.networkId,
          resolvedXamanNetwork.forceNetwork
        );
      }

      if (generation !== this.connectionGeneration || this.client !== client) {
        if (this.supersededRestorationGeneration === generation) return null;
        throw new Error('Xaman state restoration was superseded or disconnected');
      }

      this.currentAccount = {
        address,
        publicKey: undefined, // Xaman doesn't expose public key
        network: resolvedNetwork,
      };

      return this.currentAccount;
    } catch (error) {
      if (this.supersededRestorationGeneration === generation) return null;
      if (client && generation === this.connectionGeneration && this.client === client) {
        try {
          await client.logout();
        } catch (logoutError) {
          logger.debug('Unable to clean up failed Xaman state restoration', logoutError);
        }
      }
      if (generation === this.connectionGeneration) this.cleanup();
      if (isWalletError(error)) throw error;
      throw createWalletError.connectionFailed(this.name, error as Error);
    } finally {
      if (this.supersededRestorationGeneration === generation) {
        this.supersededRestorationGeneration = null;
      }
      if (this.connectionAttemptDone === attemptDone.promise) {
        this.connecting = false;
        this.restoringState = false;
        this.connectionAttemptDone = null;
      }
      attemptDone.resolve(undefined);
    }
  }

  /**
   * Connect to Xaman wallet
   */
  async connect(options?: ConnectOptions<XamanConnectOptions>): Promise<AccountInfo> {
    const apiKey = options?.apiKey || this.options.apiKey;

    logger.info('Connection phase: requested', {
      hasApiKey: Boolean(apiKey),
      restoringState: this.restoringState,
      connecting: this.connecting,
      disconnecting: this.disconnecting,
      activePayloadOperations: this.activePayloadOperations.size,
      hasClient: Boolean(this.client),
      hasAccount: Boolean(this.currentAccount),
      browserUserActivation:
        typeof navigator !== 'undefined' && 'userActivation' in navigator
          ? navigator.userActivation.isActive
          : undefined,
    });

    if (!apiKey) {
      throw createWalletError.configurationRequired(this.name, ['apiKey']);
    }

    if (this.sdkApiKey && this.sdkApiKey !== apiKey) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error(
          'Cannot change the Xaman API key after the browser SDK has initialized. Reload the page before using a different API key.'
        )
      );
    }

    if (this.restoringState && this.connectionAttemptDone) {
      const restorationGeneration = this.connectionGeneration;
      logger.info('Connection phase: superseding silent session restoration');
      this.supersededRestorationGeneration = restorationGeneration;
      this.connectionGeneration += 1;
      this.client = null;
      this.clientApiKey = null;
      this.connecting = false;
      this.restoringState = false;
      this.connectionAttemptDone = null;
    }

    if (this.connecting || this.disconnecting || this.activePayloadOperations.size > 0) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error('Wait for the active Xaman signing request to finish before reconnecting.')
      );
    }

    const requestedNetwork =
      options?.network === undefined ? undefined : this.resolveRequestedNetwork(options.network);
    const requestedXamanNetwork = requestedNetwork
      ? this.resolveXamanNetwork(requestedNetwork)
      : undefined;
    if (this.currentAccount && this.client && this.clientApiKey === apiKey) {
      const currentXamanNetwork = this.resolveXamanNetwork(this.currentAccount.network);
      if (
        !requestedXamanNetwork ||
        currentXamanNetwork.networkId === requestedXamanNetwork.networkId
      ) {
        this.activeCallbacks = {
          onQRCode: options?.onQRCode,
          onDeepLink: options?.onDeepLink,
          returnUrl: options?.returnUrl,
        };
        return this.currentAccount;
      }
    }

    if (this.client) await this.disconnect();

    const generation = ++this.connectionGeneration;
    this.connecting = true;
    const attemptDone = deferred<void>();
    this.connectionAttemptDone = attemptDone.promise;

    // Reset any leftover state from a previous connection attempt so a fast
    // disconnect → connect cycle doesn't carry stale client/callbacks forward.
    this.cleanup();

    // Stash per-connection callback overrides without mutating constructor
    // options — those must remain valid for any future connect() call.
    this.activeCallbacks = {
      onQRCode: options?.onQRCode,
      onDeepLink: options?.onDeepLink,
      returnUrl: options?.returnUrl,
    };

    let client: Xumm | null = null;
    try {
      this.sdkApiKey = apiKey;
      client = new Xumm(apiKey);
      this.client = client;
      this.clientApiKey = apiKey;
      logger.info('Connection phase: Xaman SDK initialized', {
        browserUserActivation:
          typeof navigator !== 'undefined' && 'userActivation' in navigator
            ? navigator.userActivation.isActive
            : undefined,
        documentHasFocus:
          typeof document !== 'undefined' && typeof document.hasFocus === 'function'
            ? document.hasFocus()
            : undefined,
      });
      logger.info('Connection phase: calling SDK authorize (popup should open now)');

      const authResult = await client.authorize();
      logger.info('Connection phase: SDK authorize settled', {
        hasResult: !!authResult,
        isError: authResult instanceof Error,
        hasMe: authResult && !(authResult instanceof Error) ? !!authResult.me : false,
      });

      if (!authResult || authResult instanceof Error) {
        throw authResult || new Error('Authorization failed');
      }
      if (generation !== this.connectionGeneration || this.client !== client) {
        throw new Error('Xaman connection attempt was superseded or disconnected');
      }

      logger.info('Connection phase: authorization successful');

      const account = authResult.me.account;
      const network = await this.getAuthoritativeNetwork(client, authResult.me);
      if (generation !== this.connectionGeneration || this.client !== client) {
        throw new Error('Xaman connection attempt was superseded or disconnected');
      }
      const xamanNetwork = this.resolveXamanNetwork(network);
      if (requestedXamanNetwork) {
        this.validateXamanNetwork(
          requestedXamanNetwork,
          xamanNetwork.networkId,
          xamanNetwork.forceNetwork
        );
      }

      this.currentAccount = {
        address: account,
        publicKey: undefined, // Xaman doesn't expose public key in authorize response
        network,
      };

      return this.currentAccount;
    } catch (error) {
      logger.error('Connection phase: authorization failed', error);
      if (client) {
        try {
          await client.logout();
        } catch (logoutError) {
          logger.debug('Unable to clean up failed Xaman authorization', logoutError);
        }
      }
      // Drop the half-initialized client + per-connection callbacks so the
      // next connect() starts from a clean slate.
      if (generation === this.connectionGeneration) this.cleanup();
      if (isWalletError(error)) throw error;
      throw createWalletError.connectionFailed(this.name, error as Error);
    } finally {
      logger.info('Connection phase: authorization attempt finished', {
        connected: Boolean(this.currentAccount),
      });
      this.connecting = false;
      if (this.connectionAttemptDone === attemptDone.promise) this.connectionAttemptDone = null;
      attemptDone.resolve(undefined);
    }
  }

  /**
   * Disconnect from Xaman
   */
  async disconnect(): Promise<void> {
    if (this.disconnectPromise) return await this.disconnectPromise;
    if (!this.client) {
      return;
    }

    const client = this.client;
    const connectionAttemptDone = this.connectionAttemptDone;
    const operations = [...this.activePayloadOperations].filter(
      (operation) => operation.client === client
    );
    const disconnectPromise = (async () => {
      this.disconnecting = true;
      this.connectionGeneration++;
      this.cleanup();

      try {
        await Promise.all(
          operations.map(async (operation) => {
            try {
              await this.quiescePayloadOperation(operation);
            } catch (error) {
              logger.debug('Unable to quiesce Xaman payload operation cleanly', error);
            }
          })
        );

        try {
          await client.logout();
        } catch (error) {
          // Logout might fail if already logged out, that's okay
        }
        if (connectionAttemptDone) await connectionAttemptDone;
      } finally {
        this.disconnecting = false;
      }
    })();
    this.disconnectPromise = disconnectPromise;

    try {
      await disconnectPromise;
    } finally {
      if (this.disconnectPromise === disconnectPromise) this.disconnectPromise = null;
    }
  }

  /**
   * Get current account
   */
  async getAccount(): Promise<AccountInfo | null> {
    return this.currentAccount;
  }

  /**
   * Refresh the authenticated account and network from Xaman's live ping endpoint.
   */
  async fetchAccount(): Promise<AccountInfo | null> {
    const client = this.client;
    const generation = this.connectionGeneration;
    if (!client || !this.currentAccount) return null;
    const refreshRevision = ++this.accountRefreshRevision;

    try {
      const pong = await client.ping();
      if (this.client !== client || generation !== this.connectionGeneration) {
        throw createWalletError.notConnected();
      }
      if (refreshRevision !== this.accountRefreshRevision) return this.currentAccount;
      if (!this.currentAccount) return null;

      const jwtData = pong?.jwtData as
        | {
            sub?: unknown;
            network_endpoint?: unknown;
            network_id?: unknown;
          }
        | undefined;
      const address = typeof jwtData?.sub === 'string' ? jwtData.sub : '';
      if (!address) {
        this.currentAccount = null;
        return null;
      }

      const endpoint = jwtData?.network_endpoint;
      const networkId = jwtData?.network_id;
      let network = this.currentAccount.network;
      if (typeof endpoint === 'string' && typeof networkId === 'number') {
        network = this.parseNetwork(endpoint, networkId);
      } else if (endpoint !== undefined || networkId !== undefined) {
        throw new Error('Xaman ping returned incomplete network information');
      }

      this.currentAccount = {
        address,
        publicKey: undefined,
        network,
      };
      return this.currentAccount;
    } catch (error) {
      if (isWalletError(error)) throw error;
      throw createWalletError.connectionFailed(this.name, error as Error);
    }
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

  /**
   * Create a Xaman payload, open the signing popup, wait for Xaman's SDK subscription,
   * then fetch and validate the authoritative resolved payload.
   *
   * `submit` is passed through as `options.submit` on the payload body — Xaman's
   * payload API only submits to the ledger when this is true. Previously the bare
   * transaction was sent with no `options`, so `sign()` could submit despite being
   * the sign-only operation.
   *
   * Subscription events only contain status metadata, never the signed blob. The
   * actual signed data and dispatch result come from `payload.get()`.
   */
  private async createAndWaitForPayload(
    transaction: Transaction,
    submit: boolean
  ): Promise<{
    txid: string;
    tx_blob: string;
    signature?: string;
    tx_json: Transaction;
  }> {
    if (!this.client || !this.currentAccount) {
      throw createWalletError.notConnected();
    }

    const client = this.client;
    const network = this.currentAccount.network;
    const expectedAccount = this.currentAccount.address;
    const xamanNetwork = this.resolveXamanNetwork(network);
    const multisign = transaction.SigningPubKey === '';
    const operation = this.createPayloadOperation(client, submit);
    let handleAbort: (() => void) | undefined;
    this.activePayloadOperations.add(operation);

    // Per-connection return URL (from connect options) wins over the constructor value.
    const returnUrl = this.activeCallbacks.returnUrl || this.options.returnUrl;

    // oxlint-disable-next-line typescript/no-explicit-any
    const payloadBody: any = {
      txjson: transaction,
      options: {
        submit,
        force_network: xamanNetwork.forceNetwork,
        signers: [expectedAccount],
        ...(multisign ? { multisign: true } : {}),
        ...(returnUrl ? { return_url: returnUrl } : {}),
      },
    };

    try {
      const creation = client.payload?.createAndSubscribe(payloadBody, ({ data, payload }) => {
        if (data.opened === true || data.pre_signed === true || payload.meta.app_opened === true) {
          operation.opened = true;
        }
        if (data.signed === true) return 'signed' satisfies XamanPayloadOutcome;
        if (data.signed === false) return 'rejected' satisfies XamanPayloadOutcome;
        if (data.cancelled === true) return 'expired' satisfies XamanPayloadOutcome;
        if (data.expired === true && !operation.opened) {
          return 'expired' satisfies XamanPayloadOutcome;
        }
        return undefined;
      });

      if (!creation) {
        throw new Error('Failed to create payload');
      }

      const payload = await this.waitForOperation(creation, operation.controller.signal);

      if (!payload.resolved) {
        payload.resolve();
        throw new Error('Failed to create payload');
      }

      let subscriptionClosed = false;
      const closeSubscription = () => {
        if (subscriptionClosed) return;
        subscriptionClosed = true;
        payload.resolve();
      };
      operation.uuid = payload.created.uuid;
      operation.close = closeSubscription;
      operation.phase = 'waiting';
      operation.resolveReady();

      handleAbort = closeSubscription;
      operation.controller.signal.addEventListener('abort', handleAbort, { once: true });
      if (operation.stopRequested) await operation.stopDecision;
      if (operation.controller.signal.aborted) {
        handleAbort();
        throw new Error('Xaman signing operation was cancelled');
      }

      let outcome: unknown;
      try {
        if (!operation.outcomeForced && !operation.opened && !operation.stopRequested) {
          this.openSignWindow(payload.created.next.always);
        }
        outcome = await this.waitForPayloadOutcome(
          Promise.race([payload.resolved, operation.forcedOutcome]),
          () => operation.opened,
          operation.controller.signal
        );
      } finally {
        closeSubscription();
      }
      if (outcome === 'rejected') {
        throw createWalletError.signRejected();
      }
      if (outcome !== 'signed') {
        throw new Error(
          outcome === 'expired'
            ? 'Xaman signing request expired'
            : 'Unexpected Xaman payload result'
        );
      }

      operation.phase = 'fetching';
      const resolved = await this.getResolvedPayload(
        client,
        payload.created.uuid,
        submit,
        operation.controller.signal
      );
      if (!resolved?.meta.resolved || !resolved.meta.signed) {
        throw new Error('Xaman returned an unresolved or unsigned payload');
      }

      if (resolved.meta.submit !== submit) {
        throw new Error('Xaman payload submission mode did not match the requested operation');
      }
      if (resolved.meta.multisign !== multisign) {
        throw new Error('Xaman payload signing mode did not match the requested transaction');
      }
      if (
        !Array.isArray(resolved.meta.signers) ||
        resolved.meta.signers.length !== 1 ||
        resolved.meta.signers[0] !== expectedAccount
      ) {
        throw new Error('Xaman payload signer did not match the connected account');
      }

      this.validateRequestedTransaction(transaction, resolved.payload?.request_json);

      const { response } = resolved;
      if (typeof response.hex !== 'string' || response.hex.length === 0) {
        throw new Error('Xaman did not return a signed transaction blob');
      }
      if (typeof response.txid !== 'string' || response.txid.length === 0) {
        throw new Error('Xaman did not return a signed transaction hash');
      }

      this.validateXamanNetwork(
        xamanNetwork,
        response.environment_networkid,
        response.environment_nodetype,
        submit ? response.dispatched_nodetype : undefined
      );

      if (submit) {
        const dispatchResult = response.dispatched_result;
        const acceptedByNode =
          dispatchResult === 'tesSUCCESS' ||
          dispatchResult === 'terQUEUED' ||
          dispatchResult?.startsWith('tec') === true;
        if (response.dispatched_to_node !== true || !acceptedByNode) {
          throw new Error(
            `Xaman failed to submit the transaction: ${dispatchResult || 'not dispatched'}`
          );
        }
      } else if (response.dispatched_to_node === true) {
        throw new Error('Xaman unexpectedly submitted a sign-only transaction');
      }

      let tx_json: Transaction;
      let txid: string;
      try {
        tx_json = decode(response.hex) as Transaction;
        txid = hashes.hashSignedTx(response.hex);
        this.validateSignedTransaction(
          tx_json,
          response.hex,
          expectedAccount,
          multisign,
          response.account,
          response.multisign_account,
          xamanNetwork
        );
        this.validateRequestedTransaction(transaction, tx_json);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Xaman returned an invalid signed transaction blob: ${message}`);
      }

      if (txid.toUpperCase() !== response.txid.toUpperCase()) {
        throw new Error('Xaman returned a transaction hash that does not match the signed blob');
      }

      const signature = typeof tx_json.TxnSignature === 'string' ? tx_json.TxnSignature : undefined;

      return {
        txid,
        tx_blob: response.hex,
        signature,
        tx_json,
      };
    } finally {
      if (handleAbort) operation.controller.signal.removeEventListener('abort', handleAbort);
      operation.phase = 'done';
      operation.resolveReady();
      operation.resolveStopDecision();
      operation.resolveDone();
      this.activePayloadOperations.delete(operation);
    }
  }

  /**
   * Sign a transaction without submitting it to the ledger.
   * Note: Xaman uses a popup flow for signing.
   */
  async sign(transaction: Transaction): Promise<SignedTransaction> {
    try {
      const result = await this.createAndWaitForPayload(transaction, false);

      return {
        hash: result.txid,
        tx_blob: result.tx_blob,
        signature: result.signature,
        tx_json: result.tx_json,
      };
    } catch (error) {
      if (isWalletError(error)) {
        throw error;
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign and submit a transaction to the ledger.
   */
  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    try {
      const result = await this.createAndWaitForPayload(transaction, true);

      return {
        hash: result.txid,
        tx_blob: result.tx_blob,
        signature: result.signature,
        tx_json: result.tx_json,
      };
    } catch (error) {
      if (isWalletError(error)) {
        throw error;
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign a message - NOT SUPPORTED
   * Xaman SignIn payloads prove account ownership but do not sign arbitrary messages.
   */
  async signMessage(_message: string | Uint8Array): Promise<SignedMessage> {
    throw createWalletError.unsupportedMethod(
      'Arbitrary message signing is not supported via Xaman.'
    );
  }

  /**
   * Parse network from endpoint URL
   */
  private parseNetwork(endpoint: string, networkId: number): NetworkInfo {
    const network = XAMAN_NETWORKS_BY_ID.get(networkId);
    if (!network) throw createWalletError.networkNotSupported(String(networkId), this.name);

    return {
      id: network.id,
      name: network.name,
      wss: endpoint,
      walletConnectId: `xrpl:${networkId}`,
    };
  }

  private resolveRequestedNetwork(
    network: ConnectOptions<XamanConnectOptions>['network']
  ): NetworkInfo {
    try {
      return resolveNetwork(network);
    } catch (error) {
      if (isWalletError(error) && error.code !== WalletErrorCode.UNKNOWN_ERROR) throw error;
      throw createWalletError.networkNotSupported(String(network), this.name);
    }
  }

  private async getAuthoritativeNetwork(
    client: Xumm,
    authorizedMe?: {
      networkEndpoint?: unknown;
      networkId?: unknown;
      networkType?: unknown;
    }
  ): Promise<NetworkInfo> {
    const user = client.user as unknown as {
      networkEndpoint?: Promise<unknown>;
      networkId?: Promise<unknown>;
      networkType?: Promise<unknown>;
    };
    const [userEndpoint, userNetworkId, userNetworkType] = await Promise.all([
      user.networkEndpoint,
      user.networkId,
      user.networkType,
    ]);
    const endpoint =
      typeof authorizedMe?.networkEndpoint === 'string' && authorizedMe.networkEndpoint.length > 0
        ? authorizedMe.networkEndpoint
        : typeof userEndpoint === 'string' && userEndpoint.length > 0
          ? userEndpoint
          : undefined;
    const networkId =
      typeof authorizedMe?.networkId === 'number'
        ? authorizedMe.networkId
        : typeof userNetworkId === 'number'
          ? userNetworkId
          : undefined;
    const networkType =
      typeof authorizedMe?.networkType === 'string'
        ? authorizedMe.networkType
        : typeof userNetworkType === 'string'
          ? userNetworkType
          : undefined;

    if (!endpoint || networkId === undefined) {
      throw new Error(
        'Unable to determine network from Xaman. Make sure the API key and network are correct.'
      );
    }

    const network = this.parseNetwork(endpoint, networkId);
    const xamanNetwork = this.resolveXamanNetwork(network);
    if (networkType !== undefined) {
      this.validateXamanNetwork(xamanNetwork, networkId, networkType);
    }
    return network;
  }

  /**
   * Open popup window for signing or trigger QR code callback
   */
  private openSignWindow(url: string): void {
    logger.debug('openSignWindow called with URL:', url.substring(0, 50) + '...');
    const onQRCode = this.activeCallbacks.onQRCode || this.options.onQRCode;
    logger.debug('onQRCode callback exists:', !!onQRCode);

    // If QR code callback is provided, use that instead of popup
    if (onQRCode) {
      logger.debug('Calling onQRCode callback');
      onQRCode(url);
      return;
    }

    // Otherwise, open popup (legacy behavior)
    logger.debug('Opening popup window');
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      url,
      'Xaman Sign',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  }

  /**
   * Get deep link URI for mobile (Xaman app)
   */
  public getDeepLinkURI(url: string): string {
    const onDeepLink = this.activeCallbacks.onDeepLink || this.options.onDeepLink;
    if (onDeepLink) {
      return onDeepLink(url);
    }
    // Xaman deep link format
    return `xumm://xumm.app/sign/${url.split('/').pop()}`;
  }

  private resolveXamanNetwork(network: NetworkInfo): XamanNetwork {
    const normalizedId = network.id.toLowerCase().replace(/[\s_-]/g, '');
    const aliasNetworkId = XAMAN_NETWORK_ALIASES.get(normalizedId);
    let walletConnectNetworkId: number | undefined;

    if (network.walletConnectId !== undefined) {
      const match = network.walletConnectId.match(/^xrpl:(0|[1-9]\d*)$/);
      if (!match) throw createWalletError.networkNotSupported(network.id, this.name);

      walletConnectNetworkId = Number(match[1]);
      if (!Number.isSafeInteger(walletConnectNetworkId)) {
        throw createWalletError.networkNotSupported(network.id, this.name);
      }
      if (!XAMAN_NETWORKS_BY_ID.has(walletConnectNetworkId)) {
        throw createWalletError.networkNotSupported(network.id, this.name);
      }
    }

    if (
      walletConnectNetworkId !== undefined &&
      aliasNetworkId !== undefined &&
      walletConnectNetworkId !== aliasNetworkId
    ) {
      const expected = XAMAN_NETWORKS_BY_ID.get(aliasNetworkId)!.forceNetwork;
      const actual = XAMAN_NETWORKS_BY_ID.get(walletConnectNetworkId)!.forceNetwork;
      throw createWalletError.networkMismatch(expected, actual);
    }

    const networkId = walletConnectNetworkId ?? aliasNetworkId;
    if (networkId === undefined) {
      throw createWalletError.networkNotSupported(network.id, this.name);
    }
    return XAMAN_NETWORKS_BY_ID.get(networkId)!;
  }

  private validateXamanNetwork(
    expected: XamanNetwork,
    environmentNetworkId: number | null,
    environmentNodeType: string | null,
    dispatchedNodeType?: string | null
  ): void {
    if (environmentNetworkId !== expected.networkId) {
      const actual = environmentNetworkId === null ? 'unknown' : String(environmentNetworkId);
      throw createWalletError.networkMismatch(String(expected.networkId), actual);
    }

    if (
      environmentNodeType !== null &&
      environmentNodeType.toUpperCase() !== expected.forceNetwork
    ) {
      throw createWalletError.networkMismatch(
        expected.forceNetwork,
        environmentNodeType || 'unknown'
      );
    }
    if (
      dispatchedNodeType !== undefined &&
      dispatchedNodeType?.toUpperCase() !== expected.forceNetwork
    ) {
      throw createWalletError.networkMismatch(
        expected.forceNetwork,
        dispatchedNodeType || 'unknown'
      );
    }
  }

  private validateSignedTransaction(
    transaction: Transaction,
    blob: string,
    expectedAccount: string,
    multisign: boolean,
    responseAccount: string | null,
    responseMultisignAccount: string | null,
    network: XamanNetwork
  ): void {
    if (
      (network.networkId > 1024 && transaction.NetworkID !== network.networkId) ||
      (transaction.NetworkID !== undefined && transaction.NetworkID !== network.networkId)
    ) {
      throw new Error('Xaman signed a transaction for a different network');
    }

    const signers = transaction.Signers;

    if (!multisign) {
      if (Array.isArray(signers) && signers.length > 0) {
        throw new Error('Xaman returned unexpected multi-signatures');
      }
      if (transaction.Account !== expectedAccount || responseAccount !== expectedAccount) {
        throw new Error('Xaman signed with an account other than the connected account');
      }
      if (responseMultisignAccount !== null) {
        throw new Error('Xaman returned unexpected multi-signing account data');
      }
      if (!verifySignature(blob)) {
        throw new Error('Xaman returned an invalid transaction signature');
      }
      return;
    }

    if (
      transaction.SigningPubKey !== '' ||
      (typeof transaction.TxnSignature === 'string' && transaction.TxnSignature.length > 0) ||
      !Array.isArray(signers) ||
      signers.length === 0
    ) {
      throw new Error('Xaman returned an invalid multi-signed transaction');
    }
    if (responseMultisignAccount !== expectedAccount || responseAccount !== transaction.Account) {
      throw new Error('Xaman multi-signed with an account other than the connected account');
    }

    let expectedSignerFound = false;
    for (const signerEntry of signers) {
      const signer = signerEntry.Signer;
      if (
        typeof signer.Account !== 'string' ||
        typeof signer.SigningPubKey !== 'string' ||
        signer.SigningPubKey.length === 0 ||
        typeof signer.TxnSignature !== 'string' ||
        signer.TxnSignature.length === 0
      ) {
        throw new Error('Xaman returned malformed multi-signature data');
      }
      if (
        !verifyKeypairSignature(
          encodeForMultiSigning(transaction, signer.Account),
          signer.TxnSignature,
          signer.SigningPubKey
        )
      ) {
        throw new Error('Xaman returned an invalid transaction multi-signature');
      }
      if (signer.Account === expectedAccount) expectedSignerFound = true;
    }
    if (!expectedSignerFound) {
      throw new Error('Xaman multi-signature did not include the connected account');
    }
  }

  private validateRequestedTransaction(
    requested: Transaction,
    actual: Record<string, unknown> | undefined
  ): void {
    if (!actual || !this.containsRequestedValue(requested, actual)) {
      throw new Error('Xaman returned a transaction that did not match the signing request');
    }
  }

  private containsRequestedValue(expected: unknown, actual: unknown, field?: string): boolean {
    if (field && SIGNING_OUTPUT_FIELDS.has(field)) return true;
    if (field === 'Signers') return this.containsRequestedSigners(expected, actual);
    if (Array.isArray(expected)) {
      return (
        Array.isArray(actual) &&
        expected.length === actual.length &&
        expected.every((value, index) => this.containsRequestedValue(value, actual[index]))
      );
    }
    if (expected !== null && typeof expected === 'object') {
      if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
      const actualRecord = actual as Record<string, unknown>;
      return Object.entries(expected).every(([key, value]) =>
        this.containsRequestedValue(value, actualRecord[key], key)
      );
    }
    return Object.is(expected, actual);
  }

  private containsRequestedSigners(expected: unknown, actual: unknown): boolean {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return false;
    const matchedIndexes = new Set<number>();
    return expected.every((expectedSigner) => {
      const matchingIndex = actual.findIndex(
        (actualSigner, index) =>
          !matchedIndexes.has(index) && this.containsRequestedValue(expectedSigner, actualSigner)
      );
      if (matchingIndex === -1) return false;
      matchedIndexes.add(matchingIndex);
      return true;
    });
  }

  private createPayloadOperation(client: Xumm, submit: boolean): ActivePayloadOperation {
    const ready = deferred<void>();
    const stopDecision = deferred<void>();
    const forcedOutcome = deferred<XamanPayloadOutcome>();
    const done = deferred<void>();
    const operation: ActivePayloadOperation = {
      client,
      controller: new AbortController(),
      phase: 'creating' as const,
      opened: false,
      submit,
      stopRequested: false,
      outcomeForced: false,
      ready: ready.promise,
      resolveReady: () => ready.resolve(undefined),
      stopDecision: stopDecision.promise,
      resolveStopDecision: () => stopDecision.resolve(undefined),
      forcedOutcome: forcedOutcome.promise,
      forceOutcome: (_outcome: XamanPayloadOutcome) => {},
      done: done.promise,
      resolveDone: () => done.resolve(undefined),
    };
    operation.forceOutcome = (outcome: XamanPayloadOutcome) => {
      operation.outcomeForced = true;
      forcedOutcome.resolve(outcome);
    };
    return operation;
  }

  private async quiescePayloadOperation(operation: ActivePayloadOperation): Promise<void> {
    operation.stopRequested = true;
    await Promise.race([operation.ready, operation.done]);
    if (operation.phase === 'done') return;

    if (operation.phase === 'fetching') {
      operation.controller.abort();
      await operation.done;
      return;
    }

    if (operation.phase !== 'waiting' || !operation.uuid) {
      operation.resolveStopDecision();
      await operation.done;
      return;
    }

    if (operation.opened && !operation.submit) {
      operation.controller.abort();
      operation.close?.();
      operation.resolveStopDecision();
      await operation.done;
      return;
    }

    if (!operation.opened) {
      try {
        const cancellationRequest = operation.client.payload?.cancel(operation.uuid, true);
        const cancellation = cancellationRequest ? await cancellationRequest : null;
        const reason = cancellation?.result.reason;
        const meta = cancellation?.meta;
        const cancellationConfirmed =
          cancellation?.result.cancelled === true ||
          (meta?.cancelled === true && meta.app_opened !== true) ||
          (meta?.expired === true && meta.app_opened !== true && meta.resolved !== true);

        if (cancellationConfirmed) {
          operation.controller.abort();
          operation.close?.();
        } else {
          if (reason === 'ALREADY_OPENED' || meta?.app_opened === true) {
            operation.opened = true;
          }
          if (reason === 'ALREADY_RESOLVED' || meta?.resolved === true) {
            operation.forceOutcome(meta?.signed === true ? 'signed' : 'rejected');
          }
        }
      } catch (error) {
        logger.debug('Unable to prove Xaman payload cancellation; waiting for its outcome', error);
      }
    }

    if (!operation.submit && !operation.outcomeForced) {
      operation.controller.abort();
      operation.close?.();
    }

    operation.resolveStopDecision();
    await operation.done;
  }

  private async waitForOperation<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) {
      throw new Error('Xaman signing operation was cancelled');
    }

    return await new Promise<T>((resolve, reject) => {
      const handleAbort = () => reject(new Error('Xaman signing operation was cancelled'));
      signal.addEventListener('abort', handleAbort, { once: true });
      promise.then(
        (value) => {
          signal.removeEventListener('abort', handleAbort);
          resolve(value);
        },
        (error) => {
          signal.removeEventListener('abort', handleAbort);
          reject(error);
        }
      );
    });
  }

  private async getResolvedPayload(
    client: Xumm,
    uuid: string,
    retryUntilKnown: boolean,
    signal: AbortSignal
  ) {
    let retryDelay = 250;
    const retryDeadline = Date.now() + RESOLVED_PAYLOAD_RETRY_TIMEOUT_MS;
    while (true) {
      try {
        const request = client.payload?.get(uuid, true);
        if (!request) throw new Error('Failed to retrieve the resolved Xaman payload');
        const resolved = await this.waitForOperationUntil(
          request,
          signal,
          retryDeadline,
          'Timed out retrieving the resolved Xaman payload'
        );
        if (!resolved) throw new Error('Failed to retrieve the resolved Xaman payload');
        return resolved;
      } catch (error) {
        if (!retryUntilKnown || signal.aborted || Date.now() >= retryDeadline) throw error;
        logger.debug('Unable to retrieve submitted Xaman payload; retrying', error);
        const delay = Math.min(retryDelay, retryDeadline - Date.now());
        await this.waitForOperation(
          new Promise<void>((resolve) => setTimeout(resolve, delay)),
          signal
        );
        retryDelay = Math.min(retryDelay * 2, RESOLVED_PAYLOAD_RETRY_MAX_MS);
      }
    }
  }

  private async waitForOperationUntil<T>(
    promise: Promise<T>,
    signal: AbortSignal,
    deadline: number,
    timeoutMessage: string
  ): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error(timeoutMessage)),
        Math.max(0, deadline - Date.now())
      );
    });
    try {
      return await this.waitForOperation(Promise.race([promise, timeoutPromise]), signal);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async waitForPayloadOutcome(
    resolved: Promise<unknown>,
    wasOpened: () => boolean,
    signal: AbortSignal
  ): Promise<unknown> {
    const timedOut = Symbol('timedOut');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<typeof timedOut>((resolve) => {
      timeout = setTimeout(() => resolve(timedOut), SIGNING_TIMEOUT_MS);
    });

    try {
      const outcome = await this.waitForOperation(Promise.race([resolved, timeoutPromise]), signal);
      if (outcome !== timedOut) return outcome;
      if (!wasOpened()) {
        throw new Error('Signing timeout - user did not respond');
      }
      // Xaman expiration is an open-before deadline, not a resolve-before deadline.
      // Once opened, the operation remains active until the wallet resolves it.
      return await this.waitForOperation(resolved, signal);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  /**
   * Cleanup adapter state
   */
  private cleanup(): void {
    this.client = null;
    this.clientApiKey = null;
    this.currentAccount = null;
    this.activeCallbacks = {};
  }
}
