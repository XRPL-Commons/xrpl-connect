import { Client } from 'xrpl';
import {
  createWalletError,
  isStandardNetworkId,
  isWalletError,
  WalletError,
  WalletErrorCode,
  resolveNetwork,
  type AccountInfo,
  type ConnectOptions,
  type NetworkInfo,
  type ReconnectOptions,
  type SignedMessage,
  type SignedTransaction,
  type SubmittedTransaction,
  type Transaction,
  type WalletAdapter,
  type WalletAdapterEvent,
  type WalletAuthPrompt,
  type WalletCapabilities,
  type WalletErrorReason,
  type WalletLoginMethod,
  type WalletTransactionReview,
} from 'xrpl-connect';
import { PrivySession } from './session';
import type { PrivyMfaApi } from './mfa';
import { PRIVY_ATTRIBUTION, PRIVY_SYMBOL } from './branding';
import { createTransactionReview } from './review';
import type { PrivySessionOptions, PrivyWallet } from './session-types';
import {
  assertFeeWithinLimit,
  MAX_FEE_XRP,
  prepareSigningInput,
  signPreparedTransaction,
  validateWallet,
} from './signing';

/**
 * How the user approves a transaction before the embedded wallet signs it.
 * A function receives the review and a signal that aborts when the connection
 * ends, and approves only by returning `true`.
 */
export type PrivyTransactionReviewOption =
  | 'prompt'
  | 'none'
  | ((review: WalletTransactionReview, signal: AbortSignal) => boolean | Promise<boolean>);

export interface PrivyAdapterOptions extends PrivySessionOptions {
  /**
   * `'prompt'` (default) asks through `onAuthPrompt()`: the wallet connector
   * shows the transaction and the wallet signs only after the user approves.
   * Signing fails when nothing is subscribed. A function replaces the prompt
   * with your own review. `'none'` signs without asking anyone, so any script
   * running in the page can sign with the user's wallet.
   */
  transactionReview?: PrivyTransactionReviewOption;
}

type PrivySessionLike = Pick<
  PrivySession,
  | 'connect'
  | 'disconnect'
  | 'signHash'
  | 'hasPendingConnection'
  | 'onAuthPrompt'
  | 'onSessionLost'
  | 'getLoginMethods'
> & {
  mfa?: PrivyMfaApi;
  getAccessToken?: () => Promise<string | null>;
};

/** How long an unused ledger connection stays open for the next signature. */
const LEDGER_IDLE_MS = 30_000;

const NO_REVIEWER_MESSAGE =
  'Privy transaction review needs a confirmation prompt. Connect through the wallet connector UI or subscribe with onAuthPrompt() first.';

interface LedgerConnection {
  readonly client: Client;
  readonly wss: string;
  readonly ready: Promise<void>;
  users: number;
  idleTimer?: ReturnType<typeof setTimeout>;
}

export interface PrivyConnectOptions {
  /** ID of one of the adapter's configured login methods. */
  loginMethod?: string;
  /** Internal restore identity, persisted by WalletManager without authentication tokens. */
  privyWalletId?: string;
  privyUserId?: string;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function mfaWalletError(error: unknown): WalletError | undefined {
  const reason = (error as { reason?: WalletErrorReason } | null)?.reason;
  if (reason === 'mfa_timeout') {
    return new WalletError(
      WalletErrorCode.OPERATION_TIMEOUT,
      'Privy MFA timed out.',
      asError(error),
      reason
    );
  }
  if (reason === 'mfa_cancelled') {
    return new WalletError(
      WalletErrorCode.SIGN_REJECTED,
      'Privy MFA was cancelled.',
      asError(error),
      reason
    );
  }
  if (reason === 'mfa_required') {
    return new WalletError(
      WalletErrorCode.SIGN_FAILED,
      'Privy MFA requires a passkey confirmation.',
      asError(error),
      reason
    );
  }
  return undefined;
}

export class PrivyWalletAdapter implements WalletAdapter {
  readonly id = 'privy';
  readonly name = 'Privy';
  readonly icon = PRIVY_SYMBOL;
  readonly loginBranding = { label: 'Protected by Privy', logo: PRIVY_ATTRIBUTION } as const;
  readonly url = 'https://privy.io';
  readonly capabilities: Readonly<Required<WalletCapabilities>> = {
    sign: true,
    signAndSubmit: true,
    signMessage: false,
  };
  readonly keepsSessionOnRestoreTimeout = true;

  protected readonly session: PrivySessionLike;
  private readonly listeners = new Map<WalletAdapterEvent, Set<(data: unknown) => void>>();
  private controller: AbortController | null = null;
  private wallet: PrivyWallet | null = null;
  private account: AccountInfo | null = null;
  private teardown: Promise<void> | null = null;
  private ledger: LedgerConnection | null = null;
  private readonly promptListeners = new Set<(prompt: WalletAuthPrompt | null) => void>();
  /** Settles once the latest review is answered; reviews never overlap. */
  private reviewQueue: Promise<void> = Promise.resolve();

