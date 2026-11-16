import type { Xumm } from 'xumm';
import { createWalletError } from '@xrpl-connect/core';
import { XummSdkJwt } from 'xumm-sdk';
import type { ResolvedFlow } from 'xumm-oauth2-pkce';
import { codeChallenge, randomHex } from './pkce';

export type XamanClient = Pick<Xumm, 'authorize' | 'logout'> & {
  payload?: Xumm['payload'] | XummSdkJwt['payload'];
  ping: () => ReturnType<Xumm['ping']> | Promise<Awaited<ReturnType<Xumm['ping']>>>;
  user: Pick<Xumm['user'], 'account' | 'networkId' | 'networkType' | 'networkEndpoint'>;
  cancelAuthorization?: () => void;
};

const PREFIX = 'xrpl-connect:xaman:';
const STATE_PREFIX = 'xrpl-connect-';
const OAUTH_ORIGIN = 'https://oauth2.xumm.app';
// Written by the universal Xumm SDK; earlier versions of this client copied it.
const LEGACY_SESSION_KEY = 'XummPkceJwt';
const POPUP_CLOSE_GRACE_MS = 750;
export const CONNECTION_TIMEOUT_MS = 5 * 60 * 1000;
const CALLBACK_PARAMS = [
  'access_token',
  'authorization_code',
  'code',
  'state',
  'scope',
  'token_type',
  'expires_in',
  'refresh_token',
  'error',
  'error_code',
  'error_description',
];

type Attempt = {
  apiKey: string;
  redirect: string;
  expires: number;
  status: 'pending';
  /** PKCE code verifier: only this browser can redeem the attempt's authorization code. */
  verifier: string;
};

function readItem<T>(browser: Window, key: string): T | undefined {
  try {
    return JSON.parse(browser.localStorage.getItem(key) || 'null') ?? undefined;
  } catch {
    return undefined;
  }
}

/** An attempt this browser started for `apiKey` that can still complete. */
function liveAttempt(browser: Window, apiKey: string, state: string): Attempt | undefined {
  const attempt = readItem<Attempt>(browser, `${PREFIX}${state}`);
  if (
    !attempt ||
    attempt.apiKey !== apiKey ||
    typeof attempt.verifier !== 'string' ||
    readItem(browser, `${PREFIX}${state}:cancelled`) ||
    !Number.isFinite(attempt.expires) ||
    attempt.expires <= Date.now()
  ) {
    return undefined;
  }
  return attempt;
}

/** Browser OAuth owns its attempts: the universal SDK shares a singleton per tab. */
export class BrowserOAuthClient implements XamanClient {
  /**
   * Whether this page is the callback of a live sign-in attempt that this browser
   * started. A link carrying a token or code without one must never sign in: it
   * could belong to another account.
   */
  static hasPendingCallback(apiKey: string): boolean {
    if (!usesBrowserOAuth()) return false;
    const params = new URLSearchParams(document.location.search);
    const state = params.get('state');
    return Boolean(
      state?.startsWith(STATE_PREFIX) &&
      (params.get('code') ||
        params.get('authorization_code') ||
        params.has('error') ||
        params.has('error_description')) &&
      liveAttempt(window, apiKey, state)
    );
  }

  private session?: ResolvedFlow;
  private loading?: Promise<ResolvedFlow | undefined>;
  private controller = new AbortController();
  private state?: string;
  private saved?: { jwt: string; state: string };
  private popup: Window | null = null;
  private readonly sessionKey: string;
  private readonly browser = window;
  private readonly page = document;
  private readonly callback: URL;
  readonly user: XamanClient['user'];

  constructor(private readonly apiKey: string) {
    this.sessionKey = `${PREFIX}session:${apiKey}`;
    this.callback = new URL(this.page.location.href);
    const load = () => this.restore();
    this.user = {
      get account() {
        return load().then((s) => s?.me.account);
      },
      get networkId() {
        return load().then((s) => s?.me.networkId);
      },
      get networkType() {
        return load().then((s) => s?.me.networkType);
      },
      get networkEndpoint() {
        return load().then((s) => s?.me.networkEndpoint);
      },
    };
  }

