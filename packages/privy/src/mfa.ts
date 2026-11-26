import { type WalletAuthPrompt } from 'xrpl-connect';
import {
  asPasskeyCredential,
  bytesToBase64Url,
  passkeyAuthenticationOptions,
  passkeyRegistrationOptions,
  toRegistrationResponse,
  type PasskeyCredentialLike,
} from './webauthn';

type RecordLike = Record<string, unknown>;

type Deferred<T = unknown> = {
  current: {
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
  } | null;
};

type DeferredValue = NonNullable<Deferred['current']>;

type MfaClient = {
  auth?: {
    passkey?: {
      generateRegistrationOptions?: (relyingParty?: string) => Promise<unknown>;
      linkWithPasskey?: (response: unknown, relyingParty?: string) => Promise<{ user?: unknown }>;
    };
  };
  mfa?: {
    passkey?: {
      generateAuthenticationOptions?: (args: RecordLike) => Promise<unknown>;
    };
    submitEnrollMfa?: (args: RecordLike) => Promise<unknown>;
  };
  user?: {
    get?: () => Promise<{ user?: unknown }>;
  };
  mfaPromises?: {
    on?: (event: 'mfaRequired', callback: () => void) => unknown;
    off?: (event: 'mfaRequired', callback: () => void) => unknown;
    rootPromise?: Deferred;
  };
};

export type PrivyMfaAssertion = {
  id: string;
  raw_id: string;
  type: 'public-key';
  authenticator_attachment?: string;
  response: {
    client_data_json: string;
    authenticator_data: string;
    signature: string;
    user_handle?: string;
  };
  client_extension_results: {
    app_id?: boolean;
    cred_props?: unknown;
    hmac_create_secret?: boolean;
  };
};

export interface PrivyMfaRequest {
  method: 'passkey';
  relyingParty: string;
  options: PublicKeyCredentialRequestOptions;
  authenticate: () => Promise<PrivyMfaAnswer>;
}

export type PrivyMfaAnswer = {
  mfaMethod: 'passkey';
  mfaCode: PrivyMfaAssertion;
  relyingParty: string;
};

export type PrivyMfaMode =
  | 'prompt'
  | 'none'
  | ((request: PrivyMfaRequest, signal: AbortSignal) => Promise<PrivyMfaAnswer>);

export interface PrivyMfaStatus {
  credentialIds: string[];
  enrolled: boolean;
}

export interface PrivyMfaApi {
  status(): Promise<PrivyMfaStatus>;
  linkPasskey(options?: {
    credentials?: Pick<CredentialsContainer, 'create'>;
    signal?: AbortSignal;
  }): Promise<{ credentialId: string; status: PrivyMfaStatus }>;
  enrollPasskey(options?: { credentialIds?: readonly string[] }): Promise<PrivyMfaStatus>;
}

const ROOT_WAIT_MS = 2_000;
const DEFAULT_MFA_TIMEOUT_MS = 60_000;

function asRecord(value: unknown): RecordLike | null {
  return typeof value === 'object' && value !== null ? (value as RecordLike) : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function requestOptions(response: unknown): PublicKeyCredentialRequestOptions {
  const result = passkeyAuthenticationOptions(response);
  return {
    ...result,
    userVerification: result.userVerification ?? 'required',
  };
}

function assertion(value: unknown): PrivyMfaAssertion {
  const credential = value as PasskeyCredentialLike | null;
  if (
    !credential ||
    !nonEmptyString(credential.id) ||
    credential.type !== 'public-key' ||
    !(credential.rawId instanceof ArrayBuffer) ||
    !credential.response ||
    !(credential.response.clientDataJSON instanceof ArrayBuffer) ||
    !(credential.response.authenticatorData instanceof ArrayBuffer) ||
    !(credential.response.signature instanceof ArrayBuffer)
  ) {
    throw new Error('The passkey did not answer');
  }
  const extensionResults = credential.getClientExtensionResults();
  const clientExtensionResults: PrivyMfaAssertion['client_extension_results'] = {};
  if (typeof extensionResults.appid === 'boolean') {
    clientExtensionResults.app_id = extensionResults.appid;
  }
  if (extensionResults.credProps !== undefined) {
    clientExtensionResults.cred_props = extensionResults.credProps;
  }
  if (typeof extensionResults.hmacCreateSecret === 'boolean') {
    clientExtensionResults.hmac_create_secret = extensionResults.hmacCreateSecret;
  }
  return {
    id: credential.id,
    raw_id: bytesToBase64Url(credential.rawId),
    type: 'public-key',
    ...(nonEmptyString(credential.authenticatorAttachment)
      ? { authenticator_attachment: credential.authenticatorAttachment }
      : {}),
    response: {
      client_data_json: bytesToBase64Url(credential.response.clientDataJSON),
      authenticator_data: bytesToBase64Url(credential.response.authenticatorData),
      signature: bytesToBase64Url(credential.response.signature),
      ...(credential.response.userHandle instanceof ArrayBuffer
        ? { user_handle: bytesToBase64Url(credential.response.userHandle) }
        : {}),
    },
    client_extension_results: clientExtensionResults,
  };
}

function reasoned(error: Error, reason: string): Error {
  return Object.assign(error, { reason });
}

function mfaError(
  message: string,
  reason: 'mfa_required' | 'mfa_cancelled' | 'mfa_timeout'
): Error {
  const error = Object.assign(new Error(message), { type: reason });
  return reasoned(error, reason);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDeferred(
  deferred: Deferred | undefined,
  previous: unknown,
  signal: AbortSignal,
  timeoutMs = ROOT_WAIT_MS,
  acceptExisting = false
): Promise<NonNullable<Deferred['current']> | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (signal.aborted) return null;
    const current = deferred?.current;
    if (current && (acceptExisting || current !== previous)) return current;
    await wait(5);
  }
  return null;
}

