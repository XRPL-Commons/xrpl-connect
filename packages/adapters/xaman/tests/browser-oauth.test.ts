import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

// xumm-sdk captures the fetch implementation while its Meta module is loaded.
// Delegate that captured function to the test's current global fetch so the real
// XummSdkJwt signing client can be exercised without network access.
vi.mock('fetch-ponyfill', () => ({
  default: () => ({
    fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
    Headers: globalThis.Headers,
    Request: globalThis.Request,
    Response: globalThis.Response,
  }),
}));

vi.mock('node-fetch', () => {
  const request = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);
  return {
    default: request,
    Headers: globalThis.Headers,
    Request: globalThis.Request,
    Response: globalThis.Response,
  };
});

import { MemoryStorageAdapter, WalletManager, WalletErrorCode } from '@xrpl-connect/core';
import { XummSdkJwt } from 'xumm-sdk';
import { BrowserOAuthClient, CONNECTION_TIMEOUT_MS } from '../src/browser-oauth';
import { XamanAdapter } from '../src/xaman-adapter';

const API_KEY = 'test-api-key';
const OTHER_API_KEY = 'other-api-key';
const ACCOUNT = 'rG1QQv2nh2gr7RCZ1P8YYcBUKCCN633jCn';
const BASE_URL = 'https://example.test/connect';
const SESSION_KEY = `xrpl-connect:xaman:session:${API_KEY}`;

const ME = {
  account: ACCOUNT,
  sub: 'xaman-user-token',
  networkEndpoint: 'wss://xrplcluster.com',
  networkId: 0,
  networkType: 'MAINNET',
};

type Listener = (event: Record<string, unknown>) => void;

class EventBus {
  private readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener): void {
    let listeners = this.listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(type, listeners);
    }
    listeners.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: Record<string, unknown> = {}): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener({ type, ...event });
    }
  }
}

class FakeLocation {
  private current: URL;

  constructor(href: string) {
    this.current = new URL(href);
  }

  get href(): string {
    return this.current.href;
  }

  set href(value: string) {
    this.current = new URL(value, this.current.href);
  }

  get search(): string {
    return this.current.search;
  }

  get pathname(): string {
    return this.current.pathname;
  }
}

class FakeDocument extends EventBus {
  constructor(readonly location: FakeLocation) {
    super();
  }

  hasFocus(): boolean {
    return true;
  }
}

type StorageOptions = {
  failGet?: boolean;
  failSet?: boolean;
  failRemove?: boolean;
};

class SharedStorage {
  private readonly values = new Map<string, string>();
  private readonly owners = new Set<FakeWindow>();
  readonly options: StorageOptions = {};

  createView(owner: FakeWindow): LocalStorageView {
    this.owners.add(owner);
    return new LocalStorageView(this, owner);
  }

  getItem(key: string): string | null {
    if (this.options.failGet) throw new Error('localStorage unavailable');
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string, owner: FakeWindow): void {
    if (this.options.failSet) throw new Error('localStorage unavailable');
    const oldValue = this.values.get(key) ?? null;
    this.values.set(key, value);
    this.notify(owner, key, oldValue, value);
  }

  removeItem(key: string, owner: FakeWindow): void {
    if (this.options.failRemove) throw new Error('localStorage unavailable');
    const oldValue = this.values.get(key) ?? null;
    this.values.delete(key);
    this.notify(owner, key, oldValue, null);
  }

  clear(owner: FakeWindow): void {
    if (this.options.failRemove) throw new Error('localStorage unavailable');
    for (const key of [...this.values.keys()]) this.removeItem(key, owner);
  }

  get length(): number {
    if (this.options.failGet) throw new Error('localStorage unavailable');
    return this.values.size;
  }

  key(index: number): string | null {
    if (this.options.failGet) throw new Error('localStorage unavailable');
    return [...this.values.keys()][index] ?? null;
  }

  private notify(
    owner: FakeWindow,
    key: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    for (const target of this.owners) {
      if (target === owner) continue;
      target.emit('storage', {
        key,
        oldValue,
        newValue,
        storageArea: target.localStorage,
        url: target.location.href,
      });
    }
  }
}

