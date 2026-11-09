import Privy, { create, getWallet, LocalStorage, rawSign } from '@privy-io/js-sdk-core';
import { createWalletError } from 'xrpl-connect';
import type {
  PrivyLoginMethod,
  PrivyOAuthProvider,
  PrivySessionOptions,
  PrivyWallet,
} from './session-types';

const DEFAULT_TIMEOUT_MS = 15_000;
const SESSION_CHECK_INTERVAL_MS = 60_000;
const OAUTH_MARKER_TTL_MS = 10 * 60_000;
const PENDING_MARKER_VERSION = 1;

type PrivyClient = InstanceType<typeof Privy>;

interface PendingConnectionMarker {
  version: typeof PENDING_MARKER_VERSION;
  appId: string;
  clientId: string | null;
  methodId: string;
  attemptId: string;
  expiresAt: number;
}

interface OAuthCallback {
  code?: string;
  state?: string;
  provider?: string;
  error?: string;
  errorDescription?: string;
}

interface EmbeddedXrplAccount {
  id: string;
  address: string;
  chain_type: 'xrpl';
  connector_type: 'embedded';
  type: 'wallet';
  wallet_client: 'privy';
  wallet_client_type: 'privy';
  user_can_sign: true;
  public_key?: string;
}

interface PrivyUser {
  id: string;
  linked_accounts: readonly unknown[];
}

interface IframeState {
  element: HTMLIFrameElement;
  onMessage: (event: MessageEvent) => void;
  onLoad: () => void;
  loaded: boolean;
  loadPromise: Promise<void>;
  resolveLoad: () => void;
  rejectLoad: (error: unknown) => void;
}

interface ConnectionAttempt {
  id: string;
  redirectReject?: (error: unknown) => void;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAuthenticationLoss(error: unknown): boolean {
  const record = asRecord(error);
  const status = record?.status;
  if (status === 401) return true;

  const code = record?.code ?? record?.privyErrorCode;
  if (typeof code === 'string') {
    return code === 'missing_or_invalid_token' || code === 'must_be_authenticated';
  }

  const message = errorMessage(error);
  return /not authenticated|not logged in|missing access token|session (?:has )?expired|unauthorized/i.test(
    message
  );
}

function normalizePublicKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const publicKey = value.replace(/^0x/i, '');
  return /^(?:02|03)[a-f0-9]{64}$/i.test(publicKey) ? publicKey.toUpperCase() : null;
}

function createAttemptId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  if (cryptoApi) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function hasOwnString(record: UnknownRecord, key: string): boolean {
  return typeof record[key] === 'string' && record[key] !== '';
}

function isEmbeddedXrplAccount(value: unknown): value is EmbeddedXrplAccount {
  const account = asRecord(value);
  return (
    account !== null &&
    hasOwnString(account, 'id') &&
    hasOwnString(account, 'address') &&
    account.type === 'wallet' &&
    account.chain_type === 'xrpl' &&
    account.connector_type === 'embedded' &&
    account.wallet_client === 'privy' &&
    account.wallet_client_type === 'privy' &&
    account.user_can_sign === true
  );
}

function isOAuthRejection(error: unknown): boolean {
  const record = asRecord(error);
  const code = record?.code ?? record?.privyErrorCode;
  if (typeof code === 'string') {
    return ['oauth_user_denied', 'access_denied', 'exited_auth_flow'].includes(code);
  }
  return /access_denied|user(?:_| )?(?:cancel|reject)|oauth.*(?:cancel|denied)|(?:cancel|denied).*oauth/i.test(
    errorMessage(error)
  );
}

function connectionRejected(
  error: unknown
): ReturnType<typeof createWalletError.connectionRejected> {
  return createWalletError.connectionRejected(
    'Privy',
    error instanceof Error ? error : new Error(errorMessage(error))
  );
}

function userFromResponse(value: unknown): PrivyUser {
  const response = asRecord(value);
  const candidate = asRecord(response?.user) ?? response;
  if (
    candidate === null ||
    typeof candidate.id !== 'string' ||
    candidate.id.length === 0 ||
    !Array.isArray(candidate.linked_accounts)
  ) {
    throw new Error('Privy did not return a valid authenticated user');
  }
  return { id: candidate.id, linked_accounts: candidate.linked_accounts };
}

