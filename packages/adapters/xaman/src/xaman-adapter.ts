/**
 * Xaman (formerly Xumm) Wallet Adapter
 */

import { Xumm } from 'xumm';
import { decode, hashes } from 'xrpl';
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
} from '@xrpl-connect/core';
import { createWalletError, createLogger, isWalletError, resolveNetwork } from '@xrpl-connect/core';
import iconSvg from './assets/icon.svg';

const ICON_DATA_URL = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;
const SIGNING_TIMEOUT_MS = 5 * 60 * 1000;

type XamanPayloadOutcome = 'signed' | 'rejected' | 'expired';

/**
 * Logger instance for Xaman adapter
 */
const logger = createLogger('[Xaman]');

/**
 * Xaman adapter options
 */
export interface XamanAdapterOptions {
  apiKey?: string; // Xumm API key (can also be provided in connect options)
  onQRCode?: (uri: string) => void; // Callback for QR code URI
  onDeepLink?: (uri: string) => string; // Transform URI for deep linking
  // returnUrl?: string; // URL to return to after signing on mobile (appends ?payloadId=xxx). If not provided, keeps listening in background
}

export type XamanConnectOptions = {
  apiKey?: string;
  onQRCode?: (uri: string) => void;
  onDeepLink?: (uri: string) => string;
};

/**
 * Xaman wallet adapter implementation
 */
export class XamanAdapter implements WalletAdapter, SupportsDeepLink {
  readonly id = 'xaman';
  readonly name = 'Xaman';
  readonly icon = ICON_DATA_URL;
  readonly url = 'https://xaman.app';

  private client: Xumm | null = null;
  private currentAccount: AccountInfo | null = null;
  private options: XamanAdapterOptions;
  private activePayloadOperations = new Set<AbortController>();
  // Per-connection callback overrides. Populated by connect() and cleared by
  // cleanup(); avoids mutating constructor-supplied options across calls.
  private activeCallbacks: {
    onQRCode?: (uri: string) => void;
    onDeepLink?: (uri: string) => string;
  } = {};