class LocalStorageView {
  constructor(
    private readonly shared: SharedStorage,
    private readonly owner: FakeWindow
  ) {}

  getItem(key: string): string | null {
    return this.shared.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.shared.setItem(key, value, this.owner);
  }

  removeItem(key: string): void {
    this.shared.removeItem(key, this.owner);
  }

  clear(): void {
    this.shared.clear(this.owner);
  }

  get length(): number {
    return this.shared.length;
  }

  key(index: number): string | null {
    return this.shared.key(index);
  }
}

class FakeWindow extends EventBus {
  readonly location: FakeLocation;
  readonly document: FakeDocument;
  readonly localStorage: LocalStorageView;
  readonly opened: Array<{ url: string; name: string; features: string }> = [];
  readonly popupHandles: Window[] = [];
  readonly history = {
    state: null as unknown,
    replaceState: vi.fn((_state: unknown, _title: string, url?: string | URL | null) => {
      if (url !== undefined && url !== null) this.location.href = url.toString();
    }),
  };
  readonly crypto = {
    getRandomValues: (bytes: Uint8Array): Uint8Array => {
      const seed = ++randomSeed;
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = (seed + index) & 0xff;
      }
      return bytes;
    },
  } as unknown as Crypto;
  readonly screen = { width: 1280, height: 800 };
  readonly URLSearchParams = URLSearchParams;
  readonly open = vi.fn((url: string, name: string, features: string) => {
    this.opened.push({ url, name, features });
    const popup = { closed: false } as unknown as Window;
    this.popupHandles.push(popup);
    return popup;
  });

  constructor(shared: SharedStorage, href: string) {
    super();
    this.location = new FakeLocation(href);
    this.document = new FakeDocument(this.location);
    this.localStorage = shared.createView(this);
  }
}

let randomSeed = 0;
let fetchMock: ReturnType<typeof vi.fn>;
let clients: BrowserOAuthClient[] = [];
let promises: Promise<unknown>[] = [];

function installBrowser(tab: FakeWindow): void {
  vi.stubGlobal('window', tab);
  vi.stubGlobal('document', tab.document);
  vi.stubGlobal('navigator', { userAgent: '' });
  vi.stubGlobal('localStorage', tab.localStorage);
  vi.stubGlobal('atob', (value: string) => Buffer.from(value, 'base64').toString('binary'));
}

function makeTab(shared: SharedStorage, href = BASE_URL): FakeWindow {
  return new FakeWindow(shared, href);
}

function track<T>(promise: Promise<T>): Promise<T> {
  promises.push(promise);
  void promise.catch(() => undefined);
  return promise;
}