  readonly mfa: PrivyMfaApi;

  constructor(private readonly options: PrivyAdapterOptions, session: PrivySessionLike) {
    this.session = session;
    this.mfa =
      session.mfa ??
      ({
        status: async () => {
          throw new Error('Privy MFA is unavailable before the session is initialized');
        },
        linkPasskey: async () => {
          throw new Error('Privy MFA is unavailable before the session is initialized');
        },
        enrollPasskey: async () => {
          throw new Error('Privy MFA is unavailable before the session is initialized');
        },
      } satisfies PrivyMfaApi);
    this.session.onSessionLost(() => {
      const connected = this.account !== null;
      this.controller?.abort();
      this.controller = null;
      this.account = null;
      this.wallet = null;
      this.releaseLedger();
      if (connected) this.emit('disconnect');
    });
  }

  getMissingConfiguration(): readonly string[] {
    const missing: string[] = [];
    if (!this.options.appId?.trim()) missing.push('appId');
    return missing;
  }

  async isAvailable(): Promise<boolean> {
    return (
      typeof window !== 'undefined' &&
      typeof document !== 'undefined' &&
      this.getMissingConfiguration().length === 0
    );
  }

  hasPendingConnection(): boolean {
    return this.session.hasPendingConnection();
  }

  async getLoginMethods(options?: { signal?: AbortSignal }): Promise<readonly WalletLoginMethod[]> {
    return this.session.getLoginMethods(options?.signal);
  }

  onAuthPrompt(callback: (prompt: WalletAuthPrompt | null) => void): () => void {
    // Subscribe on the session itself: it refuses prompt-based logins while
    // nobody is listening instead of waiting for an answer that cannot come.
    // Transaction reviews reach the same listeners and refuse the same way.
    const unsubscribe = this.session.onAuthPrompt(callback);
    this.promptListeners.add(callback);
    return () => {
      this.promptListeners.delete(callback);
      unsubscribe();
    };
  }

  serializeReconnectOptions(): ReconnectOptions | undefined {
    return this.wallet
      ? { privyWalletId: this.wallet.id, privyUserId: this.wallet.userId }
      : undefined;
  }

  async connect(options?: ConnectOptions<PrivyConnectOptions>): Promise<AccountInfo> {
    if (this.controller) throw createWalletError.alreadyConnected(this.name);
    const missing = this.getMissingConfiguration();
    if (missing.length) throw createWalletError.configurationRequired(this.name, missing);
    if (typeof options?.network === 'string' && !isStandardNetworkId(options.network)) {
      throw createWalletError.networkNotSupported(options.network, this.name);
    }
    const network = resolveNetwork(options?.network);
    const controller = new AbortController();
    this.controller = controller;
    const restoring = Boolean(options?.privyWalletId || options?.privyUserId);
    try {
      if (this.teardown) await this.teardown;
      this.assertActive(controller);
      if (!(await this.isAvailable())) throw createWalletError.notAvailable(this.name);
      this.assertActive(controller);
      if (Boolean(options?.privyWalletId) !== Boolean(options?.privyUserId)) {
        throw new Error('Restoring Privy requires both the wallet and user identity');
      }
      const restore =
        options?.privyWalletId && options.privyUserId
          ? { walletId: options.privyWalletId, userId: options.privyUserId }
          : undefined;
      const wallet = await this.session.connect(options?.loginMethod, controller.signal, restore);
      this.assertActive(controller);
      validateWallet(wallet);
      if (restore && (wallet.id !== restore.walletId || wallet.userId !== restore.userId)) {
        throw new Error('Privy session does not match the saved wallet and user');
      }
      this.wallet = { ...wallet };
      this.account = {
        address: wallet.address,
        publicKey: wallet.publicKey.toUpperCase(),
        network,
      };
      return this.copyAccount(this.account);
    } catch (error) {
      const cancelled = controller.signal.aborted;
      if (this.controller === controller) {
        // A failed restore signed nobody in, so it leaves the Privy session
        // alone: a transient failure can then be retried without a new login.
        // The teardown is not awaited: it waits for abandoned SDK work, and the
        // caller should see the failure now. The next connect waits for it.
        void this.endSession(!restoring).catch(() => undefined);
      }
      if (cancelled) throw createWalletError.notConnected();
      if (isWalletError(error)) throw error;
      throw createWalletError.connectionFailed(this.name, asError(error));
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.wallet || !this.account || !this.session.getAccessToken) return null;
    return this.session.getAccessToken();
  }

  async disconnect(): Promise<void> {
    await this.endSession(true);
  }

