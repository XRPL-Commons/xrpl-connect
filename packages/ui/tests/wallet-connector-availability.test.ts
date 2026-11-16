import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { WalletManager, type WalletAdapter } from '@xrpl-connect/core';
import { WalletConnectorElement } from '../src/wallet-connector';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('WalletConnectorElement availability rendering', () => {
  const createWallet = (id: string, available: boolean, url?: string) =>
    ({
      id,
      name: id,
      url,
      isAvailable: vi.fn(async () => available),
    }) as unknown as WalletAdapter;

  const mount = (wallets: WalletAdapter[]) => {
    const Connector = WalletConnectorElement as typeof HTMLElement & {
      new (): HTMLElement & {
        socialLogins: readonly {
          id: string;
          label: string;
          adapterId: string;
          icon?: string;
          connectOptions?: Record<string, unknown>;
        }[];
        setWalletManager(manager: WalletManager): void;
        open(): Promise<void>;
        getOverlayRoot(): ShadowRoot | null;
      };
    };
    const connector = new Connector();
    connector.setWalletManager(new WalletManager({ adapters: wallets }));
    document.body.appendChild(connector);
    return connector;
  };

  it.each(['', ' , \t '])('shows no wallets for an explicitly empty filter %j', async (filter) => {
    const connector = mount([createWallet('available', true)]);
    connector.setAttribute('wallets', filter);

    await connector.open();
    await vi.waitFor(() =>
      expect(connector.getOverlayRoot()?.querySelector('[aria-busy="true"]')).toBeNull()
    );

    expect(connector.getOverlayRoot()?.querySelectorAll('[data-wallet-id]')).toHaveLength(0);
  });

  it('clears a populated list for an empty filter and restores it when the filter is removed', async () => {
    const connector = mount([createWallet('first', true), createWallet('second', true)]);
    const displayedWallets = () =>
      [...(connector.getOverlayRoot()?.querySelectorAll('[data-wallet-id]') ?? [])].map((button) =>
        button.getAttribute('data-wallet-id')
      );

    await connector.open();
    await vi.waitFor(() => expect(displayedWallets()).toEqual(['first', 'second']));

    connector.setAttribute('wallets', '');
    await vi.waitFor(() =>
      expect(connector.getOverlayRoot()?.querySelector('[aria-busy="true"]')).toBeNull()
    );
    expect(displayedWallets()).toEqual([]);

    connector.removeAttribute('wallets');
    await vi.waitFor(() => expect(displayedWallets()).toEqual(['first', 'second']));
  });

  it('does not render unavailable wallets as connectable after an empty availability check', async () => {
    const unavailableWallet = {
      id: 'unavailable',
      name: 'Unavailable Wallet',
      isAvailable: vi.fn(async () => false),
    } as unknown as WalletAdapter;
    const Connector = WalletConnectorElement as typeof HTMLElement & {
      new (): HTMLElement & {
        setWalletManager(manager: WalletManager): void;
        open(): Promise<void>;
        getOverlayRoot(): ShadowRoot | null;
      };
    };
    const connector = new Connector();
    connector.setWalletManager(new WalletManager({ adapters: [unavailableWallet] }));
    document.body.appendChild(connector);

    await connector.open();
    await vi.waitFor(() =>
      expect(connector.getOverlayRoot()?.querySelector('[aria-busy="true"]')).toBeNull()
    );

    const modal = connector.getOverlayRoot()?.innerHTML ?? '';
    expect(unavailableWallet.isAvailable).toHaveBeenCalledOnce();
    expect(modal).not.toContain('data-wallet-id="unavailable"');
    expect(modal).not.toContain('Unavailable Wallet');
  });

  it('shows a ready wallet before unrelated availability checks finish', async () => {
    vi.useFakeTimers();
    let resolveSlow!: (available: boolean) => void;
    const slow = createWallet('slow', false, 'https://example.com/install');
    slow.isAvailable = vi.fn(() => new Promise<boolean>((resolve) => (resolveSlow = resolve)));
    const ready = createWallet('gemwallet', true);
    const connector = mount([slow, ready]);
    connector.setAttribute('show-unavailable', '');
    await connector.open();
    await vi.advanceTimersByTimeAsync(0);

    expect(
      connector.getOverlayRoot()?.querySelector('[data-wallet-id="gemwallet"]')
    ).not.toBeNull();
    expect(
      connector.getOverlayRoot()?.querySelector('[role="region"]')?.getAttribute('aria-busy')
    ).toBe('true');
    expect(connector.getOverlayRoot()?.querySelector('[data-install-url]')).toBeNull();
    expect(ready.isAvailable).toHaveBeenCalledOnce();

    resolveSlow(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(
      connector.getOverlayRoot()?.querySelector('[role="region"]')?.getAttribute('aria-busy')
    ).toBe('false');
    expect(connector.getOverlayRoot()?.querySelector('[data-install-url]')).not.toBeNull();
  });

  it('probes a wallet that becomes configured while a check is in flight', async () => {
    vi.useFakeTimers();
    let resolveSlow!: (available: boolean) => void;
    const slow = createWallet('slow', true);
    slow.isAvailable = vi
      .fn(async () => true)
      .mockReturnValueOnce(new Promise<boolean>((resolve) => (resolveSlow = resolve)));
    let missing: readonly string[] = ['appId'];
    const late = createWallet('late', true);
    late.getMissingConfiguration = () => missing;
    const connector = mount([slow, late]);
    connector.setAttribute('wallets', 'slow,late');
    await connector.open();
    await vi.advanceTimersByTimeAsync(0);
    expect(late.isAvailable).not.toHaveBeenCalled();

    missing = [];
    resolveSlow(true);
    await vi.advanceTimersByTimeAsync(0);

    const root = connector.getOverlayRoot();
    expect(late.isAvailable).toHaveBeenCalledOnce();
    expect(root?.querySelector('[data-wallet-id="late"]')).not.toBeNull();
    expect(root?.querySelector('[data-wallet-id="slow"]')).not.toBeNull();
    expect(root?.querySelector('[role="region"]')?.getAttribute('aria-busy')).toBe('false');
  });

  it('rechecks a cached unavailable extension immediately when opening', async () => {
    vi.useFakeTimers();
    let installed = false;
    const wallet = createWallet('gemwallet', false);
    wallet.isAvailable = vi.fn(async () => installed);
    const connector = mount([wallet]);
    await vi.advanceTimersByTimeAsync(0);
    expect(wallet.isAvailable).toHaveBeenCalledOnce();

    installed = true;
    await connector.open();
    await vi.advanceTimersByTimeAsync(0);

    expect(
      connector.getOverlayRoot()?.querySelector('[data-wallet-id="gemwallet"]')
    ).not.toBeNull();
    expect(wallet.isAvailable).toHaveBeenCalledTimes(2);
  });

  it('detects a late extension promptly while open without polling while closed', async () => {
    vi.useFakeTimers();
    let installed = false;
    const wallet = createWallet('gemwallet', false);
    wallet.isAvailable = vi.fn(async () => installed);
    const connector = mount([wallet]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(wallet.isAvailable).toHaveBeenCalledOnce();

    await connector.open();
    await vi.advanceTimersByTimeAsync(0);
    expect(connector.getOverlayRoot()?.querySelector('[data-wallet-id="gemwallet"]')).toBeNull();
    installed = true;
    await vi.advanceTimersByTimeAsync(1000);

    expect(
      connector.getOverlayRoot()?.querySelector('[data-wallet-id="gemwallet"]')
    ).not.toBeNull();
    expect(wallet.isAvailable).toHaveBeenCalledTimes(3);
  });

  it('backs off rechecking a wallet that stays unavailable while open', async () => {
    vi.useFakeTimers();
    const wallet = createWallet('gemwallet', false);
    const connector = mount([wallet]);
    await vi.advanceTimersByTimeAsync(0);
    await connector.open();
    await vi.advanceTimersByTimeAsync(0);
    const probe = vi.mocked(wallet.isAvailable);
    const afterOpen = probe.mock.calls.length;

    // Quick retries cover an extension that is still injecting...
    await vi.advanceTimersByTimeAsync(2000);
    expect(probe.mock.calls.length).toBeGreaterThan(afterOpen);

    // ...then settle on the regular refresh instead of two probes a second.
    await vi.advanceTimersByTimeAsync(10_000);
    const settled = probe.mock.calls.length;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(probe.mock.calls.length - settled).toBeLessThanOrEqual(4);
  });

  it('recovers from a timed-out probe after the underlying SDK finishes', async () => {
    vi.useFakeTimers();
    let resolveProbe!: (available: boolean) => void;
    const wallet = createWallet('late', false);
    wallet.isAvailable = vi
      .fn()
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => (resolveProbe = resolve)))
      .mockResolvedValue(true);
    const connector = mount([wallet]);
    await connector.open();
    await vi.advanceTimersByTimeAsync(2000);
    expect(wallet.isAvailable).toHaveBeenCalledOnce();
    expect(connector.getOverlayRoot()?.querySelector('[data-wallet-id="late"]')).toBeNull();

    resolveProbe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(wallet.isAvailable).toHaveBeenCalledTimes(2);
    expect(connector.getOverlayRoot()?.querySelector('[data-wallet-id="late"]')).not.toBeNull();
  });

  it('ignores partial results from a replaced manager', async () => {
    vi.useFakeTimers();
    let resolveOld!: (available: boolean) => void;
    const old = createWallet('old', true);
    old.isAvailable = vi.fn(() => new Promise<boolean>((resolve) => (resolveOld = resolve)));
    const connector = mount([old]);
    await connector.open();
    connector.setWalletManager(new WalletManager({ adapters: [createWallet('new', true)] }));
    await vi.advanceTimersByTimeAsync(0);
    resolveOld(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(connector.getOverlayRoot()?.querySelector('[data-wallet-id="new"]')).not.toBeNull();
    expect(connector.getOverlayRoot()?.querySelector('[data-wallet-id="old"]')).toBeNull();
  });

  it('omits unconfigured wallets instead of presenting them as installable', async () => {
    const unconfiguredWallet = {
      id: 'unconfigured',
      name: 'Unconfigured Wallet',
      url: 'https://example.com/install',
      getMissingConfiguration: vi.fn(() => ['credential']),
      isAvailable: vi.fn(async () => true),
    } as unknown as WalletAdapter;
    const connector = mount([unconfiguredWallet]);
    connector.setAttribute('show-unavailable', '');

    await connector.open();
    await vi.waitFor(() =>
      expect(connector.getOverlayRoot()?.querySelector('[aria-busy="true"]')).toBeNull()
    );

    const modal = connector.getOverlayRoot()?.innerHTML ?? '';
    expect(unconfiguredWallet.getMissingConfiguration).toHaveBeenCalledWith(undefined);
    expect(unconfiguredWallet.isAvailable).not.toHaveBeenCalled();
    expect(modal).not.toContain('data-wallet-id="unconfigured"');
    expect(modal).not.toContain('Unconfigured Wallet');
  });

  it('renders configured social methods outside the normal wallet allowlist and hides duplicates', async () => {
    const normalWallet = createWallet('normal', true);
    const socialAdapter = {
      ...createWallet('social-adapter', true),
      getMissingConfiguration: vi.fn(() => []),
    } as WalletAdapter;
    const connector = mount([normalWallet, socialAdapter]);
    connector.setAttribute('wallets', 'normal');
    connector.socialLogins = [
      {
        id: 'google',
        label: 'Continue with Google',
        adapterId: 'social-adapter',
        connectOptions: { provider: 'google' },
      },
    ];

    await connector.open();
    await vi.waitFor(() =>
      expect(connector.getOverlayRoot()?.querySelector('[aria-busy="true"]')).toBeNull()
    );

    expect(connector.getOverlayRoot()?.querySelector('[data-wallet-id="normal"]')).not.toBeNull();
    expect(
      connector.getOverlayRoot()?.querySelector('[data-wallet-id="social-adapter"]')
    ).toBeNull();
    expect(connector.getOverlayRoot()?.querySelector('#social-login-button')).not.toBeNull();
    expect(connector.getOverlayRoot()?.querySelectorAll('[data-social-login-id]')).toHaveLength(0);

    connector.socialLogins = [
      { id: 'apple', label: 'Continue with Apple', adapterId: 'social-adapter' },
    ];
    await vi.waitFor(() =>
      expect(connector.getOverlayRoot()?.querySelector('#social-login-button')).not.toBeNull()
    );
    expect(connector.getOverlayRoot()?.querySelectorAll('[data-social-login-id]')).toHaveLength(0);
  });

  it('ignores malformed or unregistered social descriptors without hiding normal wallets', async () => {
    const connector = mount([createWallet('normal', true)]);
    connector.socialLogins = [
      { id: '', label: 'Missing ID', adapterId: 'normal' },
      { id: 'missing', label: 'Missing adapter', adapterId: 'unknown' },
    ];

    await connector.open();
    await vi.waitFor(() =>
      expect(connector.getOverlayRoot()?.querySelector('[aria-busy="true"]')).toBeNull()
    );

    expect(connector.getOverlayRoot()?.querySelector('[data-wallet-id="normal"]')).not.toBeNull();
    expect(connector.getOverlayRoot()?.querySelectorAll('[data-social-login-id]')).toHaveLength(0);
  });

  it('preserves unavailable slots while applying MRU order to available wallets', async () => {
    const connector = mount([
      createWallet('unavailable-first', false, 'https://example.com/first'),
      createWallet('available-first', true),
      createWallet('available-recent', true),
      createWallet('unavailable-last', false, 'https://example.com/last'),
    ]);
    connector.setAttribute('show-unavailable', '');
    localStorage.setItem('xrpl-connect:mru-wallets', JSON.stringify(['available-recent']));

    await connector.open();
    await vi.waitFor(() =>
      expect(connector.getOverlayRoot()?.querySelector('[aria-busy="true"]')).toBeNull()
    );

    const labels = [...(connector.getOverlayRoot()?.querySelectorAll('.wallet-button') ?? [])].map(
      (button) => button.querySelector('span')?.textContent
    );
    expect(labels).toEqual([
      'unavailable-first',
      'available-recent',
      'available-first',
      'unavailable-last',
    ]);
  });

  it('clears stale unavailable metadata when the manager changes', async () => {
    const connector = mount([createWallet('shared', false, 'https://old.example/install')]);
    connector.setAttribute('show-unavailable', '');
    await connector.open();
    await vi.waitFor(() =>
      expect(connector.getOverlayRoot()?.querySelector('[aria-busy="true"]')).toBeNull()
    );
    expect(connector.getOverlayRoot()?.innerHTML).toContain('https://old.example/install');

    const replacement = createWallet('shared', false, 'https://new.example/install');
    connector.setWalletManager(new WalletManager({ adapters: [replacement] }));

    expect(connector.getOverlayRoot()?.innerHTML).not.toContain('https://old.example/install');
  });
});
