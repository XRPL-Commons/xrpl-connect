import type { Xumm } from 'xumm';
import { createWalletError } from '@xrpl-connect/core';
import { XummSdkJwt } from 'xumm-sdk';
import type { ResolvedFlow } from 'xumm-oauth2-pkce';

export type XamanClient = Pick<Xumm, 'authorize' | 'logout'> & {
  payload?: Xumm['payload'] | XummSdkJwt['payload'];
  ping: () => ReturnType<Xumm['ping']> | Promise<Awaited<ReturnType<Xumm['ping']>>>;
  user: Pick<Xumm['user'], 'account' | 'networkId' | 'networkType' | 'networkEndpoint'>;
  cancelAuthorization?: () => void;
};

const PREFIX = 'xrpl-connect:xaman:';
const STATE_PREFIX = 'xrpl-connect-';
const OAUTH_ORIGIN = 'https://oauth2.xumm.app';
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
};

/** Browser OAuth owns its attempts: the universal SDK shares a singleton per tab. */
export class BrowserOAuthClient implements XamanClient {
  private session?: ResolvedFlow;
  private loading?: Promise<ResolvedFlow | undefined>;
  private controller = new AbortController();
  private state?: string;
  private saved?: { key: string; jwt: string; state?: string };
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
        this.loading = this.bounded(() => this.verify(saved.jwt as string));
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
    for (const key of [this.sessionKey, 'XummPkceJwt']) {
      const saved = this.read<{ jwt?: unknown; state?: string }>(key);
      if (saved?.state && this.read(`${PREFIX}${saved.state}:cancelled`)) return undefined;
      if (
        saved?.jwt &&
        this.read<{ jwt?: unknown }>(`${this.sessionKey}:ignored`)?.jwt === saved.jwt
      )
        return undefined;
      if (typeof saved?.jwt === 'string') {
        this.saved = { key, jwt: saved.jwt, state: saved.state };
        return { jwt: saved.jwt };
      }
    }
    return undefined;
  }

  private invalidateSession(jwt: string, state?: string): void {
    try {
      if (state) this.write(`${PREFIX}${state}:cancelled`, true);
      this.write(`${this.sessionKey}:ignored`, { jwt });
    } catch {
      // Do not delete shared session storage: another tab may have replaced it.
    }
  }

  private read<T>(key: string): T | undefined {
    try {
      return JSON.parse(this.browser.localStorage.getItem(key) || 'null') ?? undefined;
    } catch {
      return undefined;
    }
  }

  private write(key: string, value: unknown): void {
    this.browser.localStorage.setItem(key, JSON.stringify(value));
  }

  private attempt(): Attempt | undefined {
    return this.state ? this.read<Attempt>(`${PREFIX}${this.state}`) : undefined;
  }

  private assertActive(): void {
    if (
      this.controller.signal.aborted ||
      (this.saved?.state && this.read(`${PREFIX}${this.saved.state}:cancelled`))
    ) {
      throw new Error('Xaman authorization was cancelled');
    }
    if (this.state) {
      const attempt = this.attempt();
      if (this.read(`${PREFIX}${this.state}:rejected`))
        throw createWalletError.connectionRejected('Xaman');
      if (
        !attempt ||
        attempt.apiKey !== this.apiKey ||
        this.read(`${PREFIX}${this.state}:cancelled`) ||
        !Number.isFinite(attempt.expires) ||
        attempt.expires <= Date.now()
      ) {
        throw new Error('Xaman authorization expired or was cancelled');
      }
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
    const bytes = new Uint8Array(32);
    this.browser.crypto.getRandomValues(bytes);
    this.state = STATE_PREFIX + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const redirect = new URL(this.page.location.href);
    for (const param of CALLBACK_PARAMS) redirect.searchParams.delete(param);
    this.write(`${PREFIX}${this.state}`, {
      apiKey: this.apiKey,
      redirect: redirect.href,
      expires: Date.now() + CONNECTION_TIMEOUT_MS,
      status: 'pending',
    } satisfies Attempt);
    const url = new URL('/auth', OAUTH_ORIGIN);
    url.search = new URLSearchParams({
      client_id: this.apiKey,
      redirect_uri: redirect.href,
      response_type: 'token',
      scope: 'XummPkce',
      state: this.state,
    }).toString();

    return new Promise((resolve, reject) => {
      let recovering = false;
      const finish = (result: Promise<ResolvedFlow>) => {
        if (recovering) return;
        recovering = true;
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
    if (callback.href === this.page.location.href) {
      const clean = new URL(callback.href);
      for (const param of CALLBACK_PARAMS) clean.searchParams.delete(param);
      this.browser.history.replaceState(this.browser.history.state, '', clean.href);
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
    const jwt = callback.searchParams.get('access_token');
    const rejected =
      callback.searchParams.has('error') || callback.searchParams.has('error_description');
    const existing = this.read<{ jwt?: string }>(`${PREFIX}${this.state}:result`);
    if (existing?.jwt) return await this.verify(existing.jwt);
    if (rejected) {
      this.write(`${PREFIX}${this.state}:rejected`, true);
      throw createWalletError.connectionRejected('Xaman');
    }
    if (!jwt) throw new Error('Xaman authorization did not return an access token');
    const session = await this.verify(jwt);
    this.assertActive();
    const completed = this.read<{ jwt?: string }>(`${PREFIX}${this.state}:result`);
    if (completed?.jwt && completed.jwt !== jwt)
      throw new Error('Xaman authorization already completed');
    if (!completed) this.write(`${PREFIX}${this.state}:result`, { jwt });
    return session;
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

export function usesBrowserOAuth(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    Boolean(document.location?.href) &&
    !/xumm\/xapp|xAppBuilder/i.test(navigator.userAgent) &&
    (!new URLSearchParams(document.location.search).has('access_token') ||
      new URLSearchParams(document.location.search).get('state')?.startsWith(STATE_PREFIX) ===
        true) &&
    !new URLSearchParams(document.location.search).has('authorization_code')
  );
}