  private async endSession(logout: boolean): Promise<void> {
    const connected = this.account !== null;
    this.controller?.abort();
    this.controller = null;
    this.wallet = null;
    this.account = null;
    this.releaseLedger();
    if (this.teardown) {
      const joined = this.teardown;
      // The teardown in flight may be preserving the Privy session after a
      // failed restore; an explicit logout must still reach the session.
      if (logout) await Promise.all([joined, this.session.disconnect()]);
      return joined;
    }
    const teardown = this.session.disconnect({ preserveProviderSession: !logout });
    this.teardown = teardown;
    try {
      await teardown;
    } finally {
      if (this.teardown === teardown) this.teardown = null;
      if (connected) this.emit('disconnect');
    }
  }

  async getAccount(): Promise<AccountInfo | null> {
    return this.account ? this.copyAccount(this.account) : null;
  }

  async getNetwork(): Promise<NetworkInfo> {
    if (!this.account) throw createWalletError.notConnected();
    return { ...this.account.network };
  }

  async sign(transaction: Transaction): Promise<SignedTransaction> {
    try {
      const { wallet, account, controller } = this.signingContext();
      const input = prepareSigningInput(transaction, wallet);
      const prepared =
        input.Fee !== undefined && input.Sequence !== undefined
          ? input
          : await this.autofill(input, account.network, controller);
      return await this.signPrepared(prepared, wallet, account.network, controller, 'sign');
    } catch (error) {
      if (isWalletError(error)) throw error;
      const mfaFailure = mfaWalletError(error);
      if (mfaFailure) throw mfaFailure;
      throw createWalletError.signFailed(asError(error));
    }
  }

  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    try {
      const { wallet, account, controller } = this.signingContext();
      const input = prepareSigningInput(transaction, wallet);
      // submitAndWait requires a ledger bound, even when Fee and Sequence are supplied.
      const prepared = await this.autofill(input, account.network, controller);
      // The review happens between ledger operations, so a slow answer holds
      // no connection open and a rejection leaves the shared one intact.
      const signed = await this.signPrepared(
        prepared,
        wallet,
        account.network,
        controller,
        'signAndSubmit'
      );
      return await this.withClient(account.network, async (client) => {
        this.assertActive(controller);
        const result = await client.submitAndWait(signed.tx_blob!);
        const metadata = result.result.meta;
        // A validated tec result consumed the fee and sequence. Return it like a
        // success so the caller sees the hash and outcome instead of retrying.
        // Logout cannot undo a submission; retain its validated result for the caller.
        return {
          ...signed,
          hash: result.result.hash,
          id: result.result.hash,
          transactionResult:
            metadata && typeof metadata === 'object' ? metadata.TransactionResult : undefined,
        };
      });
    } catch (error) {
      if (isWalletError(error)) throw error;
      const mfaFailure = mfaWalletError(error);
      if (mfaFailure) throw mfaFailure;
      throw createWalletError.signFailed(asError(error));
    }
  }

  async signMessage(_message: string | Uint8Array): Promise<SignedMessage> {
    throw createWalletError.unsupportedMethod('Privy supports XRPL transaction signing only');
  }

  on(event: WalletAdapterEvent, callback: (data: unknown) => void): void {
    let listeners = this.listeners.get(event);
    if (!listeners) this.listeners.set(event, (listeners = new Set()));
    listeners.add(callback);
  }

  off(event: WalletAdapterEvent, callback: (data: unknown) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: WalletAdapterEvent): void {
    for (const callback of this.listeners.get(event) ?? []) callback(undefined);
  }

  private signingContext() {
    if (!this.wallet || !this.account || !this.controller) throw createWalletError.notConnected();
    return { wallet: this.wallet, account: this.account, controller: this.controller };
  }

  private autofill(
    input: Transaction,
    network: NetworkInfo,
    controller: AbortController
  ): Promise<Transaction> {
    return this.withClient(network, async (client) => {
      this.assertActive(controller);
      return client.autofill(input);
    });
  }

  private async signPrepared(
    transaction: Transaction,
    wallet: PrivyWallet,
    network: NetworkInfo,
    controller: AbortController,
    action: WalletTransactionReview['action']
  ): Promise<SignedTransaction> {
    this.assertActive(controller);
    assertFeeWithinLimit(transaction);
    await this.review(transaction, network, action, controller);
    this.assertActive(controller);
    const signed = await signPreparedTransaction(transaction, wallet, (hash) => {
      this.assertActive(controller);
      return this.session.signHash(wallet, hash, controller.signal);
    });
    this.assertActive(controller);
    return signed;
  }