function extractOAuthCallback(location: Location, redirectUri: URL): OAuthCallback | null {
  if (
    location.origin !== redirectUri.origin ||
    location.pathname !== redirectUri.pathname ||
    (redirectUri.hash !== '' && location.hash !== redirectUri.hash)
  ) {
    return null;
  }

  const locationURL = new URL(location.href);
  for (const [key, value] of redirectUri.searchParams) {
    if (locationURL.searchParams.get(key) !== value) return null;
  }

  const params = locationURL.searchParams;
  const code = params.get('privy_oauth_code') ?? undefined;
  const state = params.get('privy_oauth_state') ?? undefined;
  const provider = params.get('privy_oauth_provider') ?? undefined;
  const error = params.get('privy_oauth_error') ?? params.get('error') ?? undefined;
  const errorDescription =
    params.get('privy_oauth_error_description') ?? params.get('error_description') ?? undefined;
  return code || state || provider || error || errorDescription
    ? { code, state, provider, error, errorDescription }
    : null;
}

function clearOAuthCallback(location: Location): void {
  const url = new URL(location.href);
  for (const key of [
    'privy_oauth_code',
    'privy_oauth_state',
    'privy_oauth_provider',
    'privy_oauth_error',
    'privy_oauth_error_description',
    'code',
    'state',
    'error',
    'error_description',
    'error_uri',
    'scope',
  ]) {
    url.searchParams.delete(key);
  }
  if (url.href === location.href || typeof history === 'undefined') return;
  history.replaceState(history.state, '', url.href);
}

/**
 * Framework-independent browser session lifecycle for Privy's user-owned XRPL
 * embedded wallets.
 *
 * The client is deliberately created only when `connect` or `signHash` is
 * called. This keeps importing the package safe during SSR and leaves adapter
 * availability/configuration checks to the adapter.
 */
export class PrivySession {
  private readonly timeoutMs: number;
  private readonly markerKey: string;
  private readonly loginMethods: readonly PrivyLoginMethod[];
  private readonly sessionLostCallbacks = new Set<() => void>();

  private client: PrivyClient | undefined;
  private initializePromise: Promise<void> | undefined;
  private iframe: IframeState | undefined;
  private activeAttempt: ConnectionAttempt | undefined;
  private lifecycleGeneration = 0;
  private currentUserId: string | undefined;
  private currentWallet: PrivyWallet | undefined;
  private sessionLost = false;
  private sessionCheckTimer: ReturnType<typeof setInterval> | undefined;
  private visibilityListener: (() => void) | undefined;
  private pendingOAuthOperation: Promise<unknown> | undefined;
  private readonly pendingOperations = new Set<Promise<unknown>>();
  private disconnectPromise: Promise<void> | undefined;

  constructor(private readonly options: PrivySessionOptions) {
    this.timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.loginMethods = (options.loginMethods ?? []).slice();
    this.markerKey = `xrpl-connect:privy:pending:${options.appId}:${options.clientId ?? 'default'}`;
  }

  /**
   * Detect a callback that belongs to this configured Privy session.
   *
   * This method only reads the URL and marker; in particular it does not
   * remove expired markers or clean callback parameters.
   */
  hasPendingConnection(): boolean {
    const location = this.browserWindow()?.location;
    const redirectUri = this.redirectURL();
    if (!location || !redirectUri) return false;

    const marker = this.readPendingMarker();
    if (!marker || marker.expiresAt <= Date.now()) return false;
    const callback = extractOAuthCallback(location, redirectUri);
    return (
      callback !== null &&
      (typeof callback.error === 'string' ||
        (typeof callback.code === 'string' &&
          typeof callback.state === 'string' &&
          typeof callback.provider === 'string'))
    );
  }

