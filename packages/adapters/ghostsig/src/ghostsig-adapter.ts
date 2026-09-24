/**
 * GHOSTSIG Wallet Adapter for XRPL Connect
 *
 * GHOSTSIG (https://ghostsig.dev) is a hosted wallet with no extension and no
 * stored private key. A passkey's PRF output is expanded into an ed25519 key
 * for one signature and zeroed. The adapter opens ghostsig.dev in a popup and
 * exchanges one request per signature over postMessage, pinned to that origin.
 * The signing digest is the WebAuthn challenge, so one passkey prompt approves
 * one transaction.
 */

import type {
  WalletAdapter,
  WalletAdapterEvent,
  WalletCapabilities,
  AccountInfo,
  NetworkInfo,
  ConnectOptions,
  ReconnectOptions,
  SupportsReconnectOptions,
  Transaction,
  SignedTransaction,
  SubmittedTransaction,
  SignedMessage,
  StandardNetworkId,
} from '@xrpl-connect/core';
import {
  createWalletError,
  isWalletError,
  STANDARD_NETWORKS,
  isStandardNetworkId,
  createLogger,
} from '@xrpl-connect/core';
import { ghostsigRequest, GhostsigError } from './popup';
import type { GhostsigConnectResult, GhostsigSignResult } from './popup';
import iconSvg from './assets/icon.svg';

const ICON_DATA_URL = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;

const logger = createLogger('[GHOSTSIG]');

export interface GhostsigAdapterOptions {
  /** The wallet page to open. Defaults to https://ghostsig.dev/?connect. */
  url?: string;
  /** How long one request may wait for the user, in milliseconds. Defaults to 60 seconds. */
  timeoutMs?: number;
}

/**
 * The account a previous session connected, as the WalletManager stores it and
 * hands back on reconnect. Restoring from it opens no popup: the next signature
 * names the address, and the wallet's reply is checked against it.
 */
export interface GhostsigReconnectOptions {
  ghostsig?: { address: string; publicKey: string };
}

export type GhostsigConnectOptions = ConnectOptions<GhostsigReconnectOptions>;

/** XRPL Connect's public key form: the 33-byte ED-prefixed key, upper-case hex. */
const xrplPublicKey = (raw: string) => `ED${raw.toUpperCase()}`;

/**
 * GHOSTSIG adapter implementation for XRPL Connect.
 *
 * GHOSTSIG is a hosted passkey wallet. It needs no extension and no install:
 * the wallet opens in a popup, and every signature takes one passkey prompt.
 * It signs transactions only, so `signMessage` is declared unsupported.
 *
 * @example
 * ```typescript
 * import { WalletManager } from '@xrpl-connect/core';
 * import { GhostsigAdapter } from '@xrpl-connect/adapter-ghostsig';
 *
 * const walletManager = new WalletManager({
 *   adapters: [new GhostsigAdapter()],
 *   network: 'testnet',
 * });
 *
 * const account = await walletManager.connect('ghostsig');
 * console.log('Connected:', account.address);
 * ```
 */
export class GhostsigAdapter implements WalletAdapter, SupportsReconnectOptions {
  readonly id = 'ghostsig';
  readonly name = 'GHOSTSIG';
  readonly icon = ICON_DATA_URL;
  readonly url = 'https://ghostsig.dev';
  readonly capabilities: WalletCapabilities = { signMessage: false };

  private readonly walletUrl?: string;
  private readonly timeoutMs?: number;
  private currentAccount: AccountInfo | null = null;
  private connectionGeneration = 0;
  private listeners: Map<WalletAdapterEvent, Set<(data?: unknown) => void>> = new Map();

  constructor(options: GhostsigAdapterOptions = {}) {
    this.walletUrl = options.url;
    this.timeoutMs = options.timeoutMs;
  }

