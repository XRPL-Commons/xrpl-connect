/**
 * Clasp Wallet Adapter for XRPL Connect
 *
 * Clasp (https://claspwallet.com) is a browser wallet with no extension and no
 * stored private key. A passkey derives a standard XRPL family seed, so the same
 * account also opens in Xaman or Joey. The adapter opens claspwallet.com in a
 * popup through Clasp's own SDK (`clasp-connect`), one request per popup, pinned
 * to that origin. Every approval shows the full transaction and takes one passkey
 * touch.
 */

import type {
  WalletAdapter,
  WalletAdapterEvent,
  WalletCapabilities,
  WalletError,
  AccountInfo,
  NetworkInfo,
  ConnectOptions,
  ReconnectOptions,
  SupportsReconnectOptions,
  Transaction,
  SignedTransaction,
  SubmittedTransaction,
  SignedMessage,
} from '@xrpl-connect/core';
import {
  createWalletError,
  isWalletError,
  STANDARD_NETWORKS,
  createLogger,
} from '@xrpl-connect/core';
import { ClaspConnect, ClaspError } from 'clasp-connect';
import type { XrplTxRequest } from 'clasp-connect';
import iconSvg from './assets/icon.svg';

const ICON_DATA_URL = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;

/**
 * The only wallet host. A Clasp passkey belongs to this hostname (the WebAuthn
 * relying party), so any other host would be a different wallet holding none of
 * the user's accounts. That is why there is no URL option.
 */
export const CLASP_URL = 'https://claspwallet.com';

/** The networks Clasp signs on. */
type ClaspNetworkId = 'mainnet' | 'testnet';
const CLASP_NETWORKS: readonly ClaspNetworkId[] = ['mainnet', 'testnet'];

const CLASSIC_ADDRESS = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const ED25519_PUBLIC_KEY = /^ED[0-9A-F]{64}$/;

const logger = createLogger('[Clasp]');

export interface ClaspAdapterOptions {
  /** How long one request may wait for the user, in milliseconds. Defaults to 5 minutes. */
  timeoutMs?: number;
}

/**
 * The account a previous session connected, as the WalletManager stores it and
 * hands back on reconnect. Restoring from it opens no popup: every signature
 * names the address, and Clasp refuses to sign for any other account.
 */
export interface ClaspReconnectOptions {
  clasp?: { address: string; publicKey: string };
}

export type ClaspConnectOptions = ConnectOptions<ClaspReconnectOptions>;

/**
 * Clasp adapter implementation for XRPL Connect.
 *
 * Clasp is a passkey wallet in a popup: nothing to install, and every
 * signature takes one passkey touch. It signs transactions, with or without
 * submitting them, on mainnet and testnet. It does not sign arbitrary
 * messages, so `signMessage` is declared unsupported.
 *
 * @example
 * ```typescript
 * import { WalletManager } from '@xrpl-connect/core';
 * import { ClaspAdapter } from '@xrpl-connect/adapter-clasp';
 *
 * const walletManager = new WalletManager({
 *   adapters: [new ClaspAdapter()],
 *   network: 'testnet',
 * });
 *
 * const account = await walletManager.connect('clasp');
 * console.log('Connected:', account.address);
 * ```
 */
export class ClaspAdapter implements WalletAdapter, SupportsReconnectOptions {
  readonly id = 'clasp';
  readonly name = 'Clasp';
  readonly icon = ICON_DATA_URL;
  readonly url = CLASP_URL;
  readonly capabilities: WalletCapabilities = { signMessage: false };

  private readonly client: ClaspConnect;
  private currentAccount: AccountInfo | null = null;
  private connectionGeneration = 0;
  private listeners: Map<WalletAdapterEvent, Set<(data?: unknown) => void>> = new Map();

  constructor(options: ClaspAdapterOptions = {}) {
    this.client = new ClaspConnect({ walletUrl: CLASP_URL, timeoutMs: options.timeoutMs });
  }

