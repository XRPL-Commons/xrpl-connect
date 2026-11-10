import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { WalletManager } from '@xrpl-connect/core';
import type { NetworkInfo, WalletAdapter, WalletAuthPrompt } from '@xrpl-connect/core';
import type { SocialLogin } from '../src/types';

const captcha = vi.hoisted(() => ({
  mounts: [] as Array<{ onToken: (token: string) => void; cleanup: () => void }>,
}));

vi.mock('../src/services/Captcha', () => ({
  renderCaptchaWidget: vi.fn(
    async (
      _container: HTMLElement,
      _provider: string,
      _siteKey: string,
      _nonce: unknown,
      onToken
    ) => {
      const cleanup = vi.fn();
      captcha.mounts.push({ onToken, cleanup });
      return cleanup;
    }
  ),
}));

await import('../src/wallet-connector');

const NETWORK: NetworkInfo = { id: 'testnet', name: 'Testnet', wss: 'wss://example' };

type Connector = HTMLElement & {
  socialLogins: readonly SocialLogin[];
  setWalletManager(manager: WalletManager): void;
  open(): Promise<void>;
  close(): void;
  disconnectedCallback(): void;
  getOverlayRoot(): ShadowRoot | null;
  getAccountModalRoot(): ShadowRoot | null;
  openAccountModal(): void;
  disconnectFromAccountModal(): Promise<void>;
  showSocialLoginList(): void;
  showAuthPrompt(prompt: WalletAuthPrompt, walletId: string, walletName: string): void;
  submitAuthPrompt(): Promise<void>;
};

