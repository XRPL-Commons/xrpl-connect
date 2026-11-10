import Privy, { create, getWallet, LocalStorage, rawSign } from '@privy-io/js-sdk-core';
import { AppConfig } from '@privy-io/routes';
import { createWalletError, type WalletAuthPrompt, type WalletLoginMethod } from 'xrpl-connect';
import { resolveLoginIcon } from './login-icons';
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
const FARCASTER_POLL_INTERVAL_MS = 1_000;
const FARCASTER_POLL_TIMEOUT_MS = 10 * 60_000;

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

interface DashboardCustomOAuthProvider {
  enabled?: boolean;
  provider?: string;
  provider_display_name?: string;
  provider_icon_url?: string;
}

/** Public fields returned by the typed Privy AppConfig route. */
interface DashboardConfig {
  apple_oauth?: boolean;
  captcha_enabled?: boolean;
  captcha_site_key?: string;
  custom_oauth_providers?: readonly DashboardCustomOAuthProvider[];
  discord_oauth?: boolean;
  email_auth?: boolean;
  enabled_captcha_provider?: 'turnstile' | 'hcaptcha' | null;
  farcaster_auth?: boolean;
  github_oauth?: boolean;
  google_oauth?: boolean;
  guest_auth?: boolean;
  instagram_oauth?: boolean;
  line_oauth?: boolean;
  linkedin_oauth?: boolean;
  passkey_auth?: boolean;
  passkeys_for_signup_enabled?: boolean;
  sms_auth?: boolean;
  spotify_oauth?: boolean;
  telegram_auth?: boolean;
  telegram_auth_config?: { seamless_auth_enabled?: boolean };
  telegram_seamless_auth_enabled?: boolean;
  telegram_oauth?: boolean;
  tiktok_oauth?: boolean;
  twitch_oauth?: boolean;
  twitter_oauth?: boolean;
  wallet_auth?: boolean;
  external_wallets_for_signup_enabled?: boolean;
  whatsapp_enabled?: boolean;
}

type DashboardMethodKind =
  | 'email'
  | 'phone'
  | 'oauth'
  | 'passkey'
  | 'farcaster'
  | 'guest'
  | 'telegram-native'
  | 'custom-token';

interface ResolvedLoginMethod {
  id: string;
  label: string;
  icon?: string;
  kind: DashboardMethodKind;
  oauthProvider?: string;
  explicit?: PrivyLoginMethod;
}

interface PromptControls<T> {
  step(): PromptStep;
  show(prompt: WalletAuthPrompt, step: PromptStep): void;
  run<R>(step: PromptStep, operation: () => Promise<R>): Promise<R>;
  complete(value: T): void;
  fail(error: unknown): void;
  cancel(step: PromptStep): void;
  isActive(step?: PromptStep): boolean;
}

interface PromptStep {
  active: boolean;
  signal: AbortSignal;
  controller: AbortController;
}

