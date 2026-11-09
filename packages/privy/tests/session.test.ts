import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { PrivySession } from '../src/session';
import type { PrivyLoginMethod, PrivyWallet } from '../src/session-types';

const mocks = vi.hoisted(() => ({
  clients: [] as Array<Record<string, unknown>>,
  initialize: vi.fn(),
  getAccessToken: vi.fn(),
  userGet: vi.fn(),
  refreshUser: vi.fn(),
  generateURL: vi.fn(),
  loginWithCode: vi.fn(),
  syncWithToken: vi.fn(),
  logout: vi.fn(),
  getURL: vi.fn(),
  setMessagePoster: vi.fn(),
  onMessage: vi.fn(),
  ping: vi.fn(),
  signWithUserSigner: vi.fn(),
  create: vi.fn(),
  getWallet: vi.fn(),
  rawSign: vi.fn(),
  Privy: vi.fn(),
}));

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

vi.mock('@privy-io/js-sdk-core', () => ({
  default: mocks.Privy,
  LocalStorage: class {
    get(key: string): unknown {
      const value = window.localStorage.getItem(key);
      return value === null ? undefined : JSON.parse(value);
    }

    put(key: string, value: unknown): void {
      window.localStorage.setItem(key, JSON.stringify(value));
    }

    del(key: string): void {
      window.localStorage.removeItem(key);
    }

    getKeys(): string[] {
      return Object.keys(window.localStorage);
    }
  },
  create: mocks.create,
  getWallet: mocks.getWallet,
  rawSign: mocks.rawSign,
}));

const userId = 'did:privy:example';
const walletId = 'wallet-xrpl-1';
const address = 'rPEPPER7kftd9w2To4CQk6UCfuHM9c6G';
const publicKey = `02${'11'.repeat(32)}`;

const embeddedAccount = () => ({
  id: walletId,
  address,
  chain_type: 'xrpl',
  connector_type: 'embedded',
  type: 'wallet',
  wallet_client: 'privy',
  wallet_client_type: 'privy',
  user_can_sign: true,
  public_key: publicKey,
});

const externalAccount = () => ({
  id: 'external-xrpl',
  address: 'rExternalWallet',
  chain_type: 'xrpl',
  connector_type: 'injected',
  type: 'wallet',
  wallet_client: 'unknown',
  wallet_client_type: 'unknown',
  user_can_sign: true,
});

const user = (accounts: readonly unknown[] = [embeddedAccount()]) => ({
  id: userId,
  linked_accounts: [...accounts],
});

const walletApi = () => ({
  id: walletId,
  address,
  chain_type: 'xrpl',
  public_key: publicKey,
});

const customMethod: PrivyLoginMethod = {
  id: 'custom',
  getCustomToken: vi.fn(async () => 'application-jwt'),
};

const oauthMethod: PrivyLoginMethod = { id: 'google', oauthProvider: 'google' };

function options(loginMethods: readonly PrivyLoginMethod[] = [customMethod]): {
  appId: string;
  redirectUri: string;
  loginMethods: readonly PrivyLoginMethod[];
  timeoutMs: number;
} {
  return {
    appId: 'app-216',
    redirectUri: `${window.location.origin}/wallet/privy`,
    loginMethods,
    timeoutMs: 100,
  };
}

function makeSession(loginMethods: readonly PrivyLoginMethod[] = [customMethod]): PrivySession {
  return new PrivySession(options(loginMethods));
}

function resetURL(path = '/'): void {
  window.history.replaceState({}, '', `${window.location.origin}${path}`);
}

function stubNavigation(): void {
  const target = window;
  const location = {
    get href() {
      return target.location.href;
    },
    get origin() {
      return target.location.origin;
    },
    get pathname() {
      return target.location.pathname;
    },
    get search() {
      return target.location.search;
    },
    get hash() {
      return target.location.hash;
    },
    assign: vi.fn(),
  } as unknown as Location;
  const browser = new Proxy(target, {
    get(value, property, receiver) {
      if (property === 'location') return location;
      const result = Reflect.get(value, property, receiver);
      return typeof result === 'function' ? result.bind(value) : result;
    },
  });
  vi.stubGlobal('window', browser);
}

