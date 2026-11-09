import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { PrivySession } from '../src/session';
import type { PrivyLoginMethod, PrivyWallet } from '../src/session-types';

const mocks = vi.hoisted(() => ({
  clients: [] as Array<Record<string, unknown>>,
  initialize: vi.fn(),
  getAccessToken: vi.fn(),
  fetchPrivyRoute: vi.fn(),
  userGet: vi.fn(),
  refreshUser: vi.fn(),
  generateURL: vi.fn(),
  loginWithCode: vi.fn(),
  emailSendCode: vi.fn(),
  emailLoginWithCode: vi.fn(),
  phoneSendCode: vi.fn(),
  phoneLoginWithCode: vi.fn(),
  guestCreate: vi.fn(),
  passkeyGenerateAuthenticationOptions: vi.fn(),
  passkeyGenerateSignupOptions: vi.fn(),
  passkeyLoginWithPasskey: vi.fn(),
  passkeySignupWithPasskey: vi.fn(),
  farcasterInitializeAuth: vi.fn(),
  farcasterGetStatus: vi.fn(),
  farcasterAuthenticate: vi.fn(),
  telegramAuthenticate: vi.fn(),
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
      fetchPrivyRoute: mocks.fetchPrivyRoute,
      user: { get: mocks.userGet, refreshUser: mocks.refreshUser },
      auth: {
        oauth: { generateURL: mocks.generateURL, loginWithCode: mocks.loginWithCode },
        email: { sendCode: mocks.emailSendCode, loginWithCode: mocks.emailLoginWithCode },
        phone: { sendCode: mocks.phoneSendCode, loginWithCode: mocks.phoneLoginWithCode },
        guest: { create: mocks.guestCreate },
        passkey: {
          generateAuthenticationOptions: mocks.passkeyGenerateAuthenticationOptions,
          generateSignupOptions: mocks.passkeyGenerateSignupOptions,
          loginWithPasskey: mocks.passkeyLoginWithPasskey,
          signupWithPasskey: mocks.passkeySignupWithPasskey,
        },
        farcaster: {
          initializeAuth: mocks.farcasterInitializeAuth,
          getFarcasterStatus: mocks.farcasterGetStatus,
          authenticate: mocks.farcasterAuthenticate,
        },
        telegram: { authenticate: mocks.telegramAuthenticate },
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
  mocks.fetchPrivyRoute.mockResolvedValue({
    email_auth: false,
    sms_auth: false,
    whatsapp_enabled: false,
    custom_oauth_providers: [],
  });
  mocks.userGet.mockResolvedValue({ user: user() });
  mocks.refreshUser.mockResolvedValue({ user: user() });
  mocks.generateURL.mockResolvedValue({ url: 'https://auth.privy.io/apps/app-216/login' });
  mocks.loginWithCode.mockResolvedValue({ user: user() });
  mocks.emailSendCode.mockResolvedValue({ success: true });
  mocks.emailLoginWithCode.mockResolvedValue({ user: user() });
  mocks.phoneSendCode.mockResolvedValue({ success: true });
  mocks.phoneLoginWithCode.mockResolvedValue({ user: user() });
  mocks.guestCreate.mockResolvedValue({ user: user() });
  mocks.passkeyGenerateAuthenticationOptions.mockResolvedValue({
    options: { challenge: 'Y2hhbGxlbmdl' },
  });
  mocks.passkeyGenerateSignupOptions.mockResolvedValue({
    options: {
      challenge: 'Y2hhbGxlbmdl',
      rp: { name: 'XRPL Connect' },
      user: { id: 'dXNlcg', name: 'user', display_name: 'User' },
      pub_key_cred_params: [{ type: 'public-key', alg: -7 }],
    },
  });
  mocks.passkeyLoginWithPasskey.mockResolvedValue({ user: user() });
  mocks.passkeySignupWithPasskey.mockResolvedValue({ user: user() });
  mocks.farcasterInitializeAuth.mockResolvedValue({
    channel_token: 'channel-token',
    connect_uri: 'https://warpcast.com/~/sign-in?channelToken=channel-token',
  });
  mocks.farcasterGetStatus.mockResolvedValue({ state: 'pending', nonce: 'nonce' });
  mocks.farcasterAuthenticate.mockResolvedValue({ user: user() });
  mocks.telegramAuthenticate.mockResolvedValue({ user: user() });
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
  it('discovers fresh dashboard methods while excluding external-wallet auth', async () => {
    mocks.fetchPrivyRoute
      .mockResolvedValueOnce({
        email_auth: true,
        sms_auth: false,
        whatsapp_enabled: false,
        google_oauth: true,
        wallet_auth: true,
        external_wallets_for_signup_enabled: true,
        passkey_auth: true,
        farcaster_auth: false,
        guest_auth: false,
        custom_oauth_providers: [
          {
            enabled: true,
            provider: 'custom:acme',
            provider_display_name: 'Acme',
            provider_icon_url: 'https://example.test/acme.svg',
          },
          {
            enabled: false,
            provider: 'custom:disabled',
            provider_display_name: 'Disabled',
          },
        ],
      })
      .mockResolvedValueOnce({
        email_auth: false,
        sms_auth: false,
        whatsapp_enabled: true,
        google_oauth: false,
        github_oauth: true,
        wallet_auth: true,
        custom_oauth_providers: [],
      });
    const session = new PrivySession({
      appId: 'app-216',
      redirectUri: `${window.location.origin}/wallet/privy`,
    });

    await expect(session.getLoginMethods()).resolves.toEqual([
      { id: 'email', label: 'Email' },
      { id: 'google', label: 'Google' },
      { id: 'passkey', label: 'Passkey' },
      { id: 'custom:acme', label: 'Acme', icon: 'https://example.test/acme.svg' },
    ]);
    await expect(session.getLoginMethods()).resolves.toEqual([
      { id: 'phone', label: 'WhatsApp' },
      { id: 'github', label: 'GitHub' },
    ]);
    expect(mocks.fetchPrivyRoute).toHaveBeenCalledTimes(2);
    expect(mocks.fetchPrivyRoute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ path: '/api/v1/apps/:app_id', method: 'GET' }),
      expect.objectContaining({ params: { app_id: 'app-216' }, signal: expect.any(AbortSignal) })
    );
    await session.disconnect();
  });

  it('waits for email input and code verification outside the SDK request timeout', async () => {
    mocks.fetchPrivyRoute.mockResolvedValueOnce({
      email_auth: true,
      custom_oauth_providers: [],
      captcha_enabled: false,
    });
    const session = new PrivySession({
      appId: 'app-216',
      redirectUri: `${window.location.origin}/wallet/privy`,
      timeoutMs: 20,
    });
    const seen: unknown[] = [];
    session.onAuthPrompt((prompt) => {
      seen.push(prompt);
    });
    const connecting = session.connect('email', new AbortController().signal);
    await vi.waitFor(() => expect(seen.at(-1)).toMatchObject({ title: 'Sign in with email' }));
    const emailPrompt = seen.at(-1) as NonNullable<(typeof seen)[number]> & {
      submit(values: Record<string, string>): Promise<void>;
    };
    await emailPrompt.submit({ email: 'user@example.com' });
    await vi.waitFor(() => expect(seen.at(-1)).toMatchObject({ title: 'Enter your email code' }));
    const codePrompt = seen.at(-1) as typeof emailPrompt & {
      secondaryAction: { run(): Promise<void> };
    };
    expect(mocks.emailSendCode).toHaveBeenCalledWith('user@example.com', undefined);
    await expect(codePrompt.submit({ code: '123456' })).resolves.toBeUndefined();
    await expect(connecting).resolves.toMatchObject({ id: walletId });
    expect(seen.at(-1)).toBeNull();
    await session.disconnect();
    expect(mocks.emailLoginWithCode).toHaveBeenCalledWith('user@example.com', '123456');
  });

  it('keeps an OTP prompt for retry and supports resend before cancellation', async () => {
    mocks.fetchPrivyRoute.mockResolvedValueOnce({ email_auth: true, custom_oauth_providers: [] });
    mocks.emailLoginWithCode.mockRejectedValueOnce(new Error('Invalid code'));
    const session = new PrivySession({
      appId: 'app-216',
      redirectUri: `${window.location.origin}/wallet/privy`,
    });
    let prompt: import('xrpl-connect').WalletAuthPrompt | null = null;
    session.onAuthPrompt((value) => {
      if (value) prompt = value;
    });
    const connecting = session.connect('email', new AbortController().signal);
    await vi.waitFor(() => expect(prompt).toMatchObject({ title: 'Sign in with email' }));
    await prompt!.submit!({ email: 'user@example.com' });
    await vi.waitFor(() => expect(prompt).toMatchObject({ title: 'Enter your email code' }));
    await expect(prompt!.submit!({ code: '000000' })).rejects.toThrow('Invalid code');
    expect(prompt).not.toBeNull();
    await prompt!.secondaryAction!.run();
    expect(mocks.emailSendCode).toHaveBeenCalledTimes(2);
    prompt!.cancel();
    await expect(connecting).rejects.toMatchObject({ code: 'CONNECTION_REJECTED' });
    await session.disconnect();
  });

  it('uses the phone OTP API for a dashboard-enabled SMS method', async () => {
    mocks.fetchPrivyRoute.mockResolvedValueOnce({ sms_auth: true, custom_oauth_providers: [] });
    const session = new PrivySession({
      appId: 'app-216',
      redirectUri: `${window.location.origin}/wallet/privy`,
    });
    let prompt: import('xrpl-connect').WalletAuthPrompt | null = null;
    session.onAuthPrompt((value) => {
      if (value) prompt = value;
    });
    const connecting = session.connect('phone', new AbortController().signal);
    await vi.waitFor(() => expect(prompt).toMatchObject({ title: 'Sign in with phone' }));
    await prompt!.submit!({ phone: '+33123456789' });
    await vi.waitFor(() => expect(prompt).toMatchObject({ title: 'Enter your phone code' }));
    await prompt!.submit!({ code: '123456' });
    await expect(connecting).resolves.toMatchObject({ id: walletId });
    expect(mocks.phoneSendCode).toHaveBeenCalledWith('+33123456789', undefined);
    expect(mocks.phoneLoginWithCode).toHaveBeenCalledWith('+33123456789', '123456');
    await session.disconnect();
  });

  it('requests a fresh CAPTCHA token before resending an OTP', async () => {
    mocks.fetchPrivyRoute.mockResolvedValueOnce({
      email_auth: true,
      captcha_enabled: true,
      enabled_captcha_provider: 'turnstile',
      captcha_site_key: 'site-key',
      custom_oauth_providers: [],
    });
    const session = new PrivySession({
      appId: 'app-216',
      redirectUri: `${window.location.origin}/wallet/privy`,
    });
    let prompt: import('xrpl-connect').WalletAuthPrompt | null = null;
    session.onAuthPrompt((value) => {
      if (value) prompt = value;
    });
    const connecting = session.connect('email', new AbortController().signal);
    await vi.waitFor(() => expect(prompt).toMatchObject({ captcha: { siteKey: 'site-key' } }));
    await prompt!.submit!({ email: 'user@example.com', captchaToken: 'captcha-1' });
    await vi.waitFor(() => expect(prompt).toMatchObject({ title: 'Enter your email code' }));
    expect(prompt!.captcha).toBeUndefined();
    await prompt!.secondaryAction!.run();
    await vi.waitFor(() => expect(prompt).toMatchObject({ title: 'Complete CAPTCHA to resend' }));
    await prompt!.submit!({ captchaToken: 'captcha-2' });
    expect(mocks.emailSendCode).toHaveBeenNthCalledWith(1, 'user@example.com', 'captcha-1');
    expect(mocks.emailSendCode).toHaveBeenNthCalledWith(2, 'user@example.com', 'captcha-2');
    prompt!.cancel();
    await expect(connecting).rejects.toMatchObject({ code: 'CONNECTION_REJECTED' });
    await session.disconnect();
  });

  it('runs the native passkey ceremony from an explicit prompt submit action', async () => {
    mocks.fetchPrivyRoute.mockResolvedValueOnce({
      passkey_auth: true,
      passkeys_for_signup_enabled: false,
      custom_oauth_providers: [],
    });
    const credential = {
      id: 'credential-id',
      rawId: new ArrayBuffer(2),
      type: 'public-key',
      response: {
        clientDataJSON: new ArrayBuffer(2),
        authenticatorData: new ArrayBuffer(2),
        signature: new ArrayBuffer(2),
        userHandle: null,
      },
      getClientExtensionResults: () => ({}),
    };
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: { get: vi.fn(async () => credential) },
    });
    const session = new PrivySession({
      appId: 'app-216',
      redirectUri: `${window.location.origin}/wallet/privy`,
    });
    let prompt: import('xrpl-connect').WalletAuthPrompt | null = null;
    session.onAuthPrompt((value) => {
      if (value) prompt = value;
    });
    const connecting = session.connect('passkey', new AbortController().signal);
    await vi.waitFor(() => expect(prompt).toMatchObject({ title: 'Sign in with a passkey' }));
    await prompt!.submit!({});
    await expect(connecting).resolves.toMatchObject({ id: walletId });
    expect(mocks.passkeyGenerateAuthenticationOptions).toHaveBeenCalledOnce();
    expect(mocks.passkeyLoginWithPasskey).toHaveBeenCalledOnce();
    await session.disconnect();
  });

  it('rejects a human-input wait when the session is directly disconnected', async () => {
    mocks.fetchPrivyRoute.mockResolvedValueOnce({ email_auth: true, custom_oauth_providers: [] });
    const session = new PrivySession({
      appId: 'app-216',
      redirectUri: `${window.location.origin}/wallet/privy`,
    });
    const prompts: Array<unknown> = [];
    session.onAuthPrompt((prompt) => prompts.push(prompt));
    const connecting = session.connect('email', new AbortController().signal);
    await vi.waitFor(() => expect(prompts.at(-1)).toMatchObject({ title: 'Sign in with email' }));
    await session.disconnect();
    await expect(connecting).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it('polls the low-level Farcaster channel and exposes only its connect URI', async () => {
    mocks.fetchPrivyRoute.mockResolvedValueOnce({
      farcaster_auth: true,
      custom_oauth_providers: [],
    });
    mocks.farcasterGetStatus.mockResolvedValueOnce({
      state: 'completed',
      fid: 123,
      message: 'Sign in with Farcaster',
      signature: '0xsignature',
      nonce: 'nonce',
    });
    const session = new PrivySession({
      appId: 'app-216',
      redirectUri: `${window.location.origin}/wallet/privy`,
    });
    let prompt: import('xrpl-connect').WalletAuthPrompt | null = null;
    session.onAuthPrompt((value) => {
      if (value) prompt = value;
    });
    const connecting = session.connect('farcaster', new AbortController().signal);
    await vi.waitFor(() =>
      expect(prompt).toMatchObject({
        title: 'Sign in with Farcaster',
        url: 'https://warpcast.com/~/sign-in?channelToken=channel-token',
        qrCode: 'https://warpcast.com/~/sign-in?channelToken=channel-token',
      })
    );
    await expect(connecting).resolves.toMatchObject({ id: walletId });
    expect(mocks.farcasterAuthenticate).toHaveBeenCalledWith({
      channel_token: 'channel-token',
      message: 'Sign in with Farcaster',
      signature: '0xsignature',
      fid: 123,
    });
    await session.disconnect();
  });

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
    expect(mocks.userGet).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
    expect(wallet.id).toBe(walletId);

    await first.disconnect();
    await second.disconnect();
    await expect(firstConnect).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it.each([
    { status: 403, code: 'invalid_origin', message: 'Origin not allowed' },
    { status: 403, code: 'oauth_account_suspended', message: 'OAuth account is suspended' },
    {
      status: 403,
      code: 'allowlist_rejected',
      message: 'Access is restricted to the app allowlist',
    },
    { status: 401, code: 'missing_or_invalid_privy_client_id', message: 'Invalid client ID' },
  ])('preserves OAuth initialization failures ($code)', async ({ message, ...details }) => {
    const failure = Object.assign(new Error(message), details);
    mocks.generateURL.mockRejectedValueOnce(failure);
    const session = makeSession([oauthMethod]);
    const lost = vi.fn();
    session.onSessionLost(lost);

    await expect(session.connect('google', new AbortController().signal)).rejects.toBe(failure);
    expect(lost).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
    await session.disconnect();
  });

  it('preserves custom authentication failures before a wallet exists', async () => {
    const failure = Object.assign(new Error('The custom JWT has an invalid audience'), {
      status: 401,
      code: 'invalid_credentials',
    });
    mocks.syncWithToken.mockRejectedValueOnce(failure);
    const session = makeSession();
    await expect(session.connect('custom', new AbortController().signal)).rejects.toBe(failure);
    await session.disconnect();
  });

  it('preserves user lookup failures during connection without signalling a lost wallet', async () => {
    const failure = Object.assign(new Error('The authenticated session has expired'), {
      status: 401,
      code: 'missing_or_invalid_token',
    });
    mocks.userGet.mockRejectedValueOnce(failure);
    const session = makeSession();
    const lost = vi.fn();
    session.onSessionLost(lost);
    await expect(
      session.connect(undefined, new AbortController().signal, { walletId, userId })
    ).rejects.toBe(failure);
    expect(lost).not.toHaveBeenCalled();
    await session.disconnect();
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

  it('does not report transient or configuration refresh errors as session loss, but reports token expiry', async () => {
    configureExistingUser();
    const session = makeSession();
    await session.connect('custom', new AbortController().signal);
    const lost = vi.fn();
    session.onSessionLost(lost);

    mocks.refreshUser.mockRejectedValueOnce(new Error('temporary network failure'));
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lost).not.toHaveBeenCalled();

    mocks.refreshUser.mockRejectedValueOnce(
      Object.assign(new Error('Origin not allowed'), { status: 403, code: 'invalid_origin' })
    );
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