  constructor(options: XamanAdapterOptions = {}) {
    this.options = options;
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
    let network = options?.network;

    if (!apiKey) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error(
          'API key is required for Xaman. Please provide it in connect options or adapter constructor.'
        )
      );
    }

    this.client = new Xumm(apiKey);
    const address = await this.client.user.account;

    if (!address) {
      this.client.logout();
      return null;
    }

    // Resolve network if not provided
    const currentNetwork = (await this.getAccount())?.network;
    if (!network) network = currentNetwork;

    let resolvedNetwork: NetworkInfo;
    if (network) {
      resolvedNetwork = resolveNetwork(network);
    } else {
      const xamanNetwork = await this.client.user.networkEndpoint;
      if (!xamanNetwork) {
        throw createWalletError.connectionFailed(
          this.name,
          new Error(
            'Unable to determine network from Xaman. Make sure the API key and network are correct.'
          )
        );
      }
      resolvedNetwork = this.parseNetwork(xamanNetwork);
    }

    this.currentAccount = {
      address,
      publicKey: undefined, // Xaman doesn't expose public key
      network: resolvedNetwork,
    };

    return this.currentAccount;
  }

  /**
   * Connect to Xaman wallet
   */
  async connect(options?: ConnectOptions<XamanConnectOptions>): Promise<AccountInfo> {
    const apiKey = options?.apiKey || this.options.apiKey;

    if (!apiKey) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error(
          'API key is required for Xaman. Please provide it in connect options or adapter constructor.'
        )
      );
    }

    // Reset any leftover state from a previous connection attempt so a fast
    // disconnect → connect cycle doesn't carry stale client/callbacks forward.
    this.cleanup();

    // Stash per-connection callback overrides without mutating constructor
    // options — those must remain valid for any future connect() call.
    this.activeCallbacks = {
      onQRCode: options?.onQRCode,
      onDeepLink: options?.onDeepLink,
    };

    try {
      this.client = new Xumm(apiKey);
      logger.debug('Starting authorization flow');

      const authResult = await this.client.authorize();
      logger.debug('Authorization result:', {
        hasResult: !!authResult,
        isError: authResult instanceof Error,
        hasMe: authResult && !(authResult instanceof Error) ? !!authResult.me : false,
      });

      if (!authResult || authResult instanceof Error) {
        throw authResult || new Error('Authorization failed');
      }

      logger.debug('Authorization successful', { account: authResult.me?.account });

      const account = authResult.me.account;
      const network: NetworkInfo = resolveNetwork(options?.network);

      this.currentAccount = {
        address: account,
        publicKey: undefined, // Xaman doesn't expose public key in authorize response
        network,
      };

      return this.currentAccount;
    } catch (error) {
      logger.error('Authorization failed:', error);
      // Drop the half-initialized client + per-connection callbacks so the
      // next connect() starts from a clean slate.
      this.cleanup();
      throw createWalletError.connectionFailed(this.name, error as Error);
    }
  }

  /**
   * Disconnect from Xaman
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    const client = this.client;
    this.cleanup();

    try {
      await client.logout();
    } catch (error) {
      // Logout might fail if already logged out, that's okay
    }
  }

  /**
   * Get current account
   */
  async getAccount(): Promise<AccountInfo | null> {
    return this.currentAccount;
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
    const forceNetwork = network.id.toUpperCase();
    let payloadOpened = false;
    const operation = new AbortController();
    let handleAbort: (() => void) | undefined;
    this.activePayloadOperations.add(operation);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payloadBody: any = {
      txjson: transaction,
      options: { submit, force_network: forceNetwork },
    };

    try {
      const creation = client.payload?.createAndSubscribe(payloadBody, ({ data, payload }) => {
        if (data.opened === true || data.pre_signed === true || payload.meta.app_opened === true) {
          payloadOpened = true;
        }
        if (data.signed === true) return 'signed' satisfies XamanPayloadOutcome;
        if (data.signed === false) return 'rejected' satisfies XamanPayloadOutcome;
        if (data.cancelled === true) return 'expired' satisfies XamanPayloadOutcome;
        if (data.expired === true && !payloadOpened) {
          return 'expired' satisfies XamanPayloadOutcome;
        }
        return undefined;
      });

      if (!creation) {
        throw new Error('Failed to create payload');
      }

      let payload: Awaited<typeof creation>;
      try {
        payload = await this.waitForOperation(creation, operation.signal);
      } catch (error) {
        if (operation.signal.aborted) {
          void creation
            .then(async (latePayload) => {
              const createdPayload = await latePayload;
              createdPayload.resolve();
              this.cancelXamanPayload(client, createdPayload.created.uuid);
            })
            .catch(() => {});
        }
        throw error;
      }

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
      handleAbort = () => this.cancelXamanPayload(client, payload.created.uuid);
      operation.signal.addEventListener('abort', handleAbort, { once: true });
      if (operation.signal.aborted) {
        handleAbort();
        closeSubscription();
        throw new Error('Xaman signing operation was cancelled');
      }

      let outcome: unknown;
      try {
        this.openSignWindow(payload.created.next.always);
        outcome = await this.waitForPayloadOutcome(
          payload.resolved,
          () => payloadOpened,
          operation.signal
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

      const resolvedPayload = client.payload?.get(payload.created.uuid, true);
      if (!resolvedPayload) {
        throw new Error('Failed to retrieve the resolved Xaman payload');
      }
      const resolved = await this.waitForOperation(resolvedPayload, operation.signal);
      if (!resolved?.meta.resolved || !resolved.meta.signed) {
        throw new Error('Xaman returned an unresolved or unsigned payload');
      }

      if (resolved.meta.submit !== submit) {
        throw new Error('Xaman payload submission mode did not match the requested operation');
      }

      const { response } = resolved;
      if (typeof response.hex !== 'string' || response.hex.length === 0) {
        throw new Error('Xaman did not return a signed transaction blob');
      }
      if (typeof response.txid !== 'string' || response.txid.length === 0) {
        throw new Error('Xaman did not return a signed transaction hash');
      }

      this.validateXamanNetwork(
        network,
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
      if (handleAbort) operation.signal.removeEventListener('abort', handleAbort);
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
   * Sign a message (for authentication/verification)
   */
  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    if (!this.client || !this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      // Convert message to string if Uint8Array
      const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);

      // Use SignIn payload type for message signing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = await this.client.payload?.create({
        TransactionType: 'SignIn',
      });

      if (!payload) {
        throw new Error('Failed to create sign message payload');
      }

      // Open popup for signing
      this.openSignWindow(payload.next.always);

      // Note: Xaman doesn't directly support arbitrary message signing
      // This is a simplified implementation - in production, you'd use a custom payload
      // or implement a different approach (like signing a memo field)

      return {
        message: messageStr,
        signature: '', // Would need to extract from Xaman response
        publicKey: this.currentAccount.publicKey || '',
      };
    } catch (error) {
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Parse network from endpoint URL
   */
  private parseNetwork(endpoint: string): NetworkInfo {
    const normalized = endpoint.toLowerCase();

    if (normalized.includes('testnet') || normalized.includes('altnet')) {
      return {
        id: 'testnet',
        name: 'Testnet',
        wss: endpoint,
        walletConnectId: 'xrpl:1',
      };
    }

    if (normalized.includes('devnet')) {
      return {
        id: 'devnet',
        name: 'Devnet',
        wss: endpoint,
        walletConnectId: 'xrpl:2',
      };
    }

    // Default to mainnet
    return {
      id: 'mainnet',
      name: 'Mainnet',
      wss: endpoint || 'wss://xrplcluster.com',
      walletConnectId: 'xrpl:0',
    };
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

  private validateXamanNetwork(
    expected: NetworkInfo,
    environmentNetworkId: number | null,
    environmentNodeType: string | null,
    dispatchedNodeType?: string | null
  ): void {
    const expectedNodeType = expected.id.toUpperCase();
    const chainId = expected.walletConnectId?.match(/^xrpl:(\d+)$/)?.[1];
    const expectedNetworkId = chainId === undefined ? undefined : Number(chainId);
    if (expectedNetworkId !== undefined) {
      if (environmentNetworkId !== expectedNetworkId) {
        const actual = environmentNetworkId === null ? 'unknown' : String(environmentNetworkId);
        throw createWalletError.networkMismatch(expected.id, actual);
      }
    }

    if (environmentNodeType !== null && environmentNodeType.toUpperCase() !== expectedNodeType) {
      throw createWalletError.networkMismatch(expected.id, environmentNodeType || 'unknown');
    }
    if (expectedNetworkId === undefined && environmentNodeType === null) {
      throw createWalletError.networkMismatch(expected.id, 'unknown');
    }
    if (
      dispatchedNodeType !== undefined &&
      dispatchedNodeType?.toUpperCase() !== expectedNodeType
    ) {
      throw createWalletError.networkMismatch(expected.id, dispatchedNodeType || 'unknown');
    }
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

  private cancelXamanPayload(client: Xumm, uuid: string): void {
    const cancellation = client.payload?.cancel(uuid, true);
    if (cancellation) void cancellation.catch(() => {});
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
      // Once opened, the operation remains active until the wallet resolves it or
      // connect()/disconnect() aborts the registered operation.
      return await this.waitForOperation(resolved, signal);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  /**
   * Cleanup adapter state
   */
  private cleanup(): void {
    for (const operation of this.activePayloadOperations) operation.abort();
    this.activePayloadOperations.clear();
    this.client = null;
    this.currentAccount = null;
    this.activeCallbacks = {};
  }
}