interface PasskeyCredentialLike {
  id: string;
  rawId: ArrayBuffer;
  type: string;
  response: {
    clientDataJSON: ArrayBuffer;
    authenticatorData?: ArrayBuffer;
    signature?: ArrayBuffer;
    userHandle?: ArrayBuffer | null;
    attestationObject?: ArrayBuffer;
    getTransports?: () => string[];
  };
  getClientExtensionResults(): Record<string, unknown>;
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

const DASHBOARD_OAUTH_METHODS: ReadonlyArray<{
  provider: PrivyOAuthProvider;
  label: string;
  enabled: keyof DashboardConfig;
}> = [
  { provider: 'google', label: 'Google', enabled: 'google_oauth' },
  { provider: 'github', label: 'GitHub', enabled: 'github_oauth' },
  { provider: 'discord', label: 'Discord', enabled: 'discord_oauth' },
  { provider: 'twitter', label: 'X', enabled: 'twitter_oauth' },
  { provider: 'spotify', label: 'Spotify', enabled: 'spotify_oauth' },
  { provider: 'instagram', label: 'Instagram', enabled: 'instagram_oauth' },
  { provider: 'tiktok', label: 'TikTok', enabled: 'tiktok_oauth' },
  { provider: 'linkedin', label: 'LinkedIn', enabled: 'linkedin_oauth' },
  { provider: 'apple', label: 'Apple', enabled: 'apple_oauth' },
  { provider: 'line', label: 'LINE', enabled: 'line_oauth' },
  { provider: 'twitch', label: 'Twitch', enabled: 'twitch_oauth' },
  { provider: 'telegram', label: 'Telegram', enabled: 'telegram_oauth' },
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function dashboardMethodToPublic(method: ResolvedLoginMethod): WalletLoginMethod {
  return {
    id: method.id,
    label: method.label,
    connectOptions: { loginMethod: method.id },
    icon: resolveLoginIcon(method),
  };
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  if (typeof atob !== 'function') throw new Error('Privy passkeys require browser base64 support');
  const decoded = atob(normalized);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

function bytesToBase64Url(value: ArrayBuffer | ArrayBufferView): string {
  if (typeof btoa !== 'function') throw new Error('Privy passkeys require browser base64 support');
  const bytes =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function passkeyExtensions(value: unknown): AuthenticationExtensionsClientInputs | undefined {
  const extensions = asRecord(value);
  if (!extensions) return undefined;

  const result: AuthenticationExtensionsClientInputs = {};
  if (isNonEmptyString(extensions.app_id)) result.appid = extensions.app_id;
  if (typeof extensions.cred_props === 'boolean') {
    result.credProps = extensions.cred_props;
  } else if (extensions.cred_props !== undefined && extensions.cred_props !== null) {
    // Registration responses describe cred_props as an object, while the
    // browser input is the boolean request flag.
    result.credProps = true;
  }
  if (typeof extensions.hmac_create_secret === 'boolean') {
    result.hmacCreateSecret = extensions.hmac_create_secret;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function passkeyCredentialDescriptors(value: unknown): PublicKeyCredentialDescriptor[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((entry) => {
    const descriptor = asRecord(entry);
    if (!descriptor || !isNonEmptyString(descriptor.id) || descriptor.type !== 'public-key')
      return [];
    const transports = Array.isArray(descriptor.transports)
      ? descriptor.transports
          .filter(isNonEmptyString)
          .map((transport) => transport as AuthenticatorTransport)
      : undefined;
    return [
      {
        id: base64UrlToBytes(descriptor.id) as unknown as ArrayBuffer,
        type: 'public-key' as const,
        ...(transports && transports.length > 0 ? { transports } : {}),
      },
    ];
  });
}

function asPasskeyCredential(value: Credential | null): PasskeyCredentialLike {
  const credential = value as unknown as PasskeyCredentialLike | null;
  if (
    !credential ||
    !isNonEmptyString(credential.id) ||
    !isNonEmptyString(credential.type) ||
    !(credential.rawId instanceof ArrayBuffer) ||
    !credential.response ||
    typeof credential.getClientExtensionResults !== 'function'
  ) {
    throw new Error('Privy did not receive a valid browser passkey credential');
  }
  return credential;
}

function toAuthenticationResponse(credential: PasskeyCredentialLike): Record<string, unknown> {
  const response = credential.response;
  if (
    !(response.authenticatorData instanceof ArrayBuffer) ||
    !(response.signature instanceof ArrayBuffer)
  ) {
    throw new Error('Privy passkey authentication response is incomplete');
  }
  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      authenticatorData: bytesToBase64Url(response.authenticatorData),
      signature: bytesToBase64Url(response.signature),
      userHandle: response.userHandle ? bytesToBase64Url(response.userHandle) : null,
    },
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

function toRegistrationResponse(credential: PasskeyCredentialLike): Record<string, unknown> {
  const response = credential.response;
  if (!(response.attestationObject instanceof ArrayBuffer)) {
    throw new Error('Privy passkey registration response is incomplete');
  }
  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      attestationObject: bytesToBase64Url(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
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
  private readonly authPromptCallbacks = new Set<(prompt: WalletAuthPrompt | null) => void>();

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
  private activePromptReject: (() => void) | undefined;

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

  /**
   * Read the public dashboard configuration on every call. `app.getConfig()` is
   * intentionally not used here: the SDK caches that value for its own
   * internal consumers, while a picker must reflect a dashboard change made
   * after this client was initialized.
   */
  async getLoginMethods(): Promise<readonly WalletLoginMethod[]> {
    const signal = new AbortController().signal;
    const generation = this.lifecycleGeneration;
    await this.waitForDisconnect(signal);
    this.assertGeneration(generation, signal);
    const client = await this.ensureClient(signal, generation);
    const config = await this.fetchDashboardConfig(client, signal, generation);
    this.assertGeneration(generation, signal);
    return this.resolveLoginMethods(config).map(dashboardMethodToPublic);
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
        let method = this.resolveExplicitLoginMethod(validMarker.methodId);
        if (!method) {
          const config = await this.fetchDashboardConfig(client, signal, generation);
          method = this.resolveLoginMethod(validMarker.methodId, config);
        }
        if (!method || method.kind !== 'oauth' || !method.oauthProvider) {
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
                method.oauthProvider as PrivyOAuthProvider
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
        return await this.establishWallet(existingUser, signal, generation);
      }

      if (loginMethod === undefined) {
        throw new Error('Privy login method is required when no session is available');
      }
      let dashboardConfig: DashboardConfig | undefined;
      let method = this.resolveExplicitLoginMethod(loginMethod);
      if (!method) {
        dashboardConfig = await this.fetchDashboardConfig(client, signal, generation);
        method = this.resolveLoginMethod(loginMethod, dashboardConfig);
      }
      if (!method) throw new Error(`Privy login method "${loginMethod}" is not configured`);

      let user: PrivyUser;
      const explicit = method.explicit;
      if (method.kind === 'custom-token' && explicit && 'getCustomToken' in explicit) {
        const token = await this.runOperation(
          () => explicit.getCustomToken(signal),
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
      } else if (method.kind === 'oauth' && method.oauthProvider) {
        await this.beginOAuthRedirect(
          client,
          method.oauthProvider as PrivyOAuthProvider,
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
      } else {
        if (!dashboardConfig) {
          dashboardConfig = await this.fetchDashboardConfig(client, signal, generation);
        }
        user = await this.authenticateMethod(client, method, dashboardConfig, signal, generation);
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
    this.activePromptReject?.();
    this.activePromptReject = undefined;
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

  onAuthPrompt(callback: (prompt: WalletAuthPrompt | null) => void): () => void {
    this.authPromptCallbacks.add(callback);
    return () => this.authPromptCallbacks.delete(callback);
  }

  private browserWindow(): Window | undefined {
    return typeof window === 'undefined' ? undefined : window;
  }

  private telegramWebAppData(): Record<string, unknown> | undefined {
    const browser = this.browserWindow();
    const telegram = asRecord((browser as unknown as UnknownRecord | undefined)?.Telegram);
    const webApp = asRecord(telegram?.WebApp);
    const initData = webApp?.initData;
    if (!isNonEmptyString(initData)) return undefined;
    const params = new URLSearchParams(initData);
    const result: Record<string, unknown> = {};
    for (const [key, value] of params) result[key] = key === 'auth_date' ? Number(value) : value;
    return isNonEmptyString(result.hash) &&
      typeof result.auth_date === 'number' &&
      isNonEmptyString(result.user)
      ? result
      : undefined;
  }

  private redirectURL(): URL | null {
    try {
      return new URL(this.options.redirectUri);
    } catch {
      return null;
    }
  }

  private resolveExplicitLoginMethod(id: string): ResolvedLoginMethod | undefined {
    const method = this.loginMethods.find((candidate) => candidate.id === id);
    if (!method) return undefined;
    if ('getCustomToken' in method) {
      return { id: method.id, label: method.id, kind: 'custom-token', explicit: method };
    }
    return {
      id: method.id,
      label: method.id,
      kind: 'oauth',
      oauthProvider: method.oauthProvider,
      explicit: method,
    };
  }

  private resolveLoginMethods(config: DashboardConfig): ResolvedLoginMethod[] {
    const methods = new Map<string, ResolvedLoginMethod>();
    const add = (method: ResolvedLoginMethod): void => {
      if (!methods.has(method.id)) methods.set(method.id, method);
    };

    if (config.email_auth) add({ id: 'email', label: 'Email', kind: 'email' });
    if (config.sms_auth || config.whatsapp_enabled) {
      add({
        id: 'phone',
        label: config.whatsapp_enabled ? 'WhatsApp' : 'Phone',
        icon: config.whatsapp_enabled
          ? resolveLoginIcon({ kind: 'oauth', oauthProvider: 'whatsapp' })
          : undefined,
        kind: 'phone',
      });
    }
    for (const oauth of DASHBOARD_OAUTH_METHODS) {
      if (config[oauth.enabled] === true) {
        add({
          id: oauth.provider,
          label: oauth.label,
          kind: 'oauth',
          oauthProvider: oauth.provider,
        });
      }
    }
    if (config.passkey_auth || config.passkeys_for_signup_enabled) {
      add({ id: 'passkey', label: 'Passkey', kind: 'passkey' });
    }
    if (config.farcaster_auth) add({ id: 'farcaster', label: 'Farcaster', kind: 'farcaster' });
    if (config.guest_auth) add({ id: 'guest', label: 'Guest', kind: 'guest' });

    // Native Telegram authentication is only exposed when the page is hosted
    // by Telegram and has its signed launch data. The ordinary dashboard OAuth
    // method remains available independently.
    const telegramSeamless =
      config.telegram_auth_config?.seamless_auth_enabled ??
      config.telegram_seamless_auth_enabled ??
      false;
    if (config.telegram_auth && telegramSeamless && this.telegramWebAppData()) {
      add({ id: 'telegram-native', label: 'Telegram', kind: 'telegram-native' });
    }

    for (const provider of config.custom_oauth_providers ?? []) {
      if (!provider.enabled || !isNonEmptyString(provider.provider)) continue;
      if (!provider.provider.startsWith('custom:')) continue;
      methods.set(provider.provider, {
        id: provider.provider,
        label: isNonEmptyString(provider.provider_display_name)
          ? provider.provider_display_name
          : provider.provider,
        icon: isNonEmptyString(provider.provider_icon_url) ? provider.provider_icon_url : undefined,
        kind: 'oauth',
        oauthProvider: provider.provider,
      });
    }

    // Explicit methods are extensions, but an explicit id is authoritative.
    for (const method of this.loginMethods) {
      const explicit = this.resolveExplicitLoginMethod(method.id);
      if (explicit) methods.set(method.id, explicit);
    }
    return [...methods.values()];
  }

  private resolveLoginMethod(id: string, config: DashboardConfig): ResolvedLoginMethod | undefined {
    return this.resolveLoginMethods(config).find((method) => method.id === id);
  }

  private async fetchDashboardConfig(
    client: PrivyClient,
    signal: AbortSignal,
    generation: number
  ): Promise<DashboardConfig> {
    const response = await this.runOperation(
      () =>
        client.fetchPrivyRoute(AppConfig, {
          params: { app_id: this.options.appId },
          // The public endpoint is browser-cacheable for five minutes; the SDK
          // exposes query parameters, but no RequestInit cache option.
          query: { xrpl_connect_config: createAttemptId() },
          signal,
        }),
      signal,
      generation,
      'Privy dashboard configuration'
    );
    const config = asRecord(response);
    if (!config) throw new Error('Privy did not return a valid public app configuration');
    return config as DashboardConfig;
  }

  private emitAuthPrompt(prompt: WalletAuthPrompt | null): void {
    for (const callback of this.authPromptCallbacks) {
      try {
        callback(prompt);
      } catch {
        // UI observers are isolated from the authentication operation.
      }
    }
  }

  private async waitForPrompt<T>(
    factory: (controls: PromptControls<T>) => WalletAuthPrompt,
    signal: AbortSignal,
    generation: number
  ): Promise<T> {
    this.assertGeneration(generation, signal);
    let settled = false;
    let currentStep: PromptStep | undefined;
    let actionQueue = Promise.resolve();
    let resolveResult!: (value: T) => void;
    let rejectResult!: (error: unknown) => void;
    const result = new Promise<T>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    const staleStep = (): ReturnType<typeof createWalletError.notConnected> =>
      createWalletError.notConnected();
    const isActiveStep = (step: PromptStep): boolean =>
      !settled &&
      step.active &&
      !step.signal.aborted &&
      currentStep === step &&
      !signal.aborted &&
      generation === this.lifecycleGeneration;
    const controls: PromptControls<T> = {
      step: () => {
        if (currentStep) {
          currentStep.active = false;
          currentStep.controller.abort();
        }
        const controller = new AbortController();
        const step: PromptStep = { active: !settled, signal: controller.signal, controller };
        currentStep = step;
        return step;
      },
      show: (prompt, step) => {
        if (!isActiveStep(step)) return;
        this.assertGeneration(generation, signal);
        this.emitAuthPrompt(prompt);
      },
      run: async <R>(step: PromptStep, operation: () => Promise<R>): Promise<R> => {
        if (!isActiveStep(step)) throw staleStep();
        const request = actionQueue.then(async () => {
          if (!isActiveStep(step)) throw staleStep();
          return await operation();
        });
        actionQueue = request.then(
          () => undefined,
          () => undefined
        );
        return await request;
      },
      complete: (value) => {
        if (settled) return;
        settled = true;
        if (currentStep) {
          currentStep.active = false;
          currentStep.controller.abort();
        }
        resolveResult(value);
      },
      fail: (error) => {
        if (settled) return;
        settled = true;
        if (currentStep) {
          currentStep.active = false;
          currentStep.controller.abort();
        }
        rejectResult(error);
      },
      cancel: (step) => {
        if (!isActiveStep(step)) return;
        settled = true;
        step.active = false;
        step.controller.abort();
        rejectResult(connectionRejected(new Error('Privy authentication was cancelled')));
      },
      isActive: (step) =>
        step
          ? isActiveStep(step)
          : !settled && !signal.aborted && generation === this.lifecycleGeneration,
    };
    const rejectForDisconnect = (): void => controls.fail(createWalletError.notConnected());
    this.activePromptReject = rejectForDisconnect;
    const onAbort = (): void => controls.fail(createWalletError.notConnected());
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      const prompt = factory(controls);
      if (currentStep && isActiveStep(currentStep)) this.emitAuthPrompt(prompt);
      if (signal.aborted) controls.fail(createWalletError.notConnected());
      return await result;
    } finally {
      signal.removeEventListener('abort', onAbort);
      if (this.activePromptReject === rejectForDisconnect) this.activePromptReject = undefined;
      this.emitAuthPrompt(null);
    }
  }

  private captchaForConfig(config: DashboardConfig): WalletAuthPrompt['captcha'] {
    if (!config.captcha_enabled) return undefined;
    const provider = config.enabled_captcha_provider;
    const siteKey = config.captcha_site_key;
    if ((provider !== 'turnstile' && provider !== 'hcaptcha') || !isNonEmptyString(siteKey)) {
      throw new Error(
        'Privy requires CAPTCHA, but the public dashboard configuration is incomplete'
      );
    }
    return { provider, siteKey };
  }

  private async authenticateMethod(
    client: PrivyClient,
    method: ResolvedLoginMethod,
    config: DashboardConfig,
    configSignal: AbortSignal,
    generation: number
  ): Promise<PrivyUser> {
    switch (method.kind) {
      case 'email':
        return await this.authenticatePasswordless(
          client,
          'email',
          config,
          configSignal,
          generation
        );
      case 'phone':
        return await this.authenticatePasswordless(
          client,
          'phone',
          config,
          configSignal,
          generation
        );
      case 'passkey':
        return await this.authenticatePasskey(client, config, configSignal, generation);
      case 'farcaster':
        return await this.authenticateFarcaster(client, configSignal, generation);
      case 'guest':
        return userFromResponse(
          await this.runOperation(
            () => client.auth.guest.create(),
            configSignal,
            generation,
            'Privy guest login'
          )
        );
      case 'telegram-native': {
        const telegramWebAppData = this.telegramWebAppData();
        if (!telegramWebAppData) {
          throw new Error('Privy native Telegram login requires signed Telegram launch data');
        }
        return userFromResponse(
          await this.runOperation(
            () =>
              client.auth.telegram.authenticate({
                telegramWebAppData: telegramWebAppData as never,
              }),
            configSignal,
            generation,
            'Privy Telegram login'
          )
        );
      }
      case 'oauth':
        throw new Error('Privy OAuth login must be started with its redirect flow');
      case 'custom-token':
        throw new Error('Privy custom-token login must be supplied by the application');
    }
  }

  private async authenticatePasswordless(
    client: PrivyClient,
    kind: 'email' | 'phone',
    config: DashboardConfig,
    signal: AbortSignal,
    generation: number
  ): Promise<PrivyUser> {
    const captcha = this.captchaForConfig(config);
    const isEmail = kind === 'email';
    const icon = resolveLoginIcon({ kind });
    let destination = '';
    let captchaToken = '';
    let codePrompt: WalletAuthPrompt | undefined;
    let resendPrompt: WalletAuthPrompt | undefined;
    let controls!: PromptControls<PrivyUser>;

    const sendCode = async (
      values: Record<string, string>,
      resend: boolean,
      step: PromptStep
    ): Promise<void> => {
      this.assertGeneration(generation, signal);
      if (!controls.isActive(step)) throw createWalletError.notConnected();
      if (!resend) {
        destination = (values[isEmail ? 'email' : 'phone'] ?? '').trim();
        if (isEmail) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
            throw new Error('Enter a valid email address');
          }
        } else if (!/^\+?[0-9][0-9 ()-]{5,}$/.test(destination)) {
          throw new Error('Enter a valid phone number');
        }
        captchaToken = (values.captchaToken ?? '').trim();
        if (captcha && !captchaToken)
          throw new Error('Complete the CAPTCHA before requesting a code');
      } else if (captcha) {
        captchaToken = (values.captchaToken ?? '').trim();
        if (!captchaToken) throw new Error('Complete the CAPTCHA before requesting a code');
      }
      const response = await this.runOperation(
        () =>
          isEmail
            ? client.auth.email.sendCode(destination, captchaToken || undefined)
            : client.auth.phone.sendCode(destination, captchaToken || undefined),
        signal,
        generation,
        `Privy ${kind} code delivery`
      );
      if (!response?.success) throw new Error(`Privy did not send the ${kind} code`);
      if (!controls.isActive(step)) throw createWalletError.notConnected();

      const codeStep = controls.step();
      codePrompt = {
        title: 'Enter confirmation code',
        icon,
        description: isEmail
          ? `Check ${destination} for an email with your confirmation code.`
          : `Enter the confirmation code sent to ${destination}${config.whatsapp_enabled ? ' on WhatsApp' : ' by text message'}.`,
        fields: [
          {
            name: 'code',
            label: 'Verification code',
            type: 'text',
            inputMode: 'numeric',
            autocomplete: 'one-time-code',
            codeLength: 6,
          },
        ],
        submitLabel: 'Verify code',
        submit: async (values: Record<string, string>) => {
          await controls.run(codeStep, async () => {
            const code = (values.code ?? '').trim();
            if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit confirmation code');
            const authenticated = await this.runOperation(
              () =>
                isEmail
                  ? client.auth.email.loginWithCode(destination, code)
                  : client.auth.phone.loginWithCode(destination, code),
              signal,
              generation,
              `Privy ${kind} code verification`
            );
            controls.complete(userFromResponse(authenticated));
          });
        },
        secondaryAction: {
          label: 'Resend code',
          description: isEmail ? "Didn't get an email?" : "Didn't get a message?",
          run: async () => {
            await controls.run(codeStep, async () => {
              if (captcha) {
                const resendStep = controls.step();
                resendPrompt = {
                  title: 'Complete CAPTCHA to resend',
                  icon,
                  description: 'Verify that you are human before requesting another code.',
                  captcha,
                  submitLabel: 'Resend code',
                  submit: async (values: Record<string, string>) => {
                    await controls.run(resendStep, () => sendCode(values, true, resendStep));
                  },
                  cancel: () => controls.cancel(resendStep),
                };
                controls.show(resendPrompt, resendStep);
                return;
              }
              await sendCode({}, true, codeStep);
            });
          },
        },
        cancel: () => controls.cancel(codeStep),
      };
      controls.show(codePrompt, codeStep);
    };

    const result = await this.waitForPrompt<PrivyUser>(
      (promptControls) => {
        controls = promptControls;
        const initialStep = controls.step();
        return {
          title: isEmail
            ? 'Sign in with email'
            : `Sign in with ${config.whatsapp_enabled ? 'WhatsApp' : 'phone'}`,
          icon,
          description: isEmail
            ? 'Enter your email address to receive a confirmation code.'
            : `Enter your phone number, including the country code, to receive a confirmation code${config.whatsapp_enabled ? ' on WhatsApp' : ' by text message'}.`,
          fields: [
            {
              name: isEmail ? 'email' : 'phone',
              label: isEmail ? 'Email address' : 'Phone number',
              type: isEmail ? 'email' : 'tel',
              autocomplete: isEmail ? 'email' : 'tel',
              inputMode: isEmail ? 'email' : 'tel',
              placeholder: isEmail ? 'you@example.com' : '+1 555 123 4567',
            },
          ],
          ...(captcha ? { captcha } : {}),
          submitLabel: 'Send code',
          submit: async (values: Record<string, string>) => {
            await controls.run(initialStep, () => sendCode(values, false, initialStep));
          },
          cancel: () => controls.cancel(initialStep),
        };
      },
      signal,
      generation
    );
    return result;
  }

  private async authenticatePasskey(
    client: PrivyClient,
    config: DashboardConfig,
    signal: AbortSignal,
    generation: number
  ): Promise<PrivyUser> {
    if (typeof navigator === 'undefined' || !navigator.credentials) {
      throw new Error('Privy passkey login requires browser credential support');
    }
    return await this.waitForPrompt(
      (controls) => {
        const step = controls.step();
        const submitLogin = async (): Promise<void> => {
          if (!config.passkey_auth) {
            controls.complete(
              await this.signupWithPasskey(client, signal, generation, step.signal)
            );
            return;
          }
          const authentication = await this.runOperation(
            () => client.auth.passkey.generateAuthenticationOptions(),
            signal,
            generation,
            'Privy passkey initialization'
          );
          const authenticationOptions = this.passkeyAuthenticationOptions(authentication);
          const credential = asPasskeyCredential(
            await this.waitForBrowserCredential(
              (credentialSignal) =>
                navigator.credentials!.get({
                  publicKey: authenticationOptions,
                  signal: credentialSignal,
                }),
              signal,
              generation,
              step.signal
            )
          );
          const authenticated = await this.runOperation(
            () =>
              client.auth.passkey.loginWithPasskey(
                toAuthenticationResponse(credential) as never,
                this.passkeyChallenge(authentication),
                this.passkeyRelyingParty(authentication)
              ),
            signal,
            generation,
            'Privy passkey login'
          );
          controls.complete(userFromResponse(authenticated));
        };
        const prompt: WalletAuthPrompt = {
          title: 'Sign in with a passkey',
          description: 'Use the passkey saved on this device or in your password manager.',
          submitLabel: 'Use passkey',
          submit: async () => {
            await controls.run(step, submitLogin);
          },
          ...(config.passkeys_for_signup_enabled
            ? {
                secondaryAction: {
                  label: 'Create a passkey',
                  run: async () => {
                    await controls.run(step, async () => {
                      controls.complete(
                        await this.signupWithPasskey(client, signal, generation, step.signal)
                      );
                    });
                  },
                },
              }
            : {}),
          cancel: () => controls.cancel(step),
        };
        return prompt;
      },
      signal,
      generation
    );
  }

  private async signupWithPasskey(
    client: PrivyClient,
    signal: AbortSignal,
    generation: number,
    promptSignal: AbortSignal
  ): Promise<PrivyUser> {
    const registration = await this.runOperation(
      () => client.auth.passkey.generateSignupOptions(),
      signal,
      generation,
      'Privy passkey signup initialization'
    );
    const registrationOptions = this.passkeyRegistrationOptions(registration);
    const registrationCredential = asPasskeyCredential(
      await this.waitForBrowserCredential(
        (credentialSignal) =>
          navigator.credentials!.create({
            publicKey: registrationOptions,
            signal: credentialSignal,
          }),
        signal,
        generation,
        promptSignal
      )
    );
    const signedUp = await this.runOperation(
      () =>
        client.auth.passkey.signupWithPasskey(
          toRegistrationResponse(registrationCredential) as never,
          this.passkeyRelyingParty(registration)
        ),
      signal,
      generation,
      'Privy passkey signup'
    );
    return userFromResponse(signedUp);
  }

  private passkeyChallenge(value: unknown): string {
    const response = asRecord(value);
    const options = asRecord(response?.options);
    if (!options || !isNonEmptyString(options.challenge)) {
      throw new Error('Privy passkey response did not include a challenge');
    }
    return options.challenge;
  }

  private passkeyRelyingParty(value: unknown): string | undefined {
    const response = asRecord(value);
    return isNonEmptyString(response?.relying_party) ? response.relying_party : undefined;
  }

  private passkeyAuthenticationOptions(value: unknown): PublicKeyCredentialRequestOptions {
    const response = asRecord(value);
    const options = asRecord(response?.options);
    if (!options || !isNonEmptyString(options.challenge)) {
      throw new Error('Privy passkey response did not include authentication options');
    }
    const allowCredentials = passkeyCredentialDescriptors(options.allow_credentials);
    const extensions = passkeyExtensions(options.extensions);
    return {
      challenge: base64UrlToBytes(options.challenge) as unknown as ArrayBuffer,
      ...(isNonEmptyString(options.rp_id) ? { rpId: options.rp_id } : {}),
      ...(allowCredentials ? { allowCredentials } : {}),
      ...(typeof options.timeout === 'number' ? { timeout: options.timeout } : {}),
      ...(isNonEmptyString(options.user_verification)
        ? { userVerification: options.user_verification as UserVerificationRequirement }
        : {}),
      ...(extensions ? { extensions } : {}),
    };
  }

  private passkeyRegistrationOptions(value: unknown): PublicKeyCredentialCreationOptions {
    const response = asRecord(value);
    const options = asRecord(response?.options);
    const relyingParty = asRecord(options?.rp);
    const user = asRecord(options?.user);
    if (
      !options ||
      !isNonEmptyString(options.challenge) ||
      !relyingParty ||
      !isNonEmptyString(relyingParty.name) ||
      !user ||
      !isNonEmptyString(user.id) ||
      !isNonEmptyString(user.name) ||
      !isNonEmptyString(user.display_name)
    ) {
      throw new Error('Privy passkey response did not include registration options');
    }
    const pubKeyCredParams = Array.isArray(options.pub_key_cred_params)
      ? options.pub_key_cred_params.flatMap((entry) => {
          const parameter = asRecord(entry);
          return typeof parameter?.alg === 'number'
            ? [{ type: 'public-key' as const, alg: parameter.alg }]
            : [];
        })
      : [];
    if (pubKeyCredParams.length === 0)
      throw new Error('Privy passkey response did not include algorithms');
    const excludeCredentials = passkeyCredentialDescriptors(options.exclude_credentials);
    const extensions = passkeyExtensions(options.extensions);
    return {
      challenge: base64UrlToBytes(options.challenge) as unknown as ArrayBuffer,
      rp: {
        name: relyingParty.name,
        ...(isNonEmptyString(relyingParty.id) ? { id: relyingParty.id } : {}),
      },
      user: {
        id: base64UrlToBytes(user.id) as unknown as ArrayBuffer,
        name: user.name,
        displayName: user.display_name,
      },
      pubKeyCredParams,
      ...(typeof options.timeout === 'number' ? { timeout: options.timeout } : {}),
      ...(isNonEmptyString(options.attestation)
        ? { attestation: options.attestation as AttestationConveyancePreference }
        : {}),
      ...(asRecord(options.authenticator_selection)
        ? {
            authenticatorSelection: {
              ...(isNonEmptyString(
                asRecord(options.authenticator_selection)!.authenticator_attachment
              )
                ? {
                    authenticatorAttachment: asRecord(options.authenticator_selection)!
                      .authenticator_attachment as AuthenticatorAttachment,
                  }
                : {}),
              ...(typeof asRecord(options.authenticator_selection)!.require_resident_key ===
              'boolean'
                ? {
                    requireResidentKey: asRecord(options.authenticator_selection)!
                      .require_resident_key as boolean,
                  }
                : {}),
              ...(isNonEmptyString(asRecord(options.authenticator_selection)!.resident_key)
                ? {
                    residentKey: asRecord(options.authenticator_selection)!
                      .resident_key as ResidentKeyRequirement,
                  }
                : {}),
              ...(isNonEmptyString(asRecord(options.authenticator_selection)!.user_verification)
                ? {
                    userVerification: asRecord(options.authenticator_selection)!
                      .user_verification as UserVerificationRequirement,
                  }
                : {}),
            },
          }
        : {}),
      ...(excludeCredentials ? { excludeCredentials } : {}),
      ...(extensions ? { extensions } : {}),
    };
  }

  private async waitForBrowserCredential<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    signal: AbortSignal,
    generation: number,
    promptSignal: AbortSignal
  ): Promise<T> {
    this.assertGeneration(generation, signal);
    if (promptSignal.aborted) throw createWalletError.notConnected();
    const controller = new AbortController();
    const abortHandler = (): void => controller.abort();
    signal.addEventListener('abort', abortHandler, { once: true });
    promptSignal.addEventListener('abort', abortHandler, { once: true });
    const aborted = new Promise<never>((_, reject) => {
      const rejectAbort = (): void => reject(createWalletError.notConnected());
      controller.signal.addEventListener('abort', rejectAbort, { once: true });
      if (controller.signal.aborted) rejectAbort();
    });
    try {
      if (promptSignal.aborted || signal.aborted) {
        controller.abort();
        throw createWalletError.notConnected();
      }
      const value = await Promise.race([operation(controller.signal), aborted]);
      this.assertGeneration(generation, signal);
      if (promptSignal.aborted) throw createWalletError.notConnected();
      return value;
    } finally {
      signal.removeEventListener('abort', abortHandler);
      promptSignal.removeEventListener('abort', abortHandler);
    }
  }

  private async authenticateFarcaster(
    client: PrivyClient,
    signal: AbortSignal,
    generation: number
  ): Promise<PrivyUser> {
    const initialized = await this.runOperation(
      () => client.auth.farcaster.initializeAuth({ redirectUrl: this.options.redirectUri }),
      signal,
      generation,
      'Privy Farcaster initialization'
    );
    if (
      !isNonEmptyString(initialized.channel_token) ||
      !isNonEmptyString(initialized.connect_uri)
    ) {
      throw new Error('Privy Farcaster initialization did not return a connection URI');
    }
    return await this.waitForPrompt(
      (controls) => {
        const step = controls.step();
        void this.pollFarcaster(
          client,
          initialized.channel_token,
          controls,
          step,
          signal,
          generation
        );
        return {
          title: 'Sign in with Farcaster',
          description: 'Scan this QR code with Farcaster to approve sign-in.',
          url: initialized.connect_uri,
          qrCode: initialized.connect_uri,
          cancel: () => controls.cancel(step),
        };
      },
      signal,
      generation
    );
  }

  private async pollFarcaster(
    client: PrivyClient,
    channelToken: string,
    controls: PromptControls<PrivyUser>,
    step: PromptStep,
    signal: AbortSignal,
    generation: number
  ): Promise<void> {
    const deadline = Date.now() + FARCASTER_POLL_TIMEOUT_MS;
    try {
      while (controls.isActive(step) && Date.now() < deadline) {
        const status = asRecord(
          await controls.run(step, () =>
            this.runOperation(
              () => client.auth.farcaster.getFarcasterStatus({ channel_token: channelToken }),
              signal,
              generation,
              'Privy Farcaster status'
            )
          )
        );
        if (!controls.isActive(step)) return;
        if (status?.state === 'completed') {
          if (
            typeof status.message !== 'string' ||
            typeof status.signature !== 'string' ||
            typeof status.fid !== 'number'
          ) {
            throw new Error('Privy Farcaster status response is incomplete');
          }
          const authenticated = await controls.run(step, () =>
            this.runOperation(
              () =>
                client.auth.farcaster.authenticate({
                  channel_token: channelToken,
                  message: status.message as string,
                  signature: status.signature as string,
                  fid: status.fid as number,
                }),
              signal,
              generation,
              'Privy Farcaster authentication'
            )
          );
          if (!controls.isActive(step)) return;
          controls.complete(userFromResponse(authenticated));
          return;
        }
        await this.delayWithAbort(FARCASTER_POLL_INTERVAL_MS, signal, generation);
      }
      if (controls.isActive(step))
        throw createWalletError.operationTimeout('Privy Farcaster authentication');
    } catch (error) {
      if (controls.isActive(step)) controls.fail(error);
    }
  }

  private async delayWithAbort(ms: number, signal: AbortSignal, generation: number): Promise<void> {
    this.assertGeneration(generation, signal);
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const finish = (): void => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        resolve();
      };
      const abort = (): void => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        reject(createWalletError.notConnected());
      };
      timer = setTimeout(finish, ms);
      signal.addEventListener('abort', abort, { once: true });
      void Promise.resolve().then(() => {
        if (generation !== this.lifecycleGeneration) abort();
      });
      if (signal.aborted) abort();
    });
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
    this.activePromptReject?.();
    this.activePromptReject = undefined;
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