  get payload() {
    return this.session?.sdk.payload;
  }
  async ping() {
    return await this.session?.sdk.ping();
  }

  authorize(): Promise<ResolvedFlow | undefined> {
    if (this.session) return Promise.resolve(this.session);
    if (this.loading) return this.loading;
    const state = this.callback.searchParams.get('state');
    if (state?.startsWith(STATE_PREFIX)) {
      this.state = state;
      this.loading = this.bounded(() => this.receive(this.callback));
    } else {
      const saved = this.readSaved();
      if (typeof saved?.jwt === 'string') {
        this.loading = this.bounded(async () => {
          try {
            return await this.verify(saved.jwt);
          } catch {
            this.assertActive();
            this.invalidateSession(saved.jwt, this.saved?.state);
            this.saved = undefined;
            return await this.start();
          }
        });
      } else {
        this.loading = this.bounded(() => this.start());
      }
    }
    return this.loading;
  }

  private restore(): Promise<ResolvedFlow | undefined> {
    if (this.session) return Promise.resolve(this.session);
    if (this.loading) return this.loading;
    if (this.callback.searchParams.get('state')?.startsWith(STATE_PREFIX)) return this.authorize();
    const saved = this.readSaved();
    if (typeof saved?.jwt !== 'string') return Promise.resolve(undefined);
    this.loading = this.bounded(() => this.verify(saved.jwt as string));
    return this.loading;
  }

  private readSaved(): { jwt: string } | undefined {
    const saved = this.read<{ jwt?: unknown; state?: unknown }>(this.sessionKey);
    if (typeof saved?.jwt !== 'string') return undefined;
    // Restore only sessions from this client's state-bound sign-in. Entries without
    // a state were adopted from the universal SDK, which accepts tokens from any link.
    const state =
      typeof saved.state === 'string' && saved.state.startsWith(STATE_PREFIX)
        ? saved.state
        : undefined;
    if (!state || this.read(`${PREFIX}${state}:cancelled`)) {
      // Earlier versions kept such tokens after logout; do not leave them at rest.
      this.invalidateSession(saved.jwt, state);
      return undefined;
    }
    this.saved = { jwt: saved.jwt, state };
    return { jwt: saved.jwt };
  }

  /** Ends a session in every tab and deletes the stored copies of its token. */
  private invalidateSession(jwt: string, state?: string): void {
    try {
      if (state) this.write(`${PREFIX}${state}:cancelled`, true);
      const copies = [this.sessionKey, LEGACY_SESSION_KEY];
      if (state) copies.push(`${PREFIX}${state}:result`);
      for (const key of copies) {
        // Compare first: another tab may have saved a newer session under the same key.
        if (this.read<{ jwt?: unknown }>(key)?.jwt === jwt) this.remove(key);
      }
      // Earlier versions kept the last logged-out token here.
      this.remove(`${this.sessionKey}:ignored`);
    } catch {
      /* Storage may be unavailable; the session still ends in this tab. */
    }
  }

  private read<T>(key: string): T | undefined {
    return readItem<T>(this.browser, key);
  }

  private write(key: string, value: unknown): void {
    this.browser.localStorage.setItem(key, JSON.stringify(value));
  }

  private remove(key: string): void {
    this.browser.localStorage.removeItem(key);
  }

  private attempt(): Attempt | undefined {
    return this.state ? liveAttempt(this.browser, this.apiKey, this.state) : undefined;
  }

  private assertActive(): void {
    if (
      this.controller.signal.aborted ||
      (this.saved?.state && this.read(`${PREFIX}${this.saved.state}:cancelled`))
    ) {
      throw new Error('Xaman authorization was cancelled');
    }
    if (this.state) {
      if (this.read(`${PREFIX}${this.state}:rejected`))
        throw createWalletError.connectionRejected('Xaman');
      if (!this.attempt()) throw new Error('Xaman authorization expired or was cancelled');
    }
  }