  /**
   * Clasp is a web wallet opened in a popup, so it is available wherever the
   * browser can open one.
   */
  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false;
    }
    return typeof window.open === 'function';
  }

  /** Persist the connected account, so a reload restores it without a popup. */
  serializeReconnectOptions(_options: ConnectOptions): ReconnectOptions | undefined {
    if (!this.currentAccount?.publicKey) return undefined;
    return {
      clasp: {
        address: this.currentAccount.address,
        publicKey: this.currentAccount.publicKey,
      },
    };
  }

  /**
   * Connect to Clasp.
   *
   * Opens the wallet popup, where the user unlocks with a passkey and approves
   * sharing the account. A stored account restores without a popup.
   *
   * @param options - Connection options (network config, stored account)
   * @returns Account info with address, public key, and network
   */
  async connect(options?: ClaspConnectOptions): Promise<AccountInfo> {
    const generation = ++this.connectionGeneration;
    const network = this.resolveNetwork(options?.network);
    const restored = options?.clasp;
    if (
      typeof restored?.address === 'string' &&
      CLASSIC_ADDRESS.test(restored.address) &&
      typeof restored.publicKey === 'string' &&
      ED25519_PUBLIC_KEY.test(restored.publicKey)
    ) {
      this.currentAccount = { address: restored.address, publicKey: restored.publicKey, network };
      this.emit('connect', this.currentAccount);
      return this.currentAccount;
    }

    try {
      const result = await this.client.connect({ network: network.id as ClaspNetworkId });
      // A disconnect while the popup was open wins over its late answer
      if (generation !== this.connectionGeneration) throw createWalletError.notConnected();
      if (result.network !== network.id) {
        throw createWalletError.networkMismatch(network.id, result.network);
      }
      this.currentAccount = { address: result.address, publicKey: result.publicKey, network };
      this.emit('connect', this.currentAccount);
      return this.currentAccount;
    } catch (error) {
      const walletError = this.mapError(error, 'connect', network);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Disconnect from Clasp.
   *
   * Clears the local connection state. The wallet keeps no session, so there
   * is nothing to terminate.
   */
  async disconnect(): Promise<void> {
    this.connectionGeneration += 1;
    this.currentAccount = null;
    this.emit('disconnect');
  }

  /**
   * Get the currently connected account information.
   */
  async getAccount(): Promise<AccountInfo | null> {
    return this.currentAccount;
  }

  /**
   * Get the network the account connected on.
   */
  async getNetwork(): Promise<NetworkInfo> {
    if (!this.currentAccount) throw createWalletError.notConnected();
    return this.currentAccount.network;
  }

  /**
   * Sign a transaction without submitting it.
   *
   * The popup shows every field of the transaction and the requesting origin,
   * says that the app will send it, and one passkey touch approves it. Clasp
   * fills in `Account`, `Sequence`, `Fee` and `LastLedgerSequence` only where
   * they are missing, so a filled-in transaction expires a few ledgers after
   * it is signed: submit it promptly.
   *
   * @param transaction - The XRPL transaction object
   * @returns The signed transaction with tx_blob
   */
  async sign(transaction: Transaction): Promise<SignedTransaction> {
    const account = this.requireAccount();
    try {
      const signed = await this.client.sign({
        network: account.network.id as ClaspNetworkId,
        address: account.address,
        tx: transaction as unknown as XrplTxRequest,
      });
      return { hash: signed.hash, tx_blob: signed.tx_blob, signerAddress: account.address };
    } catch (error) {
      const walletError = this.mapError(error, 'sign', account.network);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Sign a transaction and submit it.
   *
   * Clasp submits the transaction and waits for the ledger to validate it.
   * This resolves only when the transaction applied with `tesSUCCESS`; any
   * other outcome rejects with `SIGN_FAILED`, naming the transaction hash when
   * it reached the network so the app can look it up before retrying.
   *
   * @param transaction - The XRPL transaction object
   * @returns The validated transaction's hash
   */
  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    const account = this.requireAccount();
    try {
      const submitted = await this.client.signAndSubmit({
        network: account.network.id as ClaspNetworkId,
        address: account.address,
        tx: transaction as unknown as XrplTxRequest,
      });
      return { hash: submitted.hash, engineResult: submitted.engineResult };
    } catch (error) {
      const walletError = this.mapError(error, 'sign', account.network);
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Message signing is not supported. Clasp signs XRP Ledger transactions only.
   */
  async signMessage(_message: string | Uint8Array): Promise<SignedMessage> {
    throw createWalletError.unsupportedMethod('Clasp signs XRP Ledger transactions only');
  }

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
    this.listeners.get(event)?.delete(callback);
  }

  private requireAccount(): AccountInfo {
    if (!this.currentAccount) throw createWalletError.notConnected();
    return this.currentAccount;
  }

  /**
   * Resolve an xrpl-connect network config to a network Clasp signs on.
   *
   * Clasp signs on mainnet and testnet and chooses its own servers, so only those two
   * standard ids apply. Devnet and custom endpoints are refused before the
   * popup opens.
   */
  private resolveNetwork(config: ConnectOptions['network']): NetworkInfo {
    if (!config) return STANDARD_NETWORKS.mainnet;
    const id = typeof config === 'string' ? config : config.id;
    if ((CLASP_NETWORKS as readonly string[]).includes(id)) {
      return STANDARD_NETWORKS[id as ClaspNetworkId];
    }
    throw createWalletError.networkNotSupported(String(id), this.name);
  }

  /**
   * Emit an event to registered listeners.
   */
  private emit(event: WalletAdapterEvent, data?: unknown): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        logger.error(`Error in ${event} listener`, err);
      }
    });
  }

  /**
   * Map Clasp's errors to xrpl-connect WalletError instances.
   */
  private mapError(
    error: unknown,
    operation: 'connect' | 'sign',
    network: NetworkInfo
  ): WalletError {
    if (isWalletError(error)) return error;
    const cause = error instanceof Error ? error : new Error(String(error));
    const failed = () =>
      operation === 'connect'
        ? createWalletError.connectionFailed(this.name, cause)
        : createWalletError.signFailed(cause);
    if (!(error instanceof ClaspError)) return failed();

    switch (error.code) {
      // The user declined, or closed the popup
      case 'user_rejected':
        return operation === 'connect'
          ? createWalletError.connectionRejected(this.name, cause)
          : createWalletError.signRejected(cause);
      // The browser blocked the popup
      case 'popup_blocked':
        return operation === 'connect' ? createWalletError.notAvailable(this.name) : failed();
      case 'timeout':
        return createWalletError.operationTimeout(operation, cause);
      case 'network_unavailable':
        return createWalletError.networkNotSupported(network.id, this.name);
      // The transaction reached the network: say which one, so the app can look before retrying
      case 'tx_failed':
      case 'not_confirmed': {
        if (!error.hash) return failed();
        const outcome =
          error.code === 'not_confirmed'
            ? 'Submission could not be confirmed. Check the transaction hash before retrying.'
            : `The transaction failed: ${error.engineResult ?? error.message}`;
        const transaction: SubmittedTransaction = { hash: error.hash };
        if (error.engineResult) transaction.engineResult = error.engineResult;
        return createWalletError.signFailed(
          Object.assign(new Error(`${outcome} Transaction hash: ${error.hash}`), {
            transaction,
            cause,
          })
        );
      }
      default:
        return failed();
    }
  }
}