  async connect(
    loginMethod: string | undefined,
    signal: AbortSignal,
    restore?: { walletId: string; userId: string }
  ): Promise<PrivyWallet> {
    await this.waitForDisconnect(signal);
    if (signal.aborted) throw createWalletError.notConnected();
    if (this.activeAttempt) throw createWalletError.alreadyConnected('Privy');
    if (restore && (!restore.walletId || !restore.userId)) {
      throw new Error('Restoring Privy requires both the wallet and user identity');
    }

    const attempt: ConnectionAttempt = {
      id: createAttemptId(),
    };
    const generation = this.lifecycleGeneration;
    this.activeAttempt = attempt;
    const onAbort = (): void => {
      this.lifecycleGeneration += 1;
      this.clearPendingMarker(attempt.id);
      attempt.redirectReject?.(createWalletError.notConnected());
    };
    signal.addEventListener('abort', onAbort, { once: true });

    try {
      const client = await this.ensureClient(signal, generation);
      const redirectUri = this.redirectURL();
      if (!redirectUri) throw new Error('Privy redirectUri must be an absolute browser URL');

      const callback = this.browserWindow()
        ? extractOAuthCallback(this.browserWindow()!.location, redirectUri)
        : null;
      const marker = this.readPendingMarker();
      const validMarker = marker && marker.expiresAt > Date.now() ? marker : null;

      if (!restore && callback && validMarker) {
        if (loginMethod !== undefined && loginMethod !== validMarker.methodId) {
          throw new Error('Privy OAuth callback belongs to a different login method');
        }
        const method = this.findLoginMethod(validMarker.methodId);
        if (!method || !('oauthProvider' in method)) {
          throw new Error('Privy OAuth callback uses an unknown or non-OAuth login method');
        }
        clearOAuthCallback(this.browserWindow()!.location);
        this.clearPendingMarker(validMarker.attemptId);
        if (callback.error || callback.errorDescription || !callback.code || !callback.state) {
          throw connectionRejected(
            new Error(
              callback.errorDescription ?? callback.error ?? 'Privy OAuth login was rejected'
            )
          );
        }
        if (callback.provider !== method.oauthProvider) {
          throw connectionRejected(
            new Error('Privy OAuth callback provider does not match the login method')
          );
        }
        let authenticated: unknown;
        try {
          authenticated = await this.runTrackedOAuth(
            () =>
              client.auth.oauth.loginWithCode(
                callback.code!,
                callback.state!,
                method.oauthProvider
              ),
            signal,
            generation,
            'Privy OAuth callback'
          );
        } catch (error) {
          if (isOAuthRejection(error)) throw connectionRejected(error);
          throw error;
        }
        const user = userFromResponse(authenticated);
        return await this.establishWallet(user, signal, generation, restore);
      }

      if (callback) {
        // A returning session never switches identity from a callback. Also,
        // a callback without our non-secret marker must never be consumed as a
        // login response. Remove its one-time parameters before continuing.
        clearOAuthCallback(this.browserWindow()!.location);
        if (validMarker) this.clearPendingMarker(validMarker.attemptId);
      }

      if (restore) {
        const user = await this.requireAuthenticatedUser(client, signal, generation);
        this.assertUserIdentity(user, restore.userId);
        return await this.establishWallet(user, signal, generation, restore);
      }

      const existingUser = await this.tryGetAuthenticatedUser(client, signal, generation);
      if (existingUser) {
        if (loginMethod !== undefined && !this.findLoginMethod(loginMethod)) {
          throw new Error(`Privy login method "${loginMethod}" is not configured`);
        }
        return await this.establishWallet(existingUser, signal, generation);
      }

      if (loginMethod === undefined) {
        throw new Error('Privy login method is required when no session is available');
      }
      const method = this.findLoginMethod(loginMethod);
      if (!method) throw new Error(`Privy login method "${loginMethod}" is not configured`);

      let user: PrivyUser;
      if ('getCustomToken' in method) {
        const token = await this.runOperation(
          () => method.getCustomToken(signal),
          signal,
          generation,
          'Privy custom-token login'
        );
        if (typeof token !== 'string' || token.trim() === '') {
          throw new Error('Privy custom-token login returned an empty token');
        }
        user = userFromResponse(
          await this.runTrackedOAuth(
            () => client.auth.customProvider.syncWithToken(token),
            signal,
            generation,
            'Privy custom-token login'
          )
        );
      } else {
        await this.beginOAuthRedirect(
          client,
          method.oauthProvider,
          method.id,
          attempt,
          signal,
          generation
        );
        this.assertGeneration(generation, signal);
        return await new Promise<PrivyWallet>((_resolve, reject) => {
          attempt.redirectReject = reject;
          if (signal.aborted) reject(createWalletError.notConnected());
        });
      }

      return await this.establishWallet(user, signal, generation);
    } finally {
      signal.removeEventListener('abort', onAbort);
      if (this.activeAttempt === attempt) this.activeAttempt = undefined;
    }
  }