function createAdapter(id: string, extra: Partial<WalletAdapter> = {}): WalletAdapter {
  return {
    id,
    name: id,
    isAvailable: async () => true,
    connect: vi.fn(async () => ({ address: 'rTest', network: NETWORK })),
    disconnect: vi.fn(async () => {}),
    getAccount: vi.fn(async () => null),
    getNetwork: vi.fn(async () => NETWORK),
    sign: vi.fn(),
    signAndSubmit: vi.fn(),
    signMessage: vi.fn(),
    ...extra,
  } as WalletAdapter;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('WalletConnector social login', () => {
  let element: Connector | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    captcha.mounts.length = 0;
  });

  afterEach(() => {
    element?.disconnectedCallback();
    document.body.replaceChildren();
    document.body.style.overflow = '';
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  async function mount(adapters: WalletAdapter[], attributes: Record<string, string> = {}) {
    const connector = document.createElement('xrpl-wallet-connector') as Connector;
    for (const [name, value] of Object.entries(attributes)) connector.setAttribute(name, value);
    const manager = new WalletManager({ adapters, autoConnect: false });
    connector.setWalletManager(manager);
    document.body.append(connector);
    element = connector;
    await connector.open();
    await vi.advanceTimersByTimeAsync(0);
    return { connector, manager, root: connector.getOverlayRoot()! };
  }

  it('ignores a structurally equal socialLogins assignment', async () => {
    const discover = vi.fn(async () => [{ id: 'email', label: 'Email' }]);
    const { connector, root } = await mount([
      createAdapter('social', { getLoginMethods: discover }),
    ]);
    const entries = () => [
      { id: 'google', label: 'Google', adapterId: 'social', connectOptions: { provider: 'g' } },
    ];
    connector.socialLogins = entries();
    await vi.advanceTimersByTimeAsync(0);
    connector.showSocialLoginList();
    await vi.advanceTimersByTimeAsync(0);
    expect(discover).toHaveBeenCalledTimes(1);

    connector.socialLogins = entries();
    await vi.advanceTimersByTimeAsync(0);
    expect(root.querySelector('[aria-label="Social sign-in methods"]')).not.toBeNull();
    expect(root.textContent).toContain('Email');
    expect(discover).toHaveBeenCalledTimes(1);

    connector.socialLogins = [{ ...entries()[0], label: 'Google Workspace' }];
    expect(root.querySelector('[aria-label="Social sign-in methods"]')).toBeNull();
  });

  it('applies the wallets filter to dynamically discovered adapters', async () => {
    const discover = vi.fn(async () => [{ id: 'email', label: 'Email' }]);
    const social = createAdapter('social', { getLoginMethods: discover });
    const { root } = await mount([createAdapter('xaman'), social], { wallets: 'xaman' });
    expect(root.querySelector('#social-login-button')).toBeNull();
    expect(root.querySelector('[data-wallet-id="xaman"]')).not.toBeNull();

    element!.disconnectedCallback();
    document.body.replaceChildren();
    const empty = await mount([social], { wallets: '' });
    expect(empty.root.querySelector('#social-login-button')).toBeNull();
    expect(discover).not.toHaveBeenCalled();
  });

  it('aborts pending discovery when the chooser closes', async () => {
    const signals: AbortSignal[] = [];
    const discover = vi.fn(({ signal }: { signal?: AbortSignal } = {}) => {
      signals.push(signal!);
      return new Promise<never>(() => {});
    });
    const { connector } = await mount([createAdapter('social', { getLoginMethods: discover })]);
    connector.showSocialLoginList();
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);
    connector.close();
    expect(signals[0].aborted).toBe(true);
  });

  it('cancels an auth prompt that arrives while the modal is closed', async () => {
    const cancel = vi.fn();
    const { connector, root } = await mount([createAdapter('social')]);
    connector.close();

    connector.showAuthPrompt({ title: 'Verify', submit: vi.fn(), cancel }, 'social', 'Social');

    expect(cancel).toHaveBeenCalledOnce();
    expect(root.querySelector('#auth-prompt-error')).toBeNull();
  });

  it('keeps a solved CAPTCHA while submitting and clears the pre-submit error', async () => {
    const submitted = deferred<void>();
    const submit = vi.fn(() => submitted.promise);
    const { connector, root } = await mount([createAdapter('social')]);
    connector.showAuthPrompt(
      {
        title: 'Verify',
        captcha: { provider: 'turnstile', siteKey: 'site' },
        submit,
        cancel: vi.fn(),
      },
      'social',
      'Social'
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(captcha.mounts).toHaveLength(1);

    await connector.submitAuthPrompt();
    const error = root.querySelector<HTMLElement>('#auth-prompt-error')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('Complete the CAPTCHA');

    captcha.mounts[0].onToken('token');
    expect(error.hidden).toBe(true);

    const submission = connector.submitAuthPrompt();
    await vi.advanceTimersByTimeAsync(0);
    expect(submit).toHaveBeenCalledWith({ captchaToken: 'token' });
    expect(captcha.mounts).toHaveLength(1);
    expect(captcha.mounts[0].cleanup).not.toHaveBeenCalled();
    const button = root.querySelector<HTMLButtonElement>('#auth-prompt-submit-button')!;
    expect(button.disabled).toBe(true);

    submitted.resolve();
    await submission;
    await vi.advanceTimersByTimeAsync(0);
    // The token is single-use, so a finished submission mounts a fresh challenge.
    expect(captcha.mounts[0].cleanup).toHaveBeenCalledOnce();
    expect(captcha.mounts).toHaveLength(2);
  });

  it('closes the account modal when disconnect ends without a disconnect event', async () => {
    const { connector, manager } = await mount([createAdapter('xaman')]);
    connector.close();
    let connected = true;
    vi.spyOn(manager, 'connected', 'get').mockImplementation(() => connected);
    vi.spyOn(manager, 'account', 'get').mockImplementation(() =>
      connected ? { address: 'rTest', network: NETWORK } : null
    );
    vi.spyOn(manager, 'disconnect').mockImplementation(async () => {
      connected = false;
    });
    connector.openAccountModal();
    expect(connector.getAccountModalRoot()?.querySelector('[role="dialog"]')).not.toBeNull();
    await connector.disconnectFromAccountModal();
    expect(connector.getAccountModalRoot()?.querySelector('[role="dialog"]')).toBeNull();
  });
});