  private async bounded(
    work: () => Promise<ResolvedFlow | undefined>
  ): Promise<ResolvedFlow | undefined> {
    if (this.controller.signal.aborted) throw new Error('Xaman authorization was cancelled');
    const deadline = Date.now() + CONNECTION_TIMEOUT_MS;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectWait!: (error: Error) => void;
    const stopped = new Promise<never>((_, reject) => {
      rejectWait = reject;
    });
    const abort = () => rejectWait(new Error('Xaman authorization was cancelled'));
    const checkDeadline = () => {
      if (Date.now() >= deadline) {
        timedOut = true;
        rejectWait(createWalletError.operationTimeout('Xaman authorization'));
        this.cancelAuthorization();
      }
    };
    this.controller.signal.addEventListener('abort', abort, { once: true });
    this.browser.addEventListener('pageshow', checkDeadline);
    this.page.addEventListener('visibilitychange', checkDeadline);
    timer = setTimeout(checkDeadline, CONNECTION_TIMEOUT_MS);
    try {
      const operation = new Promise<ResolvedFlow | undefined>((resolve) => resolve(work()));
      const session = await Promise.race([operation, stopped]);
      this.assertActive();
      this.session = session;
      if (session)
        this.write(this.sessionKey, { jwt: session.jwt, state: this.state ?? this.saved?.state });
      return session;
    } catch (error) {
      const cancelled = this.controller.signal.aborted;
      this.cancelAuthorization();
      if ((!cancelled || timedOut) && !this.state && this.saved)
        this.invalidateSession(this.saved.jwt, this.saved.state);
      throw error;
    } finally {
      clearTimeout(timer);
      this.controller.signal.removeEventListener('abort', abort);
      this.browser.removeEventListener('pageshow', checkDeadline);
      this.page.removeEventListener('visibilitychange', checkDeadline);
    }
  }