async function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw reasoned(new Error('MFA request was cancelled'), 'mfa_cancelled');
  return await new Promise<T>((resolve, reject) => {
    const onAbort = (): void =>
      reject(reasoned(new Error('MFA request was cancelled'), 'mfa_cancelled'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

function passkeyStatus(user: unknown): PrivyMfaStatus {
  const record = asRecord(user);
  const linkedAccounts = Array.isArray(record?.linked_accounts) ? record.linked_accounts : [];
  const credentialIds = linkedAccounts.flatMap((account) => {
    const value = asRecord(account);
    return value?.type === 'passkey' && nonEmptyString(value.credential_id)
      ? [value.credential_id]
      : [];
  });
  const mfaMethods = Array.isArray(record?.mfa_methods) ? record.mfa_methods : [];
  return {
    credentialIds,
    enrolled: mfaMethods.some((method) => asRecord(method)?.type === 'passkey'),
  };
}

export class PrivyMfaController implements PrivyMfaApi {
  private client: MfaClient | undefined;
  private listener: (() => void) | undefined;
  private active:
    | {
        token: symbol;
        controller: AbortController;
        previous: DeferredValue | null;
        rootPromise: Deferred;
        deferred?: DeferredValue;
      }
    | undefined;
  private readonly userActionListeners = new Set<(active: boolean) => void>();

  constructor(
    private readonly mode: PrivyMfaMode = 'prompt',
    private readonly emitPrompt: (prompt: WalletAuthPrompt | null) => boolean = () => false,
    private readonly origin: () => string = () =>
      typeof window === 'undefined' ? '' : window.location.origin,
    private readonly timeoutMs = DEFAULT_MFA_TIMEOUT_MS,
    private readonly onUserActionChange?: (active: boolean) => void
  ) {}

  attach(client: unknown): void {
    if (this.client === client) return;
    this.detach();
    const candidate = client as MfaClient;
    if (!candidate.mfaPromises?.on || !candidate.mfaPromises.rootPromise) return;
    this.client = candidate;
    this.listener = () => {
      const rootPromise = candidate.mfaPromises?.rootPromise;
      if (!rootPromise) return;

      // js-sdk-core emits `mfaRequired` before it installs the deferred for
      // the retry.  Capture the deferred in a microtask, after the SDK has
      // assigned it, and keep that object for the entire challenge.  Never
      // read rootPromise.current while rejecting a completed challenge: a
      // later sign may have installed a different deferred by then.
      const previous = rootPromise.current;
      if (this.active) {
        queueMicrotask(() => {
          const current = rootPromise.current;
          if (current && current !== this.active?.deferred) {
            current.reject(mfaError('Another Privy MFA request is already active', 'mfa_required'));
          }
        });
        return;
      }
      const token = Symbol('mfa');
      const controller = new AbortController();
      this.active = { token, controller, previous, rootPromise };
      queueMicrotask(() => {
        const deferred = rootPromise.current;
        if (this.active?.token === token) this.active.deferred = deferred ?? undefined;
        void this.handle(token, controller, previous, deferred ?? undefined);
      });
    };
    candidate.mfaPromises.on('mfaRequired', this.listener);
  }

  detach(): void {
    if (this.listener && this.client?.mfaPromises?.off) {
      this.client.mfaPromises.off('mfaRequired', this.listener);
    }
    this.listener = undefined;
    this.active?.controller.abort();
    this.active = undefined;
    this.client = undefined;
  }

  /** Internal hook used to pause the enclosing signing request timer. */
  onUserAction(callback: (active: boolean) => void): () => void {
    this.userActionListeners.add(callback);
    return () => this.userActionListeners.delete(callback);
  }

  /** End the challenge after the enclosing signing operation has settled. */
  finish(): void {
    this.active = undefined;
  }

  /** Reject a challenge that outlived its enclosing signing operation. */
  cancelActive(): void {
    const active = this.active;
    if (!active) return;
    const error = mfaError('Privy MFA timed out', 'mfa_timeout');
    active.controller.abort();
    active.deferred?.reject(error);
    const current = active.rootPromise.current;
    if (current && current !== active.deferred) current.reject(error);
    this.active = undefined;
  }

  async status(): Promise<PrivyMfaStatus> {
    const user = await this.requireClient().user?.get?.();
    return passkeyStatus(user?.user);
  }

  async linkPasskey(
    options: {
      credentials?: Pick<CredentialsContainer, 'create'>;
      signal?: AbortSignal;
    } = {}
  ): Promise<{ credentialId: string; status: PrivyMfaStatus }> {
    const client = this.requireClient();
    const passkey = client.auth?.passkey;
    if (!passkey?.generateRegistrationOptions || !passkey.linkWithPasskey) {
      throw new Error('Privy passkey linking is unavailable');
    }
    const signal = options.signal ?? new AbortController().signal;
    const credentials =
      options.credentials ?? (typeof navigator === 'undefined' ? undefined : navigator.credentials);
    if (!credentials?.create) throw new Error('Passkeys are unavailable in this browser');
    const registration = await withAbort(
      passkey.generateRegistrationOptions(this.origin()),
      signal
    );
    const creation = this.registrationOptions(registration);
    const credential = await withAbort(
      credentials.create({ publicKey: creation, signal }),
      signal
    ).catch((error: unknown) => {
      if ((error as { name?: string })?.name === 'NotAllowedError') {
        throw reasoned(new Error('Passkey enrollment was cancelled'), 'mfa_cancelled');
      }
      throw error;
    });
    const json = this.registrationResponse(credential);
    await withAbort(passkey.linkWithPasskey(json, this.origin()), signal);
    return { credentialId: json.id, status: await this.status() };
  }

  async enrollPasskey(
    options: { credentialIds?: readonly string[] } = {}
  ): Promise<PrivyMfaStatus> {
    const client = this.requireClient();
    const status = await this.status();
    const credentialIds = [...(options.credentialIds ?? status.credentialIds)];
    if (credentialIds.length === 0) throw new Error('Link a passkey before enrolling MFA');
    if (!client.mfa?.submitEnrollMfa) throw new Error('Privy MFA enrollment is unavailable');
    await client.mfa.submitEnrollMfa({ method: 'passkey', credentialIds });
    return this.status();
  }

  private requireClient(): MfaClient {
    if (!this.client) throw new Error('Sign in before using Privy MFA');
    return this.client;
  }

  private async handle(
    token: symbol,
    controller: AbortController,
    previous: DeferredValue | null,
    captured?: DeferredValue
  ): Promise<void> {
    const client = this.client;
    const rootPromise = client?.mfaPromises?.rootPromise;
    if (!client || !rootPromise) return;
    let keepActive = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    try {
      if (this.mode === 'none') {
        const root = await this.challengeDeferred(
          rootPromise,
          previous,
          captured,
          controller.signal
        );
        root?.reject(mfaError('Privy requires passkey MFA', 'mfa_required'));
        return;
      }
      const passkey = client.mfa?.passkey;
      if (!passkey?.generateAuthenticationOptions) {
        throw new Error('Privy passkey MFA is unavailable');
      }
      const options = requestOptions(
        await withAbort(
          passkey.generateAuthenticationOptions({ relying_party: this.origin() }),
          controller.signal
        )
      );
      const authenticate = (): Promise<PrivyMfaAnswer> =>
        this.authenticate(options, controller.signal);
      const request: PrivyMfaRequest = {
        method: 'passkey',
        relyingParty: this.origin(),
        options,
        authenticate,
      };
      const mode = this.mode;
      const answer =
        typeof mode === 'function'
          ? await this.withUserAction(() => mode(request, controller.signal), controller.signal)
          : await this.prompt(request, controller.signal, () => controller.abort());
      if (this.active?.token !== token) return;
      const root = await this.challengeDeferred(rootPromise, previous, captured, controller.signal);
      if (!root) throw mfaError('Privy MFA did not start', 'mfa_required');
      root.resolve(answer);
      keepActive = true;
    } catch (error) {
      const mapped = this.mapError(error, controller.signal, timedOut);
      const root = this.active?.token === token ? this.active.deferred : captured;
      root?.reject(mapped);
    } finally {
      clearTimeout(timer);
      if (!keepActive && this.active?.token === token) this.active = undefined;
    }
  }

  private async challengeDeferred(
    rootPromise: Deferred,
    previous: DeferredValue | null,
    captured: DeferredValue | undefined,
    signal: AbortSignal
  ): Promise<DeferredValue | null> {
    if (captured) return captured;
    // A browser/SDK shim may schedule the assignment after the event's first
    // microtask.  Poll only until this challenge's bounded wait expires, and
    // accept a changed deferred (never a previous challenge's object).
    return await waitForDeferred(rootPromise, previous, signal, ROOT_WAIT_MS);
  }

  private async prompt(
    request: PrivyMfaRequest,
    signal: AbortSignal,
    abort: () => void
  ): Promise<PrivyMfaAnswer> {
    return await new Promise<PrivyMfaAnswer>((resolve, reject) => {
      let settled = false;
      this.notifyUserAction(true);
      const finish = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        this.notifyUserAction(false);
        this.emitPrompt(null);
        callback();
      };
      const onAbort = (): void =>
        finish(() => reject(mfaError('Passkey MFA was cancelled', 'mfa_cancelled')));
      const cancel = (): void => {
        abort();
        onAbort();
      };
      signal.addEventListener('abort', onAbort, { once: true });
      const shown = this.emitPrompt({
        kind: 'mfa',
        title: 'Confirm with your passkey',
        description: 'Use Face ID, Touch ID, or your security key to approve this transaction.',
        submitLabel: 'Confirm',
        submit: async () => {
          try {
            const answer = await request.authenticate();
            finish(() => resolve(answer));
          } catch (error) {
            finish(() => reject(error));
          }
        },
        cancel,
      } as WalletAuthPrompt);
      if (!shown) {
        finish(() => reject(mfaError('Privy MFA needs a confirmation prompt', 'mfa_required')));
      }
    });
  }

  private async withUserAction<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
    this.notifyUserAction(true);
    try {
      return await withAbort(operation(), signal);
    } finally {
      this.notifyUserAction(false);
    }
  }

  private notifyUserAction(active: boolean): void {
    try {
      this.onUserActionChange?.(active);
    } catch {
      // The enclosing timer observer cannot affect the MFA operation.
    }
    for (const listener of [...this.userActionListeners]) {
      try {
        listener(active);
      } catch {
        // A timer observer must not affect the MFA operation.
      }
    }
  }

  private async authenticate(
    options: PublicKeyCredentialRequestOptions,
    signal: AbortSignal
  ): Promise<PrivyMfaAnswer> {
    const credentials = typeof navigator === 'undefined' ? undefined : navigator.credentials;
    if (!credentials?.get) throw new Error('Passkeys are unavailable in this browser');
    const credential = await withAbort(
      credentials.get({ publicKey: options, signal }),
      signal
    ).catch((error: unknown) => {
      const name = (error as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'AbortError') {
        throw mfaError('Passkey MFA was cancelled', 'mfa_cancelled');
      }
      throw error;
    });
    return {
      mfaMethod: 'passkey',
      mfaCode: assertion(credential),
      relyingParty: this.origin(),
    };
  }

  private mapError(error: unknown, signal: AbortSignal, timedOut: boolean): Error {
    if (timedOut) return mfaError('Passkey MFA timed out', 'mfa_timeout');
    if ((error as { reason?: string })?.reason === 'mfa_cancelled') return error as Error;
    if (signal.aborted) return mfaError('Passkey MFA timed out', 'mfa_timeout');
    return error instanceof Error ? error : new Error(String(error));
  }

  private registrationOptions(response: unknown): PublicKeyCredentialCreationOptions {
    return passkeyRegistrationOptions(response);
  }

  private registrationResponse(value: unknown): RecordLike & { id: string } {
    const credential = asPasskeyCredential(value as Credential | null);
    return toRegistrationResponse(credential) as RecordLike & { id: string };
  }
}