  async signHash(wallet: PrivyWallet, hash: `0x${string}`, signal: AbortSignal): Promise<string> {
    if (signal.aborted) throw createWalletError.notConnected();
    const expectedGeneration = this.lifecycleGeneration;
    const client = await this.ensureClient(signal, expectedGeneration);
    if (
      !this.currentWallet ||
      this.currentWallet.id !== wallet.id ||
      this.currentWallet.userId !== wallet.userId ||
      this.currentWallet.address !== wallet.address
    ) {
      throw createWalletError.notConnected();
    }

    const user = await this.requireAuthenticatedUser(client, signal, expectedGeneration);
    this.assertUserIdentity(user, wallet.userId);
    const account = this.findOwnedXrplAccount(user, wallet.id);
    if (!account || account.address !== wallet.address) {
      throw new Error('Privy wallet is no longer owned by the authenticated user');
    }
    const current = await this.fetchWallet(client, account.id, signal, expectedGeneration);
    if (
      current.address !== wallet.address ||
      current.publicKey.toLowerCase() !== wallet.publicKey.toLowerCase()
    ) {
      throw new Error('Privy wallet identity changed while signing');
    }

    await this.ensureIframeReady(client, signal, expectedGeneration);
    const result = await this.runOperation(
      () =>
        rawSign(client, (request) => client.embeddedWallet.signWithUserSigner(request), {
          wallet_id: wallet.id,
          params: { hash },
        }),
      signal,
      expectedGeneration,
      'Privy hash signing'
    );
    if (result.data.encoding !== 'hex' || !/^0x[0-9a-f]+$/i.test(result.data.signature)) {
      throw new Error('Privy returned an invalid raw signature');
    }
    return result.data.signature;
  }

  async disconnect(): Promise<void> {
    if (this.disconnectPromise) {
      await this.settleWithin(this.disconnectPromise, this.timeoutMs);
      return;
    }
    this.lifecycleGeneration += 1;
    const attempt = this.activeAttempt;
    this.activeAttempt = undefined;
    if (attempt) {
      attempt.redirectReject?.(createWalletError.notConnected());
      attempt.redirectReject = undefined;
    }
    this.clearPendingMarker(attempt?.id);
    this.stopSessionMonitor();
    this.cleanupIframe();
    this.currentWallet = undefined;
    const userId = this.currentUserId;
    this.currentUserId = undefined;
    this.sessionLost = false;

    const cleanup = this.finishDisconnect(userId);
    this.disconnectPromise = cleanup;
    cleanup
      .finally(() => {
        if (this.disconnectPromise === cleanup) this.disconnectPromise = undefined;
      })
      .catch(() => undefined);
    await this.settleWithin(cleanup, this.timeoutMs);
  }

  onSessionLost(callback: () => void): () => void {
    this.sessionLostCallbacks.add(callback);
    return () => this.sessionLostCallbacks.delete(callback);
  }

  private browserWindow(): Window | undefined {
    return typeof window === 'undefined' ? undefined : window;
  }

  private redirectURL(): URL | null {
    try {
      return new URL(this.options.redirectUri);
    } catch {
      return null;
    }
  }

  private findLoginMethod(id: string): PrivyLoginMethod | undefined {
    return this.loginMethods.find((method) => method.id === id);
  }

  private readPendingMarker(): PendingConnectionMarker | null {
    const browser = this.browserWindow();
    if (!browser) return null;
    try {
      const value = browser.sessionStorage.getItem(this.markerKey);
      if (!value) return null;
      const parsed = JSON.parse(value) as UnknownRecord;
      if (
        parsed.version !== PENDING_MARKER_VERSION ||
        parsed.appId !== this.options.appId ||
        parsed.clientId !== (this.options.clientId ?? null) ||
        typeof parsed.methodId !== 'string' ||
        typeof parsed.attemptId !== 'string' ||
        typeof parsed.expiresAt !== 'number'
      ) {
        return null;
      }
      return parsed as unknown as PendingConnectionMarker;
    } catch {
      return null;
    }
  }

  private clearPendingMarker(attemptId?: string): void {
    const browser = this.browserWindow();
    if (!browser) return;
    try {
      const marker = this.readPendingMarker();
      if (attemptId !== undefined && marker && marker.attemptId !== attemptId) return;
      browser.sessionStorage.removeItem(this.markerKey);
    } catch {
      // Storage may be unavailable in a privacy-restricted browser context.
    }
  }

  private writePendingMarker(methodId: string, attemptId: string): void {
    const browser = this.browserWindow();
    if (!browser) throw new Error('Privy OAuth requires a browser window');
    const marker: PendingConnectionMarker = {
      version: PENDING_MARKER_VERSION,
      appId: this.options.appId,
      clientId: this.options.clientId ?? null,
      methodId,
      attemptId,
      expiresAt: Date.now() + Math.max(this.timeoutMs * 4, OAUTH_MARKER_TTL_MS),
    };
    try {
      browser.sessionStorage.setItem(this.markerKey, JSON.stringify(marker));
    } catch (error) {
      throw new Error(`Privy could not persist its OAuth callback marker: ${errorMessage(error)}`);
    }
  }