  /**
   * GHOSTSIG is a web wallet opened in a popup, so it is available wherever
   * the browser can open one.
   */
  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false;
    }
    return typeof window.open === 'function';
  }

  /** Persist the connected account, so a reload restores it without a popup. */
  serializeReconnectOptions(_options: ConnectOptions): ReconnectOptions | undefined {
    if (!this.currentAccount) return undefined;
    return {
      ghostsig: {
        address: this.currentAccount.address,
        publicKey: this.currentAccount.publicKey,
      },
    };
  }

  /**
   * Connect to GHOSTSIG.
   *
   * Opens the wallet popup, where the user signs in with a passkey and
   * approves sharing the account. A stored account restores without a popup.
   *
   * @param options - Connection options (network config, stored account)
   * @returns Account info with address, public key, and network
   */
  async connect(options?: GhostsigConnectOptions): Promise<AccountInfo> {
    const generation = ++this.connectionGeneration;
    const network = this.resolveNetwork(options?.network);
    const restored = options?.ghostsig;
    if (typeof restored?.address === 'string' && typeof restored.publicKey === 'string') {
      this.currentAccount = { address: restored.address, publicKey: restored.publicKey, network };
      this.emit('connect', this.currentAccount);
      return this.currentAccount;
    }

    try {
      const result = await this.request<GhostsigConnectResult>(network, 'connect', {});
      // A disconnect while the popup was open wins over its late answer
      if (generation !== this.connectionGeneration) throw createWalletError.notConnected();
      this.currentAccount = {
        address: result.address,
        publicKey: xrplPublicKey(result.publicKey),
        network,
      };
      this.emit('connect', this.currentAccount);
      return this.currentAccount;
    } catch (error) {
      const walletError = this.mapError(error, 'connect');
      this.emit('error', walletError);
      throw walletError;
    }
  }

  /**
   * Disconnect from GHOSTSIG.
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
   * The popup shows the transaction and the requesting origin, and one
   * passkey prompt approves it. The wallet fills in a missing Sequence, Fee
   * or LastLedgerSequence from the ledger.
   *
   * @param transaction - The XRPL transaction object
   * @returns The signed transaction with tx_blob
   */
  async sign(transaction: Transaction): Promise<SignedTransaction> {
    const signed = await this.signRequest(transaction, false);
    return this.toSignedTransaction(signed);
  }

  /**
   * Sign a transaction and submit it through the wallet's own node.
   *
   * @param transaction - The XRPL transaction object
   * @returns The submitted transaction with the ledger outcome
   */
  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    const signed = await this.signRequest(transaction, true);
    const submitted = signed.submitted;
    const result: SubmittedTransaction = { ...this.toSignedTransaction(signed) };
    if (submitted) result.submitted = submitted;
    if (!signed.handOver && submitted?.kind === 'validated' && submitted.ok === true) {
      return result;
    }

    let message: string;
    if (
      signed.handOver ||
      ['offline', 'unsent', 'locked', 'moved', 'handOver'].includes(submitted?.kind ?? '')
    ) {
      message = `Nothing was submitted: ${signed.handOver || submitted?.kind}`;
    } else if (submitted?.ok === false) {
      message = `The transaction failed: ${submitted.code ?? submitted.kind}`;
    } else {
      message = 'Submission could not be confirmed. Check the transaction hash before retrying.';
    }
    const cause = Object.assign(new Error(`${message} Transaction hash: ${signed.hash}`), {
      transaction: result,
    });
    const walletError = createWalletError.signFailed(cause);
    this.emit('error', walletError);
    throw walletError;
  }

  /**
   * Message signing is not supported. GHOSTSIG signs XRPL transactions only.
   */
  async signMessage(_message: string | Uint8Array): Promise<SignedMessage> {
    throw createWalletError.unsupportedMethod('GHOSTSIG signs XRP Ledger transactions only');
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

  /**
   * Ask the wallet to sign the transaction for the connected account.
   */
  private async signRequest(
    transaction: Transaction,
    submit: boolean
  ): Promise<GhostsigSignResult> {
    if (!this.currentAccount) throw createWalletError.notConnected();
    const account = this.currentAccount;
    const tx = { ...transaction, Account: transaction.Account || account.address };
    try {
      return await this.request<GhostsigSignResult>(account.network, 'sign', {
        payload: JSON.stringify(tx),
        submit,
        address: account.address,
      });
    } catch (error) {
      const walletError = this.mapError(error, 'sign');
      this.emit('error', walletError);
      throw walletError;
    }
  }

  private request<T>(network: NetworkInfo, method: string, params: Record<string, unknown>) {
    return ghostsigRequest<T>({
      chain: 'xrpl',
      network: network.id,
      method,
      params,
      url: this.walletUrl,
      timeoutMs: this.timeoutMs,
    });
  }

  private toSignedTransaction(signed: GhostsigSignResult): SignedTransaction {
    const result: SignedTransaction = {
      hash: signed.hash,
      tx_blob: signed.blob,
      signature: signed.signature,
      signerAddress: signed.address,
    };
    if (signed.handOver) result.handOver = signed.handOver;
    return result;
  }

  /**
   * Resolve an xrpl-connect network config to a standard network.
   *
   * GHOSTSIG connects to its own nodes, so only the standard network ids
   * apply. A custom endpoint is refused before the popup opens.
   */
  private resolveNetwork(config: ConnectOptions['network']): NetworkInfo {
    if (!config) return STANDARD_NETWORKS.mainnet;
    const id = typeof config === 'string' ? config : config.id;
    if (isStandardNetworkId(id)) return STANDARD_NETWORKS[id as StandardNetworkId];
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
   * Map GHOSTSIG popup errors to xrpl-connect WalletError instances.
   */
  private mapError(
    error: unknown,
    operation: 'connect' | 'sign'
  ): ReturnType<typeof createWalletError.connectionFailed> {
    if (isWalletError(error)) return error;
    const cause = error instanceof Error ? error : new Error(String(error));
    const popupError = error instanceof GhostsigError ? error : null;

    // The user declined the prompt or closed the popup
    if (popupError?.code === -4) {
      return operation === 'connect'
        ? createWalletError.connectionRejected(this.name, cause)
        : createWalletError.signRejected(cause);
    }

    // The browser blocked the popup
    if (popupError?.ext === 'popup_blocked' && operation === 'connect') {
      return createWalletError.notAvailable(this.name);
    }

    return operation === 'connect'
      ? createWalletError.connectionFailed(this.name, cause)
      : createWalletError.signFailed(cause);
  }
}