function configureClient(): void {
  mocks.Privy.mockImplementation(function (this: Record<string, unknown>) {
    const client = {
      initialize: mocks.initialize,
      setMessagePoster: mocks.setMessagePoster,
      getAccessToken: mocks.getAccessToken,
      user: { get: mocks.userGet, refreshUser: mocks.refreshUser },
      auth: {
        oauth: { generateURL: mocks.generateURL, loginWithCode: mocks.loginWithCode },
        customProvider: { syncWithToken: mocks.syncWithToken },
        logout: mocks.logout,
      },
      embeddedWallet: {
        getURL: mocks.getURL,
        setMessagePoster: mocks.setMessagePoster,
        onMessage: mocks.onMessage,
        ping: mocks.ping,
        signWithUserSigner: mocks.signWithUserSigner,
      },
      app: { appId: 'app-216' },
    };
    Object.assign(this, client);
    mocks.clients.push(this);
  });
}

function configureExistingUser(): void {
  mocks.getAccessToken.mockResolvedValue('privy-access-token');
  mocks.userGet.mockResolvedValue({ user: user() });
  mocks.refreshUser.mockResolvedValue({ user: user() });
  mocks.getWallet.mockResolvedValue(walletApi());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clients.length = 0;
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
  stubNavigation();
  configureClient();
  mocks.initialize.mockResolvedValue(undefined);
  mocks.getAccessToken.mockResolvedValue(null);
  mocks.userGet.mockResolvedValue({ user: user() });
  mocks.refreshUser.mockResolvedValue({ user: user() });
  mocks.generateURL.mockResolvedValue({ url: 'https://auth.privy.io/apps/app-216/login' });
  mocks.loginWithCode.mockResolvedValue({ user: user() });
  mocks.syncWithToken.mockResolvedValue({ user: user() });
  mocks.logout.mockResolvedValue(undefined);
  mocks.getURL.mockReturnValue('https://auth.privy.io/apps/app-216/embedded-wallets');
  mocks.setMessagePoster.mockImplementation(() => {
    document.querySelector('iframe')?.dispatchEvent(new Event('load'));
  });
  mocks.ping.mockResolvedValue(true);
  mocks.signWithUserSigner.mockResolvedValue({ signature: 'user-signer-signature' });
  mocks.create.mockResolvedValue(walletApi());
  mocks.getWallet.mockResolvedValue(walletApi());
  mocks.rawSign.mockResolvedValue({
    method: 'raw_sign',
    data: { encoding: 'hex', signature: `0x${'ab'.repeat(64)}` },
  });
  resetURL();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(async () => {
  resetURL();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('PrivySession', () => {
  it('remains constructible when login methods are omitted from runtime config', () => {
    const session = new PrivySession({
      appId: 'app-216',
      redirectUri: `${window.location.origin}/wallet/privy`,
      loginMethods: undefined as never,
    });

    expect(session.hasPendingConnection()).toBe(false);
  });

  it('performs a custom-token login and creates one user-owned native XRPL wallet', async () => {
    const accountlessUser = user([externalAccount()]);
    mocks.syncWithToken.mockImplementation(async () => {
      mocks.getAccessToken.mockResolvedValue('privy-access-token');
      mocks.userGet.mockResolvedValue({ user: accountlessUser });
      return { user: accountlessUser };
    });
    mocks.refreshUser.mockResolvedValue({ user: user([embeddedAccount(), externalAccount()]) });

    const session = makeSession();
    const wallet = await session.connect('custom', new AbortController().signal);

    expect(wallet).toEqual({ id: walletId, address, publicKey, userId });
    expect(mocks.syncWithToken).toHaveBeenCalledWith('application-jwt');
    expect(mocks.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        request: { chain_type: 'xrpl' },
        headers: { 'privy-idempotency-key': `xrpl-connect:app-216:${userId}:xrpl` },
      })
    );
    expect(mocks.getWallet).toHaveBeenCalledWith(expect.anything(), { wallet_id: walletId });
    expect(document.querySelectorAll('iframe')).toHaveLength(1);

    await session.disconnect();
    expect(mocks.logout).toHaveBeenCalledWith({ userId });
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });

  it('reuses only the existing embedded XRPL account and excludes external accounts', async () => {
    configureExistingUser();
    mocks.userGet.mockResolvedValue({ user: user([externalAccount(), embeddedAccount()]) });

    const session = makeSession([customMethod]);
    const wallet = await session.connect('custom', new AbortController().signal);

    expect(wallet.id).toBe(walletId);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.getWallet).toHaveBeenCalledWith(expect.anything(), { wallet_id: walletId });
    await session.disconnect();
  });

  it('restores the exact user and wallet without redirecting or creating', async () => {
    configureExistingUser();
    const session = makeSession([oauthMethod]);

    const wallet = await session.connect(undefined, new AbortController().signal, {
      walletId,
      userId,
    });

    expect(wallet.id).toBe(walletId);
    expect(mocks.generateURL).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    await session.disconnect();
  });

  it('does not switch identity when a restore request meets a pending OAuth callback', async () => {
    const first = makeSession([oauthMethod]);
    const firstConnect = first.connect('google', new AbortController().signal);
    await vi.waitFor(() => expect(mocks.generateURL).toHaveBeenCalled());
    resetURL(
      '/wallet/privy?privy_oauth_code=oauth-code&privy_oauth_state=oauth-state&privy_oauth_provider=google'
    );
    configureExistingUser();

    const second = makeSession([oauthMethod]);
    const wallet = await second.connect(undefined, new AbortController().signal, {
      walletId,
      userId,
    });

    expect(wallet.id).toBe(walletId);
    expect(mocks.loginWithCode).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
    await first.disconnect();
    await second.disconnect();
    await expect(firstConnect).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it('marks an OAuth redirect as pending and never resolves it before callback return', async () => {
    const session = makeSession([oauthMethod]);
    const controller = new AbortController();
    const connecting = session.connect('google', controller.signal);

    await vi.waitFor(() => expect(mocks.generateURL).toHaveBeenCalled());
    expect(session.hasPendingConnection()).toBe(false);

    controller.abort();
    await session.disconnect();
    await expect(connecting).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it('does not begin embedded-wallet ping until the iframe has loaded', async () => {
    mocks.setMessagePoster.mockImplementationOnce(() => undefined);
    const session = makeSession();
    const connecting = session.connect('custom', new AbortController().signal);

    await vi.waitFor(() => expect(mocks.setMessagePoster).toHaveBeenCalled());
    expect(mocks.ping).not.toHaveBeenCalled();
    document.querySelector('iframe')?.dispatchEvent(new Event('load'));

    await expect(connecting).resolves.toMatchObject({ id: walletId });
    expect(mocks.ping).toHaveBeenCalledTimes(1);
    await session.disconnect();
  });

  it('cleans up a cancelled slow iframe load and permits a later retry', async () => {
    mocks.setMessagePoster.mockImplementationOnce(() => undefined);
    const session = makeSession();
    const controller = new AbortController();
    const connecting = session.connect('custom', controller.signal);

    await vi.waitFor(() => expect(mocks.setMessagePoster).toHaveBeenCalled());
    controller.abort();
    await expect(connecting).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
    expect(document.querySelectorAll('iframe')).toHaveLength(0);

    await session.disconnect();
    const wallet = await session.connect('custom', new AbortController().signal);
    expect(wallet.id).toBe(walletId);
    expect(mocks.ping).toHaveBeenCalledTimes(1);
    await session.disconnect();
  });

  it('waits for a reloaded iframe before a later signing readiness check', async () => {
    configureExistingUser();
    const session = makeSession();
    const wallet = await session.connect('custom', new AbortController().signal);
    const poster = mocks.setMessagePoster.mock.calls[0]?.[0] as { reload: () => void };

    poster.reload();
    const signing = session.signHash(wallet, `0x${'12'.repeat(32)}`, new AbortController().signal);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.ping).toHaveBeenCalledTimes(1);
    expect(mocks.rawSign).not.toHaveBeenCalled();

    document.querySelector('iframe')?.dispatchEvent(new Event('load'));
    await expect(signing).resolves.toBe(`0x${'ab'.repeat(64)}`);
    expect(mocks.ping).toHaveBeenCalledTimes(2);
    await session.disconnect();
  });

  it('cleans the iframe and listeners when message-poster setup fails', async () => {
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const removeIframeEventListener = vi.spyOn(HTMLIFrameElement.prototype, 'removeEventListener');
    mocks.setMessagePoster.mockImplementationOnce(() => {
      throw new Error('poster setup failed');
    });
    const session = makeSession();

    await expect(session.connect('custom', new AbortController().signal)).rejects.toThrow(
      'poster setup failed'
    );
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    expect(removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(removeIframeEventListener).toHaveBeenCalledWith('load', expect.any(Function));
    await session.disconnect();
  });

  it('does not persist an OAuth marker when cancelled immediately before OAuth setup', async () => {
    const controller = new AbortController();
    mocks.getAccessToken.mockImplementationOnce(async () => {
      controller.abort();
      return null;
    });
    const session = makeSession([oauthMethod]);

    await expect(session.connect('google', controller.signal)).rejects.toMatchObject({
      code: 'NOT_CONNECTED',
    });
    expect(mocks.generateURL).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
    await session.disconnect();
  });

  it('settles a direct disconnect while the OAuth redirect is being dispatched', async () => {
    const session = makeSession([oauthMethod]);
    let disconnecting: Promise<void> | undefined;
    vi.mocked(window.location.assign).mockImplementationOnce(() => {
      disconnecting = session.disconnect();
    });

    await expect(session.connect('google', new AbortController().signal)).rejects.toMatchObject({
      code: 'NOT_CONNECTED',
    });
    await disconnecting;
    expect(mocks.logout).toHaveBeenCalled();
  });

  it('completes only its own PKCE callback and cleans one-time URL parameters', async () => {
    const first = makeSession([oauthMethod]);
    const firstController = new AbortController();
    const firstConnect = first.connect('google', firstController.signal);
    await vi.waitFor(() => expect(mocks.generateURL).toHaveBeenCalled());

    resetURL(
      '/wallet/privy?privy_oauth_code=oauth-code&privy_oauth_state=oauth-state&privy_oauth_provider=google'
    );
    const second = makeSession([oauthMethod]);
    expect(second.hasPendingConnection()).toBe(true);
    configureExistingUser();
    const wallet = await second.connect(undefined, new AbortController().signal);

    expect(mocks.loginWithCode).toHaveBeenCalledWith('oauth-code', 'oauth-state', 'google');
    expect(window.location.search).toBe('');
    expect(wallet.id).toBe(walletId);

    await first.disconnect();
    await second.disconnect();
    await expect(firstConnect).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it('reports an OAuth user cancellation as a connection rejection', async () => {
    const first = makeSession([oauthMethod]);
    const firstController = new AbortController();
    const firstConnect = first.connect('google', firstController.signal);
    await vi.waitFor(() => expect(mocks.generateURL).toHaveBeenCalled());

    resetURL(
      '/wallet/privy?privy_oauth_error=access_denied&privy_oauth_error_description=Cancelled'
    );
    const second = makeSession([oauthMethod]);
    expect(second.hasPendingConnection()).toBe(true);

    await expect(second.connect(undefined, new AbortController().signal)).rejects.toMatchObject({
      code: 'CONNECTION_REJECTED',
    });
    expect(mocks.loginWithCode).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');

    await first.disconnect();
    await second.disconnect();
    await expect(firstConnect).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it('rejects an expired callback marker without consuming its code', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const first = makeSession([oauthMethod]);
    const firstController = new AbortController();
    const firstConnect = first.connect('google', firstController.signal);
    await vi.waitFor(() => expect(mocks.generateURL).toHaveBeenCalled());
    resetURL(
      '/wallet/privy?privy_oauth_code=oauth-code&privy_oauth_state=oauth-state&privy_oauth_provider=google'
    );
    now.mockReturnValue(10_001);

    // OAuth callback markers remain available for ten minutes, independently
    // of the short request timeout used by SDK operations.
    now.mockReturnValue(10_000 + 10 * 60_000 + 1);
    const second = makeSession([oauthMethod]);
    expect(second.hasPendingConnection()).toBe(false);
    await first.disconnect();
    await expect(firstConnect).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
    await second.disconnect();
  });

  it('revalidates ownership before raw hash signing', async () => {
    configureExistingUser();
    mocks.rawSign.mockImplementation(async (_client, sign, input) => {
      await sign({ message: 'wallet-api-request' });
      return {
        method: 'raw_sign',
        data: { encoding: 'hex', signature: `0x${'ab'.repeat(64)}` },
      };
    });
    const session = makeSession();
    const wallet = await session.connect('custom', new AbortController().signal);
    const signature = await session.signHash(
      wallet,
      `0x${'12'.repeat(32)}`,
      new AbortController().signal
    );

    expect(signature).toBe(`0x${'ab'.repeat(64)}`);
    expect(mocks.rawSign).toHaveBeenCalledWith(expect.anything(), expect.any(Function), {
      wallet_id: walletId,
      params: { hash: `0x${'12'.repeat(32)}` },
    });
    expect(mocks.signWithUserSigner).toHaveBeenCalledWith({ message: 'wallet-api-request' });
    await session.disconnect();
  });

  it('does not report transient refresh errors as session loss, but reports token expiry', async () => {
    configureExistingUser();
    const session = makeSession();
    await session.connect('custom', new AbortController().signal);
    const lost = vi.fn();
    session.onSessionLost(lost);

    mocks.refreshUser.mockRejectedValueOnce(new Error('temporary network failure'));
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lost).not.toHaveBeenCalled();

    mocks.getAccessToken.mockResolvedValue(null);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(lost).toHaveBeenCalledTimes(1));
    await session.disconnect();
  });

  it('stops a readiness failure before wallet creation', async () => {
    const accountlessUser = user([externalAccount()]);
    mocks.syncWithToken.mockImplementation(async () => {
      mocks.getAccessToken.mockResolvedValue('privy-access-token');
      mocks.userGet.mockResolvedValue({ user: accountlessUser });
      return { user: accountlessUser };
    });
    mocks.ping.mockResolvedValue(false);
    const session = makeSession();

    await expect(session.connect('custom', new AbortController().signal)).rejects.toMatchObject({
      code: 'OPERATION_TIMEOUT',
    });
    expect(mocks.create).not.toHaveBeenCalled();
    await session.disconnect();
  });

  it('waits for timed-out SDK work before logout and blocks a new login during cleanup', async () => {
    let releaseSync: (() => void) | undefined;
    mocks.syncWithToken.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseSync = resolve;
        })
    );
    const session = makeSession();
    const firstConnect = session.connect('custom', new AbortController().signal);
    await vi.waitFor(() => expect(mocks.syncWithToken).toHaveBeenCalled());
    await expect(firstConnect).rejects.toMatchObject({ code: 'OPERATION_TIMEOUT' });

    await session.disconnect();
    expect(mocks.logout).not.toHaveBeenCalled();
    await expect(session.connect('custom', new AbortController().signal)).rejects.toMatchObject({
      code: 'OPERATION_TIMEOUT',
    });
    expect(mocks.logout).not.toHaveBeenCalled();

    releaseSync?.();
    await vi.waitFor(() => expect(mocks.logout).toHaveBeenCalledWith(undefined));
  });
});