  private async ensureClient(signal: AbortSignal, generation: number): Promise<PrivyClient> {
    this.assertGeneration(generation, signal);
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw createWalletError.notAvailable('Privy');
    }
    if (!this.client) {
      this.client = new Privy({
        storage: new LocalStorage(),
        appId: this.options.appId,
        ...(this.options.clientId ? { clientId: this.options.clientId } : {}),
      });
    }
    if (!this.initializePromise) {
      const initialize = this.trackOperation(
        () => this.client!.initialize(),
        () => this.assertGeneration(generation, signal)
      );
      this.initializePromise = initialize.catch((error: unknown) => {
        this.initializePromise = undefined;
        throw error;
      });
    }
    await this.runOperation(
      () => this.initializePromise!,
      signal,
      generation,
      'Privy SDK initialization'
    );
    return this.client;
  }

  private async tryGetAuthenticatedUser(
    client: PrivyClient,
    signal: AbortSignal,
    generation: number
  ): Promise<PrivyUser | undefined> {
    const token = await this.runOperation(
      () => client.getAccessToken(),
      signal,
      generation,
      'Privy session check'
    );
    if (!token) return undefined;
    try {
      return userFromResponse(
        await this.runOperation(() => client.user.get(), signal, generation, 'Privy user restore')
      );
    } catch (error) {
      if (isAuthenticationLoss(error)) return undefined;
      throw error;
    }
  }

  private async requireAuthenticatedUser(
    client: PrivyClient,
    signal: AbortSignal,
    generation: number
  ): Promise<PrivyUser> {
    try {
      return userFromResponse(
        await this.runOperation(() => client.user.get(), signal, generation, 'Privy user restore')
      );
    } catch (error) {
      if (this.currentWallet && isAuthenticationLoss(error)) {
        await this.notifySessionLost();
        throw createWalletError.notConnected();
      }
      throw error;
    }
  }

  private assertUserIdentity(user: PrivyUser, expectedUserId: string): void {
    if (user.id !== expectedUserId) {
      throw new Error(`Privy authenticated user mismatch: expected "${expectedUserId}"`);
    }
  }

  private findOwnedXrplAccount(
    user: PrivyUser,
    expectedWalletId?: string
  ): EmbeddedXrplAccount | undefined {
    const accounts = user.linked_accounts.filter(isEmbeddedXrplAccount);
    return expectedWalletId
      ? accounts.find((account) => account.id === expectedWalletId)
      : accounts[0];
  }

  private async establishWallet(
    user: PrivyUser,
    signal: AbortSignal,
    generation: number,
    restore?: { walletId: string; userId: string }
  ): Promise<PrivyWallet> {
    if (restore) this.assertUserIdentity(user, restore.userId);
    this.assertGeneration(generation, signal);

    let account = this.findOwnedXrplAccount(user, restore?.walletId);
    await this.ensureIframeReady(this.client!, signal, generation);
    this.assertGeneration(generation, signal);
    if (restore && !account) {
      throw new Error(`Privy wallet "${restore.walletId}" is not owned by the authenticated user`);
    }

    if (!account) {
      if (restore) throw new Error(`Privy wallet "${restore.walletId}" was not found`);
      const created = await this.runOperation(
        () =>
          create(this.client!, {
            request: { chain_type: 'xrpl' },
            headers: {
              'privy-idempotency-key': `xrpl-connect:${this.options.appId}:${user.id}:xrpl`,
            },
          }),
        signal,
        generation,
        'Privy XRPL wallet creation'
      );
      if (typeof created.id !== 'string' || created.id.length === 0) {
        throw new Error('Privy did not return an XRPL wallet id');
      }
      const refreshed = userFromResponse(
        await this.runOperation(
          () => this.client!.user.refreshUser(),
          signal,
          generation,
          'Privy user refresh after wallet creation'
        )
      );
      this.assertUserIdentity(refreshed, user.id);
      account = this.findOwnedXrplAccount(refreshed, created.id);
      if (!account) {
        throw new Error(
          'Privy created an XRPL wallet that is not linked to the authenticated user'
        );
      }
      user = refreshed;
    }

    const wallet = await this.fetchWallet(this.client!, account.id, signal, generation);
    this.assertGeneration(generation, signal);
    if (wallet.address !== account.address) {
      throw new Error('Privy wallet address does not match the authenticated user account');
    }
    const accountPublicKey = normalizePublicKey(account.public_key);
    if (
      accountPublicKey !== null &&
      accountPublicKey.toLowerCase() !== wallet.publicKey.toLowerCase()
    ) {
      throw new Error('Privy wallet public key does not match the authenticated user account');
    }
    const result: PrivyWallet = {
      id: wallet.id,
      address: wallet.address,
      publicKey: wallet.publicKey,
      userId: user.id,
    };
    this.currentUserId = user.id;
    this.currentWallet = result;
    this.sessionLost = false;
    this.startSessionMonitor(result);
    return result;
  }

  private async fetchWallet(
    client: PrivyClient,
    walletId: string,
    signal: AbortSignal,
    generation: number
  ): Promise<{ id: string; address: string; publicKey: string }> {
    const wallet = await this.runOperation(
      () => getWallet(client, { wallet_id: walletId }),
      signal,
      generation,
      'Privy XRPL wallet lookup'
    );
    const response = asRecord(wallet);
    const publicKey = normalizePublicKey(response?.public_key);
    if (
      response === null ||
      response.id !== walletId ||
      response.chain_type !== 'xrpl' ||
      typeof response.address !== 'string' ||
      response.address.length === 0 ||
      publicKey === null
    ) {
      throw new Error('Privy did not return a valid embedded XRPL wallet');
    }
    return { id: walletId, address: response.address, publicKey };
  }

  private async beginOAuthRedirect(
    client: PrivyClient,
    provider: PrivyOAuthProvider,
    methodId: string,
    attempt: ConnectionAttempt,
    signal: AbortSignal,
    generation: number
  ): Promise<void> {
    const browser = this.browserWindow();
    if (!browser) throw createWalletError.notAvailable('Privy');
    const redirectUri = this.redirectURL();
    if (!redirectUri) throw new Error('Privy redirectUri must be an absolute browser URL');

    await this.waitForPreviousOAuthOperation(signal, generation);
    this.assertGeneration(generation, signal);
    this.writePendingMarker(methodId, attempt.id);
    try {
      const response = await this.runTrackedOAuth(
        () => client.auth.oauth.generateURL(provider, redirectUri.toString()),
        signal,
        generation,
        'Privy OAuth initialization'
      );
      const loginUrl = response.url;
      if (typeof loginUrl !== 'string' || !/^https?:\/\//i.test(loginUrl)) {
        throw new Error('Privy OAuth initialization did not return a login URL');
      }
      this.assertGeneration(generation, signal);
      browser.location.assign(loginUrl);
    } catch (error) {
      this.clearPendingMarker(attempt.id);
      if (isOAuthRejection(error)) throw connectionRejected(error);
      throw error;
    }
  }

  private async runTrackedOAuth<T>(
    operation: () => Promise<T>,
    signal: AbortSignal,
    generation: number,
    label: string
  ): Promise<T> {
    await this.waitForPreviousOAuthOperation(signal, generation);
    this.assertGeneration(generation, signal);
    const promise = this.trackOperation(operation, () => this.assertGeneration(generation, signal));
    this.pendingOAuthOperation = promise;
    promise.catch(() => undefined);
    promise
      .finally(() => {
        if (this.pendingOAuthOperation === promise) this.pendingOAuthOperation = undefined;
      })
      .catch(() => undefined);
    return await this.runOperation(() => promise, signal, generation, label);
  }

  private async waitForPreviousOAuthOperation(
    signal: AbortSignal,
    generation: number
  ): Promise<void> {
    const pending = this.pendingOAuthOperation;
    if (!pending) return;
    await this.runOperation(
      () => pending.then(() => undefined),
      signal,
      generation,
      'Privy OAuth cleanup'
    );
  }

  private async ensureIframeReady(
    client: PrivyClient,
    signal: AbortSignal,
    generation: number
  ): Promise<void> {
    const browser = this.browserWindow();
    if (!browser || typeof document === 'undefined') {
      throw createWalletError.notAvailable('Privy');
    }

    if (!this.iframe) {
      this.assertGeneration(generation, signal);
      const iframe = document.createElement('iframe');
      const iframeURL = client.embeddedWallet.getURL();
      this.assertGeneration(generation, signal);
      const parsed = new URL(iframeURL);
      if (!/^https?:$/.test(parsed.protocol))
        throw new Error('Privy embedded wallet URL is invalid');
      iframe.src = parsed.toString();
      iframe.title = 'Privy secure embedded wallet';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.hidden = true;

      const onMessage = (event: MessageEvent): void => {
        if (event.origin !== parsed.origin || event.source !== iframe.contentWindow) return;
        let message: unknown = event.data;
        if (typeof message === 'string') {
          try {
            message = JSON.parse(message) as unknown;
          } catch {
            return;
          }
        }
        const data = asRecord(message);
        if (!data || typeof data.id !== 'string' || typeof data.event !== 'string') return;
        try {
          client.embeddedWallet.onMessage(
            message as Parameters<typeof client.embeddedWallet.onMessage>[0]
          );
        } catch {
          // The SDK owns response correlation and rejects the matching request.
          // Invalid unsolicited messages are ignored by this boundary.
        }
      };
      const parent = document.body ?? document.documentElement;
      if (!parent) {
        throw new Error('Privy requires a document root for its secure iframe');
      }
      let iframeState!: IframeState;
      const resetLoadWaiter = (): void => {
        iframeState.loaded = false;
        iframeState.loadPromise = new Promise<void>((resolve, reject) => {
          iframeState.resolveLoad = resolve;
          iframeState.rejectLoad = reject;
        });
        iframeState.loadPromise.catch(() => undefined);
      };
      const onLoad = (): void => {
        iframeState.loaded = true;
        iframeState.resolveLoad();
      };
      iframeState = {
        element: iframe,
        onMessage,
        onLoad,
        loaded: false,
        loadPromise: Promise.resolve(),
        resolveLoad: () => undefined,
        rejectLoad: () => undefined,
      };
      resetLoadWaiter();
      this.assertGeneration(generation, signal);
      this.iframe = iframeState;
      try {
        browser.addEventListener('message', onMessage);
        iframe.addEventListener('load', onLoad);
        this.assertGeneration(generation, signal);
        parent.appendChild(iframe);
        client.setMessagePoster({
          postMessage: (
            message: unknown,
            targetOrigin: string,
            transfer?: Transferable | Transferable[]
          ) => {
            if (!iframe.contentWindow)
              throw new Error('Privy embedded wallet iframe is unavailable');
            if (targetOrigin !== '*' && targetOrigin !== parsed.origin) {
              throw new Error('Privy embedded wallet message origin is invalid');
            }
            const transferList = transfer
              ? Array.isArray(transfer)
                ? transfer
                : [transfer]
              : undefined;
            iframe.contentWindow.postMessage(message, parsed.origin, transferList);
          },
          reload: () => {
            if (this.iframe !== iframeState) return;
            try {
              resetLoadWaiter();
              iframe.src = parsed.toString();
            } catch (error) {
              this.cleanupIframe();
              throw error;
            }
          },
        });
      } catch (error) {
        this.cleanupIframe();
        throw error;
      }
    }

    const iframe = this.iframe;
    if (!iframe) throw createWalletError.notConnected();
    try {
      if (!iframe.loaded) {
        await this.runOperation(
          () => iframe.loadPromise,
          signal,
          generation,
          'Privy embedded wallet iframe load'
        );
      }
      this.assertGeneration(generation, signal);
      const ready = await this.runOperation(
        () => client.embeddedWallet.ping(this.timeoutMs),
        signal,
        generation,
        'Privy embedded wallet readiness'
      );
      if (!ready) throw createWalletError.operationTimeout('Privy embedded wallet readiness');
    } catch (error) {
      if (this.iframe === iframe) this.cleanupIframe();
      throw error;
    }
  }

  private cleanupIframe(): void {
    const browser = this.browserWindow();
    const iframe = this.iframe;
    this.iframe = undefined;
    if (!iframe) return;
    browser?.removeEventListener('message', iframe.onMessage);
    iframe.element.removeEventListener('load', iframe.onLoad);
    iframe.rejectLoad(createWalletError.notConnected());
    iframe.element.remove();
  }

  private startSessionMonitor(wallet: PrivyWallet): void {
    this.stopSessionMonitor();
    const browser = this.browserWindow();
    if (!browser || typeof document === 'undefined') return;
    const check = (): void => {
      if (document.visibilityState === 'hidden') return;
      void this.checkSession(wallet);
    };
    this.visibilityListener = check;
    document.addEventListener('visibilitychange', check);
    this.sessionCheckTimer = setInterval(check, SESSION_CHECK_INTERVAL_MS);
  }

  private stopSessionMonitor(): void {
    if (this.sessionCheckTimer !== undefined) clearInterval(this.sessionCheckTimer);
    this.sessionCheckTimer = undefined;
    if (this.visibilityListener && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
    }
    this.visibilityListener = undefined;
  }

  private async checkSession(wallet: PrivyWallet): Promise<void> {
    if (!this.client || this.currentWallet?.id !== wallet.id || this.sessionLost) return;
    const generation = this.lifecycleGeneration;
    try {
      const token = await this.trackOperation(
        () => this.client!.getAccessToken(),
        () => {
          if (generation !== this.lifecycleGeneration) throw createWalletError.notConnected();
        }
      );
      if (generation !== this.lifecycleGeneration || this.currentWallet?.id !== wallet.id) return;
      if (!token) {
        await this.notifySessionLost();
        return;
      }
      const user = userFromResponse(
        await this.trackOperation(
          () => this.client!.user.refreshUser(),
          () => {
            if (generation !== this.lifecycleGeneration) throw createWalletError.notConnected();
          }
        )
      );
      if (generation !== this.lifecycleGeneration || this.currentWallet?.id !== wallet.id) return;
      if (
        user.id !== wallet.userId ||
        !this.findOwnedXrplAccount(user, wallet.id) ||
        !this.currentWallet ||
        this.currentWallet.address !== wallet.address
      ) {
        await this.notifySessionLost();
      }
    } catch (error) {
      if (
        generation === this.lifecycleGeneration &&
        this.currentWallet?.id === wallet.id &&
        isAuthenticationLoss(error)
      ) {
        await this.notifySessionLost();
      }
      // Network and transient iframe errors do not invalidate a user session.
    }
  }

  private async notifySessionLost(): Promise<void> {
    if (this.sessionLost) return;
    this.sessionLost = true;
    this.lifecycleGeneration += 1;
    this.currentWallet = undefined;
    this.currentUserId = undefined;
    this.stopSessionMonitor();
    this.cleanupIframe();
    for (const callback of this.sessionLostCallbacks) {
      try {
        callback();
      } catch {
        // A consumer callback must not break session-loss monitoring.
      }
    }
  }

  private assertGeneration(generation: number, signal: AbortSignal): void {
    if (signal.aborted || generation !== this.lifecycleGeneration) {
      throw createWalletError.notConnected();
    }
  }

  private async runOperation<T>(
    operation: () => Promise<T>,
    signal: AbortSignal,
    generation: number,
    label: string
  ): Promise<T> {
    this.assertGeneration(generation, signal);
    const request = this.trackOperation(operation, () => this.assertGeneration(generation, signal));
    let abortHandler: (() => void) | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    const aborted = new Promise<never>((_, reject) => {
      abortHandler = () => reject(createWalletError.notConnected());
      signal.addEventListener('abort', abortHandler, { once: true });
      if (signal.aborted) abortHandler();
    });
    try {
      const timedOut = new Promise<never>((_, reject) => {
        timeoutTimer = setTimeout(
          () => reject(createWalletError.operationTimeout(label)),
          this.timeoutMs
        );
      });
      const value = await Promise.race([request, aborted, timedOut]);
      this.assertGeneration(generation, signal);
      return value;
    } finally {
      if (abortHandler) signal.removeEventListener('abort', abortHandler);
      if (timeoutTimer !== undefined) clearTimeout(timeoutTimer);
    }
  }

  private async settleWithin(promise: Promise<unknown>, timeoutMs: number): Promise<void> {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      promise.then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        () => {
          clearTimeout(timer);
          resolve();
        }
      );
    });
  }

  private async finishDisconnect(userId: string | undefined): Promise<void> {
    await this.waitForPendingOperations();
    if (!this.client) return;
    try {
      await this.client.auth.logout(userId ? { userId } : undefined);
    } catch {
      // Local iframe/session state is already cleaned; logout failures are
      // isolated after every prior SDK operation has settled.
    }
  }

  private async waitForPendingOperations(): Promise<void> {
    while (this.pendingOperations.size > 0) {
      await Promise.allSettled([...this.pendingOperations]);
    }
  }

  private async waitForDisconnect(signal: AbortSignal): Promise<void> {
    const cleanup = this.disconnectPromise;
    if (!cleanup) return;

    let abortHandler: (() => void) | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    const aborted = new Promise<never>((_, reject) => {
      abortHandler = () => reject(createWalletError.notConnected());
      signal.addEventListener('abort', abortHandler, { once: true });
      if (signal.aborted) abortHandler();
    });
    const timedOut = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(
        () => reject(createWalletError.operationTimeout('Privy disconnect cleanup')),
        this.timeoutMs
      );
    });
    try {
      await Promise.race([cleanup, aborted, timedOut]);
    } finally {
      if (abortHandler) signal.removeEventListener('abort', abortHandler);
      if (timeoutTimer !== undefined) clearTimeout(timeoutTimer);
    }
  }

  private trackOperation<T>(operation: () => Promise<T>, beforeStart?: () => void): Promise<T> {
    const request = Promise.resolve().then(() => {
      beforeStart?.();
      return operation();
    });
    this.pendingOperations.add(request);
    request.finally(() => this.pendingOperations.delete(request)).catch(() => undefined);
    request.catch(() => undefined);
    return request;
  }
}
