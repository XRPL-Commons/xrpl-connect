import { Client } from 'xrpl';
import {
  createWalletError,
  isStandardNetworkId,
  isWalletError,
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
  type WalletLoginMethod,
} from 'xrpl-connect';
import { PrivySession } from './session';
import { PRIVY_ATTRIBUTION, PRIVY_SYMBOL } from './branding';
import type { PrivySessionOptions, PrivyWallet } from './session-types';
import { prepareSigningInput, signPreparedTransaction, validateWallet } from './signing';

export type PrivyAdapterOptions = PrivySessionOptions;

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

export class PrivyAdapter implements WalletAdapter {
  readonly id = 'privy';
  readonly name = 'Privy';
  readonly icon = PRIVY_SYMBOL;
  readonly loginBranding = { label: 'Protected by Privy', logo: PRIVY_ATTRIBUTION } as const;
  readonly url = 'https://privy.io';
  readonly capabilities = { sign: true, signAndSubmit: true, signMessage: false } as const;

  private readonly session: PrivySession;
  private readonly listeners = new Map<WalletAdapterEvent, Set<(data: unknown) => void>>();
  private readonly authPromptListeners = new Set<(prompt: WalletAuthPrompt | null) => void>();
  private controller: AbortController | null = null;
  private wallet: PrivyWallet | null = null;
  private account: AccountInfo | null = null;
  private teardown: Promise<void> | null = null;

  constructor(private readonly options: PrivyAdapterOptions) {
    this.session = new PrivySession(options);
    this.session.onAuthPrompt?.((prompt) => {
      for (const callback of this.authPromptListeners) callback(prompt);
    });
    this.session.onSessionLost(() => {
      const connected = this.account !== null;
      this.controller?.abort();
      this.controller = null;
      this.account = null;
      this.wallet = null;
      if (connected) this.emit('disconnect');
    });
  }

  getMissingConfiguration(): readonly string[] {
    const missing: string[] = [];
    if (!this.options.appId?.trim()) missing.push('appId');
    if (!this.options.redirectUri?.trim()) missing.push('redirectUri');
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
    this.authPromptListeners.add(callback);
    return () => this.authPromptListeners.delete(callback);
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
        await this.disconnect();
      }
      if (cancelled) throw createWalletError.notConnected();
      if (isWalletError(error)) throw error;
      throw createWalletError.connectionFailed(this.name, asError(error));
    }
  }

  async disconnect(): Promise<void> {
    const connected = this.account !== null;
    this.controller?.abort();
    this.controller = null;
    this.wallet = null;
    this.account = null;
    if (this.teardown) return this.teardown;
    const teardown = this.session.disconnect();
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
      if (input.Fee !== undefined && input.Sequence !== undefined) {
        return await this.signPrepared(input, wallet, controller);
      }
      return await this.withClient(account.network, async (client) => {
        this.assertActive(controller);
        return this.signPrepared(await client.autofill(input), wallet, controller);
      });
    } catch (error) {
      if (isWalletError(error)) throw error;
      throw createWalletError.signFailed(asError(error));
    }
  }

  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    try {
      const { wallet, account, controller } = this.signingContext();
      const input = prepareSigningInput(transaction, wallet);
      return await this.withClient(account.network, async (client) => {
        this.assertActive(controller);
        // submitAndWait requires a ledger bound, even when Fee and Sequence are supplied.
        const prepared = await client.autofill(input);
        const signed = await this.signPrepared(prepared, wallet, controller);
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

  private async signPrepared(
    transaction: Transaction,
    wallet: PrivyWallet,
    controller: AbortController
  ): Promise<SignedTransaction> {
    this.assertActive(controller);
    const signed = await signPreparedTransaction(transaction, wallet, (hash) => {
      this.assertActive(controller);
      return this.session.signHash(wallet, hash, controller.signal);
    });
    this.assertActive(controller);
    return signed;
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
    const client = new Client(network.wss);
    try {
      await client.connect();
      return await operation(client);
    } finally {
      await client.disconnect();
    }
  }
}