  /**
   * Resolve once the user approves exactly this transaction. Reviews run one
   * at a time, so an answer always belongs to the transaction on screen.
   */
  private async review(
    transaction: Transaction,
    network: NetworkInfo,
    action: WalletTransactionReview['action'],
    controller: AbortController
  ): Promise<void> {
    const reviewer = this.options.transactionReview;
    if (reviewer === 'none') return;
    const review = createTransactionReview(transaction, network, action);
    const previous = this.reviewQueue;
    let finished!: () => void;
    this.reviewQueue = new Promise<void>((resolve) => (finished = resolve));
    try {
      await previous;
      this.assertActive(controller);
      const approved =
        typeof reviewer === 'function'
          ? await this.untilAborted(controller.signal, () => reviewer(review, controller.signal))
          : await this.promptForApproval(review, controller.signal);
      this.assertActive(controller);
      // Anything but an explicit `true`, such as a forgotten return, rejects.
      if (approved !== true) throw createWalletError.signRejected();
    } finally {
      finished();
    }
  }

  private untilAborted<T>(signal: AbortSignal, operation: () => T | Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const onAbort = (): void => reject(createWalletError.notConnected());
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
      Promise.resolve()
        .then(operation)
        .then(resolve, reject)
        .finally(() => signal.removeEventListener('abort', onAbort));
    });
  }

  private promptForApproval(
    review: WalletTransactionReview,
    signal: AbortSignal
  ): Promise<boolean> {
    if (this.promptListeners.size === 0) {
      // Nothing can show the review or answer it, so the signature could never be approved.
      return Promise.reject(createWalletError.signFailed(new Error(NO_REVIEWER_MESSAGE)));
    }
    return new Promise<boolean>((resolve, reject) => {
      let settled = false;
      const settle = (outcome: boolean | Error): void => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        // Withdraw the prompt before answering, so the next review starts clean.
        this.emitPrompt(null);
        if (outcome instanceof Error) reject(outcome);
        else resolve(outcome);
      };
      const onAbort = (): void => settle(createWalletError.notConnected());
      signal.addEventListener('abort', onAbort, { once: true });
      this.emitPrompt(
        Object.freeze({
          title: 'Review transaction',
          description:
            review.action === 'signAndSubmit'
              ? 'Approving signs this transaction with your Privy wallet and submits it to the XRP Ledger.'
              : 'Approving signs this transaction with your Privy wallet. The app can then submit it to the XRP Ledger.',
          review,
          submitLabel: 'Approve',
          submit: async () => settle(true),
          cancel: () => settle(false),
        })
      );
    });
  }

  private emitPrompt(prompt: WalletAuthPrompt | null): void {
    for (const listener of [...this.promptListeners]) {
      try {
        listener(prompt);
      } catch {
        // Prompt observers are isolated from the signing operation.
      }
    }
  }

  private assertActive(controller: AbortController): void {
    if (this.controller !== controller || controller.signal.aborted) {
      throw createWalletError.notConnected();
    }
  }

  private copyAccount(account: AccountInfo): AccountInfo {
    return { ...account, network: { ...account.network } };
  }

  private async withClient<T>(
    network: NetworkInfo,
    operation: (client: Client) => Promise<T>
  ): Promise<T> {
    // Signatures tend to come in bursts, so one connection serves the session
    // and closes once it has been idle, instead of a handshake per signature.
    if (this.ledger && this.ledger.wss !== network.wss) this.releaseLedger();
    let ledger = this.ledger;
    if (!ledger) {
      const client = new Client(network.wss, { maxFeeXRP: MAX_FEE_XRP });
      ledger = { client, wss: network.wss, ready: client.connect(), users: 0 };
      ledger.ready.catch(() => undefined);
      this.ledger = ledger;
    }
    clearTimeout(ledger.idleTimer);
    ledger.users += 1;
    try {
      await ledger.ready;
      return await operation(ledger.client);
    } catch (error) {
      // The connection may be what failed; the next operation opens a new one.
      if (this.ledger === ledger) this.ledger = null;
      throw error;
    } finally {
      ledger.users -= 1;
      if (ledger.users === 0) {
        if (this.ledger === ledger) {
          ledger.idleTimer = setTimeout(() => this.releaseLedger(ledger), LEDGER_IDLE_MS);
        } else {
          this.closeLedger(ledger);
        }
      }
    }
  }

  /** Stop sharing a connection, closing it once no operation is using it. */
  private releaseLedger(ledger = this.ledger): void {
    if (!ledger) return;
    if (this.ledger === ledger) this.ledger = null;
    clearTimeout(ledger.idleTimer);
    if (ledger.users === 0) this.closeLedger(ledger);
  }

  private closeLedger(ledger: LedgerConnection): void {
    // Closing the socket must not replace an operation's outcome: a failed
    // close after a validated submission would invite a duplicate retry.
    void ledger.client.disconnect().catch(() => undefined);
  }
}

export class PrivyAdapter extends PrivyWalletAdapter {
  constructor(options: PrivyAdapterOptions) {
    super(options, new PrivySession(options));
  }
}