function jwt(overrides: Record<string, unknown> = {}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const claims = {
    client_id: API_KEY,
    sub: ME.sub,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${payload}.test-signature`;
}

function jsonResponse(value: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  } as Response;
}

function attemptFor(tab: FakeWindow, state: string): Record<string, unknown> {
  const value = tab.localStorage.getItem(`xrpl-connect:xaman:${state}`);
  if (!value) throw new Error(`Missing OAuth attempt for ${state}`);
  return JSON.parse(value) as Record<string, unknown>;
}

function resultFor(tab: FakeWindow, state: string): Record<string, unknown> | undefined {
  const value = tab.localStorage.getItem(`xrpl-connect:xaman:${state}:result`);
  return value ? (JSON.parse(value) as Record<string, unknown>) : undefined;
}

function callbackHref(state: string, token: string, extra: Record<string, string> = {}): string {
  const callback = new URL(BASE_URL);
  callback.searchParams.set('state', state);
  callback.searchParams.set('access_token', token);
  for (const [key, value] of Object.entries(extra)) callback.searchParams.set(key, value);
  return callback.href;
}

async function settleMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function startPending(shared: SharedStorage): Promise<{
  tab: FakeWindow;
  client: BrowserOAuthClient;
  promise: Promise<Awaited<ReturnType<BrowserOAuthClient['authorize']>>>;
  state: string;
}> {
  const tab = makeTab(shared);
  installBrowser(tab);
  const client = new BrowserOAuthClient(API_KEY);
  clients.push(client);
  const promise = track(client.authorize());
  await settleMicrotasks();
  const opened = tab.opened[0];
  if (!opened) throw new Error('OAuth popup was not opened');
  const state = new URL(opened.url).searchParams.get('state');
  if (!state) throw new Error('OAuth popup did not include state');
  return { tab, client, promise, state };
}

beforeEach(() => {
  randomSeed = 0;
  clients = [];
  promises = [];
  fetchMock = vi.fn(async (input: string | URL) => {
    if (String(input).endsWith('/userinfo')) return jsonResponse(ME);
    return jsonResponse({ auth: true, client_id: API_KEY });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  for (const client of clients) client.cancelAuthorization();
  await Promise.allSettled(promises);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('BrowserOAuthClient', () => {
  it.each(['expired', 'revoked'] as const)(
    'replaces a %s saved session in the first authorization',
    async (reason) => {
      const tab = makeTab(new SharedStorage());
      installBrowser(tab);
      const token = jwt(reason === 'expired' ? { exp: 1 } : {});
      tab.localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ jwt: token, state: 'xrpl-connect-old' })
      );
      if (reason === 'revoked') fetchMock.mockResolvedValueOnce(jsonResponse({}, 401));
      const client = new BrowserOAuthClient(API_KEY);
      clients.push(client);
      const pending = track(client.authorize());
      await vi.waitFor(() => expect(tab.open).toHaveBeenCalledOnce());
      const state = new URL(tab.opened[0].url).searchParams.get('state')!;
      const freshToken = jwt({ state });
      tab.emit('message', {
        origin: 'https://oauth2.xumm.app',
        source: tab.popupHandles[0],
        data: {
          source: 'xumm_sign_request_resolved',
          options: { full_redirect_uri: callbackHref(state, freshToken) },
        },
      });
      await expect(pending).resolves.toMatchObject({ jwt: freshToken, me: ME });
      expect(JSON.parse(tab.localStorage.getItem(SESSION_KEY)!)).toMatchObject({
        jwt: freshToken,
        state,
      });
    }
  );

  it('does not start fresh authorization after saved-session verification is cancelled', async () => {
    const tab = makeTab(new SharedStorage());
    installBrowser(tab);
    tab.localStorage.setItem(SESSION_KEY, JSON.stringify({ jwt: jwt() }));
    let rejectVerification!: (error: Error) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((_, reject) => {
          rejectVerification = reject;
        })
    );
    const client = new BrowserOAuthClient(API_KEY);
    clients.push(client);
    const pending = track(client.authorize());
    client.cancelAuthorization();
    rejectVerification(new Error('Request failed'));
    await expect(pending).rejects.toThrow(/cancelled/);
    expect(tab.open).not.toHaveBeenCalled();
  });

  it('keeps expired saved-session restoration passive', async () => {
    const tab = makeTab(new SharedStorage());
    installBrowser(tab);
    tab.localStorage.setItem(SESSION_KEY, JSON.stringify({ jwt: jwt({ exp: 1 }) }));
    const client = new BrowserOAuthClient(API_KEY);
    clients.push(client);
    await expect(client.user.account).rejects.toThrow(/expired/);
    expect(tab.open).not.toHaveBeenCalled();
  });

  it('settles trusted popup closure after a grace period and permits a new attempt', async () => {
    vi.useFakeTimers();
    const shared = new SharedStorage();
    const pending = await startPending(shared);
    let settled = false;
    void pending.promise.catch(() => {
      settled = true;
    });
    const event = {
      origin: 'https://oauth2.xumm.app',
      source: pending.tab.popupHandles[0],
      data: { source: 'xumm_sign_request_popup_closed' },
    };
    pending.tab.emit('message', { ...event, origin: 'https://untrusted.test' });
    pending.tab.emit('message', { ...event, source: {} });
    await vi.advanceTimersByTimeAsync(1000);
    expect(settled).toBe(false);
    pending.tab.emit('message', event);
    await vi.advanceTimersByTimeAsync(749);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    await expect(pending.promise).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
    });
    const retry = await startPending(shared);
    expect(retry.state).not.toBe(pending.state);
    retry.client.cancelAuthorization();
    await expect(retry.promise).rejects.toThrow(/cancelled/);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('lets a popup result finish verification after a preceding close message', async () => {
    vi.useFakeTimers();
    const pending = await startPending(new SharedStorage());
    const event = { origin: 'https://oauth2.xumm.app', source: pending.tab.popupHandles[0] };
    pending.tab.emit('message', { ...event, data: { source: 'xumm_sign_request_popup_closed' } });
    let finishVerification!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finishVerification = resolve;
        })
    );
    pending.tab.emit('message', {
      ...event,
      data: {
        source: 'xumm_sign_request_resolved',
        options: { full_redirect_uri: callbackHref(pending.state, jwt({ state: pending.state })) },
      },
    });
    await vi.advanceTimersByTimeAsync(1000);
    finishVerification(jsonResponse(ME));
    await expect(pending.promise).resolves.toMatchObject({ me: ME });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('recovers a cross-tab result during the popup-close grace period', async () => {
    vi.useFakeTimers();
    const shared = new SharedStorage();
    const pending = await startPending(shared);
    pending.tab.emit('message', {
      origin: 'https://oauth2.xumm.app',
      source: pending.tab.popupHandles[0],
      data: { source: 'xumm_sign_request_popup_closed' },
    });
    const returned = makeTab(shared, callbackHref(pending.state, jwt({ state: pending.state })));
    installBrowser(returned);
    const client = new BrowserOAuthClient(API_KEY);
    clients.push(client);
    await expect(client.authorize()).resolves.toMatchObject({ me: ME });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending.promise).resolves.toMatchObject({ me: ME });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up a pending popup-close timer on cancellation', async () => {
    vi.useFakeTimers();
    const pending = await startPending(new SharedStorage());
    pending.tab.emit('message', {
      origin: 'https://oauth2.xumm.app',
      source: pending.tab.popupHandles[0],
      data: { source: 'xumm_sign_request_popup_closed' },
    });
    pending.client.cancelAuthorization();
    await expect(pending.promise).rejects.toThrow(/cancelled/);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts one attempt with a unique state, redirect, and pending localStorage record', async () => {
    const shared = new SharedStorage();
    const first = await startPending(shared);
    const second = await startPending(shared);

    expect(first.state).not.toBe(second.state);
    expect(first.tab.opened).toHaveLength(1);
    expect(second.tab.opened).toHaveLength(1);

    const firstUrl = new URL(first.tab.opened[0].url);
    expect(firstUrl.origin).toBe('https://oauth2.xumm.app');
    expect(firstUrl.pathname).toBe('/auth');
    expect(firstUrl.searchParams.get('client_id')).toBe(API_KEY);
    expect(firstUrl.searchParams.get('response_type')).toBe('token');
    expect(firstUrl.searchParams.get('scope')).toBe('XummPkce');
    expect(firstUrl.searchParams.get('redirect_uri')).toBe(BASE_URL);
    expect(attemptFor(first.tab, first.state)).toMatchObject({
      apiKey: API_KEY,
      redirect: BASE_URL,
      status: 'pending',
    });
  });

  it('recovers the original tab from a same-origin callback without opening a second popup', async () => {
    const shared = new SharedStorage();
    const original = await startPending(shared);
    const token = jwt();
    const returnTab = makeTab(shared, callbackHref(original.state, token));
    installBrowser(returnTab);
    const returnedClient = new BrowserOAuthClient(API_KEY);
    clients.push(returnedClient);

    const returned = await returnedClient.authorize();
    expect(returned).toBeDefined();
    expect(returnTab.open).not.toHaveBeenCalled();
    await expect(original.promise).resolves.toMatchObject({ me: ME, jwt: token });
    expect(returned?.sdk).toBeInstanceOf(XummSdkJwt);
    expect(returned?.sdk.payload).toBeDefined();
    expect(typeof returned?.sdk.payload?.create).toBe('function');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://oauth2.xumm.app/userinfo',
      expect.objectContaining({
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(returnTab.history.replaceState).toHaveBeenCalledOnce();
    expect(returnTab.location.href).toBe(BASE_URL);
    expect(resultFor(returnTab, original.state)).toMatchObject({ jwt: token });
  });

  it('accepts a resolved popup message only from the opened popup and OAuth origin', async () => {
    const shared = new SharedStorage();
    const pending = await startPending(shared);
    const token = jwt();
    const callback = callbackHref(pending.state, token);

    pending.tab.emit('message', {
      origin: 'https://oauth2.xumm.app',
      source: {} as Window,
      data: {
        source: 'xumm_sign_request_resolved',
        options: { full_redirect_uri: callback },
      },
    });
    await settleMicrotasks();
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://oauth2.xumm.app/userinfo',
      expect.anything()
    );

    pending.tab.emit('message', {
      origin: 'https://not-oauth.example',
      source: pending.tab.popupHandles[0],
      data: {
        source: 'xumm_sign_request_resolved',
        options: { full_redirect_uri: callback },
      },
    });
    await settleMicrotasks();
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://oauth2.xumm.app/userinfo',
      expect.anything()
    );

    pending.tab.emit('message', {
      origin: 'https://oauth2.xumm.app',
      source: pending.tab.popupHandles[0],
      data: {
        source: 'xumm_sign_request_resolved',
        options: { full_redirect_uri: callback },
      },
    });
    await expect(pending.promise).resolves.toMatchObject({ jwt: token });
    expect(resultFor(pending.tab, pending.state)).toMatchObject({ jwt: token });
  });

  it('settles an allowed popup rejection without accepting a forged source', async () => {
    const shared = new SharedStorage();
    const pending = await startPending(shared);
    pending.tab.emit('message', {
      origin: 'https://oauth2.xumm.app',
      source: {} as Window,
      data: { source: 'xumm_sign_request_rejected' },
    });
    await settleMicrotasks();
    expect(fetchMock).not.toHaveBeenCalled();

    pending.tab.emit('message', {
      origin: 'https://oauth2.xumm.app',
      source: pending.tab.popupHandles[0],
      data: { source: 'xumm_sign_request_rejected' },
    });
    await expect(pending.promise).rejects.toThrow(/rejected/i);
  });

  it('keeps concurrent attempts in separate tabs disjoint', async () => {
    const shared = new SharedStorage();
    const first = await startPending(shared);
    const second = await startPending(shared);

    expect(first.state).not.toBe(second.state);
    expect(new URL(first.tab.opened[0].url).searchParams.get('state')).toBe(first.state);
    expect(new URL(second.tab.opened[0].url).searchParams.get('state')).toBe(second.state);

    const firstToken = jwt({ sub: 'first-user' });
    const firstReturn = makeTab(shared, callbackHref(first.state, firstToken));
    installBrowser(firstReturn);
    const firstReturnClient = new BrowserOAuthClient(API_KEY);
    clients.push(firstReturnClient);
    await expect(firstReturnClient.authorize()).resolves.toMatchObject({ jwt: firstToken });
    await expect(first.promise).resolves.toMatchObject({ jwt: firstToken });
    expect(second.tab.opened).toHaveLength(1);
    expect(attemptFor(second.tab, second.state)).toMatchObject({ status: 'pending' });
    expect(resultFor(second.tab, first.state)).toMatchObject({ jwt: firstToken });

    const secondToken = jwt({ sub: 'second-user' });
    const secondReturn = makeTab(shared, callbackHref(second.state, secondToken));
    installBrowser(secondReturn);
    const secondReturnClient = new BrowserOAuthClient(API_KEY);
    clients.push(secondReturnClient);
    await expect(secondReturnClient.authorize()).resolves.toMatchObject({ jwt: secondToken });
    await expect(second.promise).resolves.toMatchObject({ jwt: secondToken });
    expect(resultFor(secondReturn, first.state)).toMatchObject({ jwt: firstToken });
    expect(resultFor(secondReturn, second.state)).toMatchObject({ jwt: secondToken });
  });

  it.each(['cancelled', 'expired'] as const)(
    'cannot let a stale %s callback overwrite a newer session',
    async (staleReason) => {
      const shared = new SharedStorage();
      const stale = await startPending(shared);
      if (staleReason === 'cancelled') {
        stale.client.cancelAuthorization();
      } else {
        const attempt = attemptFor(stale.tab, stale.state);
        stale.tab.localStorage.setItem(
          `xrpl-connect:xaman:${stale.state}`,
          JSON.stringify({ ...attempt, expires: Date.now() - 1 })
        );
        stale.tab.emit('storage');
      }
      await expect(stale.promise).rejects.toThrow();

      const fresh = await startPending(shared);
      const staleReturn = makeTab(shared, callbackHref(stale.state, jwt({ sub: 'stale' })));
      installBrowser(staleReturn);
      const staleReturnClient = new BrowserOAuthClient(API_KEY);
      clients.push(staleReturnClient);
      await expect(staleReturnClient.authorize()).rejects.toThrow();
      expect(staleReturn.open).not.toHaveBeenCalled();

      const freshToken = jwt({ sub: 'fresh' });
      const freshReturn = makeTab(shared, callbackHref(fresh.state, freshToken));
      installBrowser(freshReturn);
      const freshReturnClient = new BrowserOAuthClient(API_KEY);
      clients.push(freshReturnClient);
      await expect(freshReturnClient.authorize()).resolves.toMatchObject({ jwt: freshToken });
      await expect(fresh.promise).resolves.toMatchObject({ jwt: freshToken });
      expect(JSON.parse(fresh.tab.localStorage.getItem(SESSION_KEY) ?? '{}')).toMatchObject({
        jwt: freshToken,
      });
      expect(resultFor(fresh.tab, stale.state)).not.toMatchObject({ jwt: freshToken });
    }
  );

  it('settles an explicit cancellation immediately while authorization is pending', async () => {
    const shared = new SharedStorage();
    const pending = await startPending(shared);
    pending.client.cancelAuthorization();

    await expect(pending.promise).rejects.toThrow(/cancelled/i);
    expect(pending.tab.localStorage.getItem(`xrpl-connect:xaman:${pending.state}:cancelled`)).toBe(
      'true'
    );
  });

  it.each([
    {
      name: 'wrong callback state',
      mutate: (_tab: FakeWindow, _state: string) => undefined,
      state: () => 'xrpl-connect-state-that-was-not-issued',
      token: () => jwt(),
    },
    {
      name: 'wrong attempt API key',
      mutate: (tab: FakeWindow, state: string) => {
        const attempt = attemptFor(tab, state);
        tab.localStorage.setItem(
          `xrpl-connect:xaman:${state}`,
          JSON.stringify({ ...attempt, apiKey: OTHER_API_KEY })
        );
      },
      state: (_state: string) => _state,
      token: () => jwt(),
    },
    {
      name: 'wrong token audience',
      mutate: (_tab: FakeWindow, _state: string) => undefined,
      state: (_state: string) => _state,
      token: () => jwt({ client_id: OTHER_API_KEY }),
    },
    {
      name: 'expired token',
      mutate: (_tab: FakeWindow, _state: string) => undefined,
      state: (_state: string) => _state,
      token: () => jwt({ exp: Math.floor(Date.now() / 1000) - 1 }),
    },
  ])('$name is rejected before a session is established', async ({ mutate, state, token }) => {
    const shared = new SharedStorage();
    const pending = await startPending(shared);
    mutate(pending.tab, pending.state);
    const callbackState = state(pending.state);
    const returnTab = makeTab(shared, callbackHref(callbackState, token()));
    installBrowser(returnTab);
    const returnedClient = new BrowserOAuthClient(API_KEY);
    clients.push(returnedClient);

    await expect(returnedClient.authorize()).rejects.toThrow();
    expect(returnTab.open).not.toHaveBeenCalled();
    pending.client.cancelAuthorization();
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://oauth2.xumm.app/userinfo',
      expect.anything()
    );
    await expect(pending.promise).rejects.toThrow();
    expect(returnTab.localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('still settles cancellation when storage becomes unavailable after opening', async () => {
    const shared = new SharedStorage();
    const pending = await startPending(shared);
    shared.options.failSet = true;
    pending.client.cancelAuthorization();

    await expect(pending.promise).rejects.toThrow(/cancelled/i);
  });

  it('restores a saved session without opening OAuth and exposes a working XummSdkJwt client', async () => {
    const shared = new SharedStorage();
    const tab = makeTab(shared);
    installBrowser(tab);
    const token = jwt();
    tab.localStorage.setItem(SESSION_KEY, JSON.stringify({ jwt: token }));
    const client = new BrowserOAuthClient(API_KEY);
    clients.push(client);

    const session = await client.authorize();
    expect(session).toMatchObject({ jwt: token, me: ME });
    expect(tab.open).not.toHaveBeenCalled();
    expect(session?.sdk).toBeInstanceOf(XummSdkJwt);
    expect(client.payload).toBeDefined();
    expect(typeof client.payload?.create).toBe('function');
    await expect(client.user.account).resolves.toBe(ACCOUNT);
  });

  it('logs out without reviving an older legacy token or deleting the shared session pointer', async () => {
    const shared = new SharedStorage();
    const tab = makeTab(shared);
    installBrowser(tab);
    const token = jwt();
    const savedState = 'xrpl-connect-saved-session-state';
    tab.localStorage.setItem(SESSION_KEY, JSON.stringify({ jwt: token, state: savedState }));
    tab.localStorage.setItem('XummPkceJwt', JSON.stringify({ jwt: jwt({ sub: 'older-session' }) }));
    const client = new BrowserOAuthClient(API_KEY);
    clients.push(client);

    await expect(client.authorize()).resolves.toMatchObject({ jwt: token });
    await client.logout();
    expect(tab.localStorage.getItem(SESSION_KEY)).toBe(
      JSON.stringify({ jwt: token, state: savedState })
    );
    expect(tab.localStorage.getItem(`xrpl-connect:xaman:${savedState}:cancelled`)).toBe('true');

    const restoredAfterLogout = new BrowserOAuthClient(API_KEY);
    clients.push(restoredAfterLogout);
    const retry = track(restoredAfterLogout.authorize());
    await settleMicrotasks();
    expect(tab.open).toHaveBeenCalledOnce();
    restoredAfterLogout.cancelAuthorization();
    await expect(retry).rejects.toThrow(/cancelled/i);
  });

  it('uses an API-scoped ignore marker for a legacy saved token', async () => {
    const shared = new SharedStorage();
    const tab = makeTab(shared);
    installBrowser(tab);
    const token = jwt();
    tab.localStorage.setItem('XummPkceJwt', JSON.stringify({ jwt: token }));
    const client = new BrowserOAuthClient(API_KEY);
    clients.push(client);

    await expect(client.authorize()).resolves.toMatchObject({ jwt: token });
    await client.logout();
    expect(tab.localStorage.getItem('XummPkceJwt')).toBe(JSON.stringify({ jwt: token }));
    expect(tab.localStorage.getItem(`${SESSION_KEY}:ignored`)).toBe(JSON.stringify({ jwt: token }));

    const retryClient = new BrowserOAuthClient(API_KEY);
    clients.push(retryClient);
    const retry = track(retryClient.authorize());
    await settleMicrotasks();
    expect(tab.open).toHaveBeenCalledOnce();
    retryClient.cancelAuthorization();
    await expect(retry).rejects.toThrow(/cancelled/i);
  });

  it('lets autoConnect false recover a pending callback through explicit manager.reconnect()', async () => {
    const shared = new SharedStorage();
    const pending = await startPending(shared);
    const token = jwt();
    const returnTab = makeTab(shared, callbackHref(pending.state, token));
    installBrowser(returnTab);
    const adapter = new XamanAdapter({ apiKey: API_KEY });
    const manager = new WalletManager({
      adapters: [adapter],
      storage: new MemoryStorageAdapter(),
      autoConnect: false,
    });

    expect(manager.connected).toBe(false);
    await expect(manager.reconnect()).resolves.toMatchObject({ address: ACCOUNT });
    await expect(pending.promise).resolves.toMatchObject({ jwt: token });
    expect(returnTab.open).not.toHaveBeenCalled();
    expect(manager.wallet).toBe(adapter);
  });

  it('bounds a callback attempt at its expiry and cancels it on timeout', async () => {
    vi.useFakeTimers();
    const shared = new SharedStorage();
    const pending = await startPending(shared);
    vi.advanceTimersByTime(CONNECTION_TIMEOUT_MS);

    await expect(pending.promise).rejects.toThrow(/timed out|cancelled|expired/i);
    expect(pending.tab.localStorage.getItem(`xrpl-connect:xaman:${pending.state}:cancelled`)).toBe(
      'true'
    );
    vi.useRealTimers();
  });

  it('rejects a synchronous storage failure without an unhandled cancellation promise', async () => {
    const shared = new SharedStorage();
    const tab = makeTab(shared);
    installBrowser(tab);
    shared.options.failSet = true;
    const client = new BrowserOAuthClient(API_KEY);
    clients.push(client);
    await expect(client.authorize()).rejects.toThrow('localStorage unavailable');
    expect(tab.open).not.toHaveBeenCalled();
  });

  it('cannot turn a rejected return into a successful login with a later callback', async () => {
    const shared = new SharedStorage();
    const pending = await startPending(shared);
    const rejectedUrl = new URL(BASE_URL);
    rejectedUrl.searchParams.set('state', pending.state);
    rejectedUrl.searchParams.set('error', 'access_denied');
    const rejectedTab = makeTab(shared, rejectedUrl.href);
    installBrowser(rejectedTab);
    const rejected = new BrowserOAuthClient(API_KEY);
    clients.push(rejected);
    await expect(rejected.authorize()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
    });
    await expect(pending.promise).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
    });
    const lateTab = makeTab(shared, callbackHref(pending.state, jwt()));
    installBrowser(lateTab);
    const late = new BrowserOAuthClient(API_KEY);
    clients.push(late);
    await expect(late.authorize()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
    });
    expect(lateTab.localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(new URL(lateTab.location.href).searchParams.has('access_token')).toBe(false);
  });

  it('does not persist a callback cancelled while userinfo is in flight', async () => {
    const shared = new SharedStorage();
    const pending = await startPending(shared);
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        })
    );
    const returned = makeTab(shared, callbackHref(pending.state, jwt()));
    installBrowser(returned);
    const client = new BrowserOAuthClient(API_KEY);
    clients.push(client);
    const recovery = track(client.authorize());
    await settleMicrotasks();
    pending.client.cancelAuthorization();
    finish(jsonResponse(ME));
    await expect(recovery).rejects.toThrow(/cancelled/);
    await expect(pending.promise).rejects.toThrow(/cancelled/);
    expect(returned.localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(resultFor(returned, pending.state)).toBeUndefined();
  });

  it('ignores a saved token after its verification times out so a retry starts a fresh login', async () => {
    vi.useFakeTimers();
    const shared = new SharedStorage();
    const tab = makeTab(shared);
    installBrowser(tab);
    tab.localStorage.setItem(SESSION_KEY, JSON.stringify({ jwt: jwt() }));
    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => {}));
    const client = new BrowserOAuthClient(API_KEY);
    clients.push(client);
    const waiting = track(client.authorize());
    await vi.advanceTimersByTimeAsync(CONNECTION_TIMEOUT_MS);
    await expect(waiting).rejects.toMatchObject({ code: WalletErrorCode.OPERATION_TIMEOUT });
    const next = new BrowserOAuthClient(API_KEY);
    clients.push(next);
    const retry = track(next.authorize());
    await settleMicrotasks();
    expect(tab.open).toHaveBeenCalledOnce();
    next.cancelAuthorization();
    await expect(retry).rejects.toThrow(/cancelled/);
  });
});