  private start(): Promise<ResolvedFlow> {
    this.removeExpiredAttempts();
    this.state = STATE_PREFIX + randomHex(this.browser.crypto, 32);
    // The verifier format of Xaman's own PKCE client: 64 random bytes, hex encoded.
    const verifier = randomHex(this.browser.crypto, 64);
    const redirect = new URL(this.page.location.href);
    for (const param of CALLBACK_PARAMS) redirect.searchParams.delete(param);
    this.write(`${PREFIX}${this.state}`, {
      apiKey: this.apiKey,
      redirect: redirect.href,
      expires: Date.now() + CONNECTION_TIMEOUT_MS,
      status: 'pending',
      verifier,
    } satisfies Attempt);
    // Authorization code flow with PKCE (RFC 7636): the callback carries a single-use
    // code instead of the bearer token, and only this browser can redeem it.
    const url = new URL('/auth', OAUTH_ORIGIN);
    url.search = new URLSearchParams({
      client_id: this.apiKey,
      redirect_uri: redirect.href,
      response_type: 'code',
      scope: 'XummPkce',
      state: this.state,
      code_challenge: codeChallenge(verifier),
      code_challenge_method: 'S256',
    }).toString();

    return new Promise((resolve, reject) => {
      let recovering = false;
      let closeTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = (result: Promise<ResolvedFlow>) => {
        if (recovering) return;
        recovering = true;
        clearTimeout(closeTimer);
        result.then(resolve, reject).finally(cleanup);
      };
      const check = () => {
        try {
          this.assertActive();
          const result = this.read<{ jwt?: unknown; rejected?: boolean }>(
            `${PREFIX}${this.state}:result`
          );
          if (result?.rejected) {
            cleanup();
            reject(createWalletError.connectionRejected('Xaman'));
            return;
          }
          if (typeof result?.jwt === 'string' && !recovering) {
            finish(this.verify(result.jwt));
          }
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      const message = (event: MessageEvent) => {
        if (event.origin !== OAUTH_ORIGIN && event.origin !== 'https://xumm.app') return;
        if (this.popup && event.source !== this.popup) return;
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data?.source === 'xumm_sign_request_popup_closed') {
            if (
              !this.popup ||
              event.source !== this.popup ||
              recovering ||
              closeTimer !== undefined
            )
              return;
            closeTimer = setTimeout(() => {
              check();
              if (!recovering) {
                cleanup();
                reject(createWalletError.connectionRejected('Xaman'));
              }
            }, POPUP_CLOSE_GRACE_MS);
            return;
          }
          if (
            data?.source === 'xumm_sign_request_rejected' &&
            this.popup &&
            event.source === this.popup
          ) {
            cleanup();
            reject(createWalletError.connectionRejected('Xaman'));
            return;
          }
          if (data?.source !== 'xumm_sign_request_resolved') return;
          const callback = new URL(data.options.full_redirect_uri);
          if (callback.searchParams.get('state') !== this.state || recovering) return;
          finish(this.receive(callback));
        } catch {
          /* Ignore messages that are not OAuth callbacks. */
        }
      };
      const abort = () => {
        cleanup();
        reject(new Error('Xaman authorization was cancelled'));
      };
      const poll = setInterval(check, 1000);
      const cleanup = () => {
        clearInterval(poll);
        clearTimeout(closeTimer);
        this.browser.removeEventListener('storage', check);
        this.browser.removeEventListener('pageshow', check);
        this.browser.removeEventListener('focus', check);
        this.browser.removeEventListener('message', message);
        this.page.removeEventListener('visibilitychange', check);
        this.controller.signal.removeEventListener('abort', abort);
      };
      this.browser.addEventListener('storage', check);
      this.browser.addEventListener('pageshow', check);
      this.browser.addEventListener('focus', check);
      this.browser.addEventListener('message', message);
      this.page.addEventListener('visibilitychange', check);
      this.controller.signal.addEventListener('abort', abort, { once: true });
      try {
        this.popup = this.browser.open(url.href, `Xaman-${this.state}`, 'width=600,height=790');
        if (!this.popup)
          throw new Error('Xaman sign-in window was blocked. Allow popups and try again.');
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  private async receive(callback: URL): Promise<ResolvedFlow> {
    const page = new URL(this.page.location.href);
    if (page.searchParams.get('state') === this.state) {
      // Keep the callback, including its code, out of the address bar and history.
      for (const param of CALLBACK_PARAMS) page.searchParams.delete(param);
      this.browser.history.replaceState(this.browser.history.state, '', page.href);
    }
    this.assertActive();
    const attempt = this.attempt()!;
    const redirect = new URL(attempt.redirect);
    if (
      callback.origin !== redirect.origin ||
      callback.pathname !== redirect.pathname ||
      callback.searchParams.get('state') !== this.state
    ) {
      throw new Error('Xaman returned an unexpected authorization callback');
    }
    // Xaman's PKCE client reads `code`; its redirect detection also accepts `authorization_code`.
    const code =
      callback.searchParams.get('code') || callback.searchParams.get('authorization_code');
    const rejected =
      callback.searchParams.has('error') || callback.searchParams.has('error_description');
    const existing = this.read<{ jwt?: string }>(`${PREFIX}${this.state}:result`);
    if (existing?.jwt) return await this.verify(existing.jwt);
    if (rejected) {
      this.write(`${PREFIX}${this.state}:rejected`, true);
      throw createWalletError.connectionRejected('Xaman');
    }
    if (!code) throw new Error('Xaman authorization did not return an authorization code');
    const jwt = await this.exchange(code, attempt);
    const session = await this.verify(jwt);
    this.assertActive();
    const completed = this.read<{ jwt?: string }>(`${PREFIX}${this.state}:result`);
    if (completed?.jwt && completed.jwt !== jwt)
      throw new Error('Xaman authorization already completed');
    if (!completed) this.write(`${PREFIX}${this.state}:result`, { jwt });
    return session;
  }

  /** Redeems the code at Xaman's token endpoint, as its own PKCE client does. */
  private async exchange(code: string, attempt: Attempt): Promise<string> {
    const response = await fetch(`${OAUTH_ORIGIN}/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.apiKey,
        redirect_uri: attempt.redirect,
        code_verifier: attempt.verifier,
      }),
      signal: this.controller.signal,
    });
    const token: { access_token?: unknown } | undefined = await response
      .json()
      .catch(() => undefined);
    if (!response.ok || typeof token?.access_token !== 'string' || !token.access_token) {
      throw new Error('Xaman did not issue an access token for the authorization code');
    }
    return token.access_token;
  }

  private async verify(jwt: string): Promise<ResolvedFlow> {
    this.assertActive();
    // The claims only scope the token; userinfo verifies it with the issuer.
    const claims = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const audience = claims.client_id ?? claims.app_uuidv4 ?? claims.aud;
    if (
      !(audience === this.apiKey || (Array.isArray(audience) && audience.includes(this.apiKey))) ||
      (this.state && claims.state !== undefined && claims.state !== this.state) ||
      !Number.isFinite(claims.exp) ||
      claims.exp * 1000 <= Date.now()
    ) {
      throw new Error('Xaman returned an expired token or a token for another application');
    }
    const response = await fetch(`${OAUTH_ORIGIN}/userinfo`, {
      headers: { Authorization: `Bearer ${jwt}` },
      signal: this.controller.signal,
    });
    if (!response.ok) throw new Error('Unable to verify Xaman authorization');
    const me: ResolvedFlow['me'] = await response.json();
    this.assertActive();
    if (!me || typeof me.account !== 'string' || !me.account || typeof me.sub !== 'string') {
      throw new Error('Xaman returned an invalid authorized account');
    }
    const session = { jwt, me, sdk: new XummSdkJwt(jwt) };
    return session;
  }

  private removeExpiredAttempts(): void {
    const storage = this.browser.localStorage;
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (
        !key?.startsWith(`${PREFIX}${STATE_PREFIX}`) ||
        key.endsWith(':cancelled') ||
        key.endsWith(':rejected') ||
        key.endsWith(':result')
      )
        continue;
      if (this.read<{ state?: string }>(this.sessionKey)?.state === key.slice(PREFIX.length))
        continue;
      const attempt = this.read<Attempt>(key);
      if (
        !attempt ||
        !Number.isFinite(attempt.expires) ||
        attempt.expires + 24 * 60 * 60 * 1000 <= Date.now()
      ) {
        storage.removeItem(key);
        storage.removeItem(`${key}:result`);
        storage.removeItem(`${key}:cancelled`);
        storage.removeItem(`${key}:rejected`);
      }
    }
  }

  cancelAuthorization(): void {
    this.controller.abort();
    if (this.state && !this.session && !this.read(`${PREFIX}${this.state}:rejected`)) {
      try {
        this.write(`${PREFIX}${this.state}:cancelled`, true);
      } catch {
        /* Storage may have become unavailable while the wallet was open. */
      }
    }
  }

  async logout(): Promise<void> {
    this.cancelAuthorization();
    if (this.session) {
      this.invalidateSession(this.session.jwt, this.state ?? this.saved?.state);
    }
    this.session = undefined;
  }
}

/**
 * Browsers outside xApps always sign in here. The universal SDK's browser flow
 * adopts an `access_token` or `authorization_code` from any link without checking
 * that this browser requested it, so it must never handle the page URL.
 */
export function usesBrowserOAuth(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    Boolean(document.location?.href) &&
    !/xumm\/xapp|xAppBuilder/i.test(navigator.userAgent)
  );
}
