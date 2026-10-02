import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { MemoryStorageAdapter, Storage, TIME, WalletManager } from '@xrpl-connect/core';
import type { NetworkInfo, WalletAdapter } from '@xrpl-connect/core';
import '../src/wallet-connector';
import { COLOR_ADJUSTMENT, TIMINGS } from '../src/constants';
import { adjustColorBrightness } from '../src/utils';

const NETWORK: NetworkInfo = { id: 'testnet', name: 'Testnet', wss: 'wss://example' };
const EXPLICIT_HOVER_COLORS = {
  '--xc-primary-button-hover-background': '#112233',
  '--xc-connect-button-hover-background': '#223344',
  '--xc-account-address-button-hover-color': '#334455',
} as const;
const DERIVED_HOVER_VARIABLES = {
  primary: '--derived-primary-button-hover-background',
  connect: '--derived-connect-button-hover-background',
  account: '--derived-account-address-button-hover-color',
} as const;

function derivedHoverColors(primaryColor: string, backgroundColor: string) {
  const primaryHover = adjustColorBrightness(primaryColor, COLOR_ADJUSTMENT.HOVER_BRIGHTNESS);
  const backgroundHover = adjustColorBrightness(backgroundColor, COLOR_ADJUSTMENT.HOVER_BRIGHTNESS);
  return {
    [DERIVED_HOVER_VARIABLES.primary]: primaryHover,
    [DERIVED_HOVER_VARIABLES.connect]: backgroundHover,
    [DERIVED_HOVER_VARIABLES.account]: primaryHover,
  };
}

function createAdapter(
  id: string,
  name: string,
  isAvailable: WalletAdapter['isAvailable']
): WalletAdapter {
  return {
    id,
    name,
    isAvailable,
    connect: vi.fn(async () => {
      throw new Error('not implemented');
    }),
    disconnect: vi.fn(async () => {}),
    getAccount: vi.fn(async () => null),
    getNetwork: vi.fn(async () => NETWORK),
    sign: vi.fn(async () => {
      throw new Error('not implemented');
    }),
    signAndSubmit: vi.fn(async () => {
      throw new Error('not implemented');
    }),
    signMessage: vi.fn(async () => {
      throw new Error('not implemented');
    }),
  };
}

function createConfiguredXamanAdapter(address = 'rXamanSession') {
  const account = { address, network: NETWORK };
  return {
    ...createAdapter(
      'xaman',
      'Xaman',
      vi.fn(async () => true)
    ),
    getMissingConfiguration: vi.fn(() => []),
    checkXamanState: vi.fn(async () => account),
    connect: vi.fn(async () => account),
  };
}

function createElement(manager: WalletManager) {
  const element = document.createElement('xrpl-wallet-connector') as HTMLElement & {
    setWalletManager(manager: WalletManager): void;
    open(): Promise<void>;
    close(): void;
    openAccountModal(): void;
    closeAccountModal(): void;
    disconnectedCallback(): void;
    getOverlayRoot(): ShadowRoot | null;
    getAccountModalRoot(): ShadowRoot | null;
    showWalletList(): void;
    showQRCodeView(walletId: string, uri?: string): void;
    setQRCode(walletId: string, uri: string): void;
  };
  element.setWalletManager(manager);
  return element;
}

describe('WalletConnector wallet availability', () => {
  let element: ReturnType<typeof createElement> | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    element?.disconnectedCallback();
    document.body.replaceChildren();
    document.body.style.overflow = '';
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it.each(['manager before mount', 'manager after mount'])(
    'starts passive discovery with %s and opens immediately',
    async (order) => {
      let resolveAvailability!: (available: boolean) => void;
      const probe = new Promise<boolean>((resolve) => {
        resolveAvailability = resolve;
      });
      const adapter = createAdapter(
        'slow',
        'Slow Wallet',
        vi.fn(() => probe)
      );
      const manager = new WalletManager({ adapters: [adapter], autoConnect: false });
      if (order === 'manager before mount') {
        element = createElement(manager);
        expect(adapter.isAvailable).not.toHaveBeenCalled();
        document.body.appendChild(element);
      } else {
        element = document.createElement('xrpl-wallet-connector') as ReturnType<
          typeof createElement
        >;
        document.body.appendChild(element);
        element.setWalletManager(manager);
      }
      expect(adapter.isAvailable).toHaveBeenCalledOnce();
      expect(element.getOverlayRoot()).toBeNull();
      const onOpen = vi.fn();
      element.addEventListener('open', onOpen);
      await expect(element.open()).resolves.toBeUndefined();
      expect(onOpen).toHaveBeenCalledOnce();
      const root = element.getOverlayRoot()!;
      expect(root.querySelector('[role="dialog"]')).not.toBeNull();
      expect(root.querySelector('[role="status"]')?.textContent).toBe('Finding available wallets…');
      expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(root.querySelector('[data-wallet-id]')).toBeNull();
      expect(adapter.connect).not.toHaveBeenCalled();
      await element.open();
      expect(adapter.isAvailable).toHaveBeenCalledOnce();
      resolveAvailability(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(root.querySelector('[data-wallet-id="slow"]')).not.toBeNull();
      expect(root.querySelector('[role="status"]')).toBeNull();
      expect(root.querySelector('[aria-busy="true"]')).toBeNull();
    }
  );

  it('bounds never-resolving discovery without delaying the dialog', async () => {
    const hung = createAdapter(
      'hung',
      'Hung',
      vi.fn(() => new Promise<boolean>(() => {}))
    );
    const available = createAdapter(
      'available',
      'Available',
      vi.fn(async () => true)
    );
    element = createElement(new WalletManager({ adapters: [hung, available] }));
    document.body.appendChild(element);
    await element.open();
    expect(element.getOverlayRoot()?.querySelector('[role="status"]')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(TIME.AVAILABILITY_TIMEOUT);
    expect(element.getOverlayRoot()?.querySelector('[role="status"]')).toBeNull();
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="available"]')).not.toBeNull();
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="hung"]')).toBeNull();
  });

  it('reuses mount results on immediate reopen and refreshes an open list without losing focus', async () => {
    const first = createAdapter(
      'first',
      'First',
      vi.fn(async () => true)
    );
    const injected = createAdapter(
      'injected',
      'Injected',
      vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    );
    element = createElement(new WalletManager({ adapters: [first, injected] }));
    document.body.appendChild(element);
    await vi.advanceTimersByTimeAsync(0);
    await element.open();
    element.close();
    void element.open();
    const root = element.getOverlayRoot()!;
    const button = root.querySelector<HTMLButtonElement>('[data-wallet-id="first"]')!;
    expect(button).not.toBeNull();
    expect(root.querySelector('[role="status"]')).toBeNull();
    expect(first.isAvailable).toHaveBeenCalledOnce();
    expect(injected.isAvailable).toHaveBeenCalledOnce();
    button.focus();
    await vi.advanceTimersByTimeAsync(TIMINGS.WALLET_AVAILABILITY_REFRESH);
    expect(root.querySelector('[data-wallet-id="injected"]')).not.toBeNull();
    expect(root.querySelector('[data-wallet-id="first"]')).toBe(button);
    expect(root.activeElement).toBe(button);
  });

  it('retains stale choices while refreshing and leaves an active connection view intact', async () => {
    let resolveRefresh!: (available: boolean) => void;
    const refresh = new Promise<boolean>((resolve) => {
      resolveRefresh = resolve;
    });
    const probe = vi.fn().mockResolvedValueOnce(true).mockReturnValueOnce(refresh);
    const adapter = createAdapter('walletconnect', 'WalletConnect', probe);
    element = createElement(new WalletManager({ adapters: [adapter] }));
    document.body.appendChild(element);
    await vi.advanceTimersByTimeAsync(0);
    await element.open();
    await vi.advanceTimersByTimeAsync(TIMINGS.WALLET_AVAILABILITY_REFRESH);
    const root = element.getOverlayRoot()!;
    expect(root.querySelector('[data-wallet-id="walletconnect"]')).not.toBeNull();
    element.showQRCodeView('walletconnect');
    const dialog = root.querySelector('[role="dialog"]');
    const focused = root.activeElement;
    await element.open();
    resolveRefresh(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(root.querySelector('[role="dialog"]')).toBe(dialog);
    expect(root.activeElement).toBe(focused);
    expect(root.querySelector('#qr-container')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(TIMINGS.WALLET_AVAILABILITY_REFRESH);
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('preserves the displayed QR when the allowlist changes during a connection flow', async () => {
    const xaman = createAdapter(
      'xaman',
      'Xaman',
      vi.fn(async () => true)
    );
    const other = createAdapter(
      'other',
      'Other',
      vi.fn(async () => true)
    );
    element = createElement(new WalletManager({ adapters: [xaman, other] }));
    element.setAttribute('wallets', 'xaman');
    document.body.appendChild(element);
    await vi.advanceTimersByTimeAsync(0);
    await element.open();
    element.showQRCodeView('xaman');
    element.setQRCode('xaman', 'https://xumm.app/sign/current.png');
    await vi.advanceTimersByTimeAsync(TIMINGS.QR_RENDER_DELAY);
    const root = element.getOverlayRoot()!;
    const image = root.querySelector<HTMLImageElement>('#qr-container img');
    const focused = root.activeElement;
    expect(image?.src).toBe('https://xumm.app/sign/current.png');
    element.setAttribute('wallets', 'other');
    await vi.advanceTimersByTimeAsync(0);
    expect(root.querySelector('#qr-container img')).toBe(image);
    expect(root.activeElement).toBe(focused);
    element.showWalletList();
    expect(root.querySelector('[data-wallet-id="xaman"]')).toBeNull();
    expect(root.querySelector('[data-wallet-id="other"]')).not.toBeNull();
  });

  it('reuses pending discovery across close and reopen without late open events', async () => {
    let resolveAvailability!: (available: boolean) => void;
    const probe = new Promise<boolean>((resolve) => {
      resolveAvailability = resolve;
    });
    const adapter = createAdapter(
      'wallet',
      'Wallet',
      vi.fn(() => probe)
    );
    element = createElement(new WalletManager({ adapters: [adapter] }));
    document.body.appendChild(element);
    const onOpen = vi.fn();
    element.addEventListener('open', onOpen);
    await element.open();
    element.close();
    await element.open();
    resolveAvailability(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(adapter.isAvailable).toHaveBeenCalledOnce();
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="wallet"]')).not.toBeNull();
    element.close();
    await vi.advanceTimersByTimeAsync(TIMINGS.WALLET_AVAILABILITY_REFRESH * 2);
    expect(adapter.isAvailable).toHaveBeenCalledOnce();
  });

  it('invalidates an in-flight allowlist and coalesces probes for overlapping wallets', async () => {
    let resolveOld!: (available: boolean) => void;
    const oldProbe = new Promise<boolean>((resolve) => {
      resolveOld = resolve;
    });
    const old = createAdapter(
      'old',
      'Old',
      vi.fn(() => oldProbe)
    );
    const current = createAdapter(
      'current',
      'Current',
      vi.fn(async () => true)
    );
    element = createElement(new WalletManager({ adapters: [old, current] }));
    element.setAttribute('wallets', 'old');
    document.body.appendChild(element);
    await element.open();
    element.setAttribute('wallets', 'old,current');
    expect(old.isAvailable).toHaveBeenCalledOnce();
    element.setAttribute('wallets', 'current');
    await vi.advanceTimersByTimeAsync(0);
    resolveOld(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(current.isAvailable).toHaveBeenCalledOnce();
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="old"]')).toBeNull();
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="current"]')).not.toBeNull();
  });

  it('invalidates cached adapters replaced within the same manager', async () => {
    const old = createAdapter(
      'wallet',
      'Old Wallet',
      vi.fn(async () => true)
    );
    const replacement = createAdapter(
      'wallet',
      'New Wallet',
      vi.fn(async () => true)
    );
    const manager = new WalletManager({ adapters: [old] });
    element = createElement(manager);
    document.body.appendChild(element);
    await vi.advanceTimersByTimeAsync(0);
    await element.open();
    element.close();
    manager.adapters.set('wallet', replacement);
    await element.open();
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id]')).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id]')?.textContent).toBe(
      'New Wallet'
    );
    expect(replacement.isAvailable).toHaveBeenCalledOnce();
  });

  it('ignores adapters replaced inside the manager during discovery', async () => {
    let resolveOld!: (available: boolean) => void;
    const oldProbe = new Promise<boolean>((resolve) => {
      resolveOld = resolve;
    });
    const old = createAdapter(
      'wallet',
      'Old Wallet',
      vi.fn(() => oldProbe)
    );
    const replacement = createAdapter(
      'wallet',
      'New Wallet',
      vi.fn(async () => true)
    );
    const manager = new WalletManager({ adapters: [old] });
    element = createElement(manager);
    document.body.appendChild(element);
    await element.open();
    manager.adapters.set('wallet', replacement);
    resolveOld(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id]')?.textContent).toBe(
      'New Wallet'
    );
    expect(replacement.isAvailable).toHaveBeenCalledOnce();
  });

  it('does not apply detached discovery and reuses its pending probe on remount', async () => {
    let resolveAvailability!: (available: boolean) => void;
    const probe = new Promise<boolean>((resolve) => {
      resolveAvailability = resolve;
    });
    const adapter = createAdapter(
      'wallet',
      'Wallet',
      vi.fn(() => probe)
    );
    element = createElement(new WalletManager({ adapters: [adapter] }));
    document.body.appendChild(element);
    await element.open();
    element.remove();
    document.body.appendChild(element);
    expect(adapter.isAvailable).toHaveBeenCalledOnce();
    resolveAvailability(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(element.getOverlayRoot()).toBeNull();
    await element.open();
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="wallet"]')).not.toBeNull();
    expect(adapter.isAvailable).toHaveBeenCalledOnce();
  });

  it.each([
    ['omitted', {}],
    ['false', { autoConnect: false }],
  ] as const)('does not restore Xaman on mount when autoConnect is %s', async (_label, options) => {
    const xaman = createConfiguredXamanAdapter();
    const manager = new WalletManager({ adapters: [xaman], ...options });
    element = createElement(manager);
    document.body.appendChild(element);

    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(xaman.checkXamanState).not.toHaveBeenCalled();
    expect(xaman.connect).not.toHaveBeenCalled();
    expect(manager.connected).toBe(false);
  });

  it('keeps explicit Xaman connect functional when autoConnect is disabled', async () => {
    const xaman = createConfiguredXamanAdapter();
    const manager = new WalletManager({ adapters: [xaman], autoConnect: false });
    element = createElement(manager);
    document.body.appendChild(element);

    await expect(manager.connect('xaman')).resolves.toMatchObject({ address: 'rXamanSession' });

    expect(xaman.checkXamanState).not.toHaveBeenCalled();
    expect(xaman.connect).toHaveBeenCalledOnce();
  });

  it.each([undefined, false, true])(
    'honors autoConnect=%s for an OAuth return without manager storage',
    async (autoConnect) => {
      const xaman = {
        ...createConfiguredXamanAdapter(),
        hasPendingConnection: vi.fn(() => true),
      };
      const manager = new WalletManager({
        adapters: [xaman],
        autoConnect,
        storage: new MemoryStorageAdapter(),
      });
      element = createElement(manager);
      document.body.appendChild(element);

      await vi.advanceTimersByTimeAsync(0);

      expect(manager.connected).toBe(autoConnect === true);
      expect(xaman.connect).toHaveBeenCalledTimes(autoConnect ? 1 : 0);
      expect(xaman.checkXamanState).not.toHaveBeenCalled();
      if (!autoConnect) {
        expect(xaman.hasPendingConnection).not.toHaveBeenCalled();
        await expect(manager.reconnect()).resolves.toMatchObject({ address: 'rXamanSession' });
        expect(xaman.connect).toHaveBeenCalledOnce();
      }
    }
  );

  it('cancels a pending wallet selection before returning to the wallet list', async () => {
    const walletConnect = createAdapter(
      'walletconnect',
      'WalletConnect',
      vi.fn(async () => true)
    );
    walletConnect.connect = vi.fn(() => new Promise(() => {}));
    const xaman = createAdapter(
      'xaman',
      'Xaman',
      vi.fn(async () => true)
    );
    xaman.connect = vi.fn(async () => ({ address: 'rXaman', network: NETWORK }));
    const manager = new WalletManager({ adapters: [walletConnect, xaman] });
    element = createElement(manager);

    void manager.connect('walletconnect');
    await vi.waitFor(() => expect(walletConnect.connect).toHaveBeenCalledOnce());

    element.showWalletList();
    await expect(manager.connect('xaman')).resolves.toMatchObject({ address: 'rXaman' });

    expect(walletConnect.disconnect).toHaveBeenCalledOnce();
    expect(manager.wallet).toBe(xaman);
  });

  it('cancels a pending wallet connection when detached', async () => {
    let resolveConnection!: (account: { address: string; network: NetworkInfo }) => void;
    const walletConnect = createAdapter(
      'walletconnect',
      'WalletConnect',
      vi.fn(async () => true)
    );
    walletConnect.connect = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveConnection = resolve;
        })
    );
    const manager = new WalletManager({
      adapters: [walletConnect],
      storage: new MemoryStorageAdapter(),
    });
    element = createElement(manager);
    document.body.appendChild(element);

    const connection = manager.connect('walletconnect');
    await vi.advanceTimersByTimeAsync(0);
    expect(walletConnect.connect).toHaveBeenCalledOnce();
    element.remove();
    await vi.advanceTimersByTimeAsync(0);
    expect(walletConnect.disconnect).toHaveBeenCalled();
    resolveConnection({ address: 'rWalletConnect', network: NETWORK });

    await expect(connection).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
    expect(manager.connected).toBe(false);
    expect(manager.wallet).toBeNull();
  });

  it('does not cancel an in-flight connection owned by a replaced manager', async () => {
    let resolveConnection!: (account: { address: string; network: NetworkInfo }) => void;
    const firstAdapter = createAdapter(
      'first',
      'First Wallet',
      vi.fn(async () => true)
    );
    firstAdapter.connect = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveConnection = resolve;
        })
    );
    const firstManager = new WalletManager({ adapters: [firstAdapter] });
    const secondManager = new WalletManager({ adapters: [] });
    element = createElement(firstManager);

    const connection = firstManager.connect('first');
    await vi.waitFor(() => expect(firstAdapter.connect).toHaveBeenCalledOnce());
    element.setWalletManager(secondManager);
    resolveConnection({ address: 'rFirst', network: NETWORK });

    await expect(connection).resolves.toMatchObject({ address: 'rFirst' });
    expect(firstAdapter.disconnect).not.toHaveBeenCalled();
    expect(firstManager.connected).toBe(true);
    expect(secondManager.connected).toBe(false);
  });

  it('retries unavailable wallets on a later open and renders them when they appear', async () => {
    const isAvailable = vi
      .fn<WalletAdapter['isAvailable']>()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const adapter = createAdapter('unavailable', 'Unavailable Wallet', isAvailable);
    element = createElement(new WalletManager({ adapters: [adapter] }));

    await element.open();
    await vi.advanceTimersByTimeAsync(0);

    const overlay = element.getOverlayRoot();
    expect(overlay?.querySelector('[data-wallet-id="unavailable"]')).toBeNull();
    expect(overlay?.querySelector('.wallet-empty')?.textContent).toContain(
      'No wallets are currently available.'
    );

    element.close();
    await vi.advanceTimersByTimeAsync(TIMINGS.WALLET_AVAILABILITY_REFRESH);
    await element.open();
    await vi.advanceTimersByTimeAsync(0);

    expect(isAvailable).toHaveBeenCalledTimes(2);
    expect(
      element.getOverlayRoot()?.querySelector('[data-wallet-id="unavailable"]')
    ).not.toBeNull();
  });

  it('refreshes stale availability while retaining cached choices until completion', async () => {
    const availableProbe = vi
      .fn<WalletAdapter['isAvailable']>()
      .mockResolvedValueOnce(true)
      .mockResolvedValue(true);
    const recoveringProbe = vi
      .fn<WalletAdapter['isAvailable']>()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const available = createAdapter('available', 'Available Wallet', availableProbe);
    const recovering = createAdapter('recovering', 'Recovering Wallet', recoveringProbe);
    element = createElement(new WalletManager({ adapters: [available, recovering] }));

    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    element.close();
    await vi.advanceTimersByTimeAsync(TIMINGS.WALLET_AVAILABILITY_REFRESH);
    await element.open();
    await vi.advanceTimersByTimeAsync(0);

    expect(availableProbe).toHaveBeenCalledTimes(2);
    expect(recoveringProbe).toHaveBeenCalledTimes(2);
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="available"]')).not.toBeNull();
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="recovering"]')).not.toBeNull();
  });

  it('retries timed-out wallets on a later open and renders them when they recover', async () => {
    let resolveFirst!: (available: boolean) => void;
    const firstProbe = new Promise<boolean>((resolve) => {
      resolveFirst = resolve;
    });
    const isAvailable = vi
      .fn<WalletAdapter['isAvailable']>()
      .mockReturnValueOnce(firstProbe)
      .mockResolvedValue(true);
    const adapter = createAdapter('slow', 'Slow Wallet', isAvailable);
    element = createElement(new WalletManager({ adapters: [adapter] }));

    const firstOpen = element.open();
    await vi.advanceTimersByTimeAsync(TIME.AVAILABILITY_TIMEOUT);
    await firstOpen;
    expect(isAvailable).toHaveBeenCalledTimes(1);
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="slow"]')).toBeNull();

    element.close();
    await vi.advanceTimersByTimeAsync(TIMINGS.WALLET_AVAILABILITY_REFRESH);
    await element.open();
    await vi.advanceTimersByTimeAsync(0);

    expect(isAvailable).toHaveBeenCalledTimes(2);
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="slow"]')).not.toBeNull();

    resolveFirst(true);
    await Promise.resolve();
  });

  it('clears cached availability when the wallet manager changes', async () => {
    const firstAdapter = createAdapter(
      'first',
      'First Wallet',
      vi.fn(async () => true)
    );
    const secondAdapter = createAdapter(
      'second',
      'Second Wallet',
      vi.fn(async () => true)
    );
    element = createElement(new WalletManager({ adapters: [firstAdapter] }));

    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="first"]')).not.toBeNull();

    element.close();
    element.setWalletManager(new WalletManager({ adapters: [secondAdapter] }));
    await element.open();
    await vi.advanceTimersByTimeAsync(0);

    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="first"]')).toBeNull();
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="second"]')).not.toBeNull();
  });

  it('invalidates cached availability when the wallets allowlist changes', async () => {
    const firstAvailable = vi.fn(async () => true);
    const secondAvailable = vi.fn(async () => true);
    const firstAdapter = createAdapter('first', 'First Wallet', firstAvailable);
    const secondAdapter = createAdapter('second', 'Second Wallet', secondAvailable);
    element = createElement(new WalletManager({ adapters: [firstAdapter, secondAdapter] }));
    element.setAttribute('wallets', 'first');

    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="first"]')).not.toBeNull();
    expect(secondAvailable).not.toHaveBeenCalled();

    element.close();
    element.setAttribute('wallets', 'second');
    await element.open();
    await vi.advanceTimersByTimeAsync(0);

    expect(firstAvailable).toHaveBeenCalledTimes(1);
    expect(secondAvailable).toHaveBeenCalledTimes(1);
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="first"]')).toBeNull();
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="second"]')).not.toBeNull();
  });

  it('ignores an old manager availability check that finishes after replacement', async () => {
    let resolveFirst!: (available: boolean) => void;
    const firstProbe = new Promise<boolean>((resolve) => {
      resolveFirst = resolve;
    });
    const firstAdapter = createAdapter(
      'first',
      'First Wallet',
      vi.fn(() => firstProbe)
    );
    const secondAdapter = createAdapter(
      'second',
      'Second Wallet',
      vi.fn(async () => true)
    );
    element = createElement(new WalletManager({ adapters: [firstAdapter] }));

    const firstOpen = element.open();
    element.setWalletManager(new WalletManager({ adapters: [secondAdapter] }));
    await vi.advanceTimersByTimeAsync(0);

    resolveFirst(true);
    await firstOpen;

    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="first"]')).toBeNull();
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="second"]')).not.toBeNull();
  });

  it('coalesces repeated opens during initial discovery', async () => {
    let resolveFirst!: (available: boolean) => void;
    const firstProbe = new Promise<boolean>((resolve) => {
      resolveFirst = resolve;
    });
    const isAvailable = vi
      .fn<WalletAdapter['isAvailable']>()
      .mockReturnValueOnce(firstProbe)
      .mockResolvedValue(true);
    const adapter = createAdapter('wallet', 'Wallet', isAvailable);
    element = createElement(new WalletManager({ adapters: [adapter] }));

    const firstOpen = element.open();
    const secondOpen = element.open();
    await secondOpen;

    resolveFirst(true);
    await firstOpen;
    await vi.advanceTimersByTimeAsync(0);

    expect(isAvailable).toHaveBeenCalledTimes(1);
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="wallet"]')).not.toBeNull();
  });

  it('does not reopen after the modal is closed during an availability check', async () => {
    let resolveAvailability!: (available: boolean) => void;
    const availability = new Promise<boolean>((resolve) => {
      resolveAvailability = resolve;
    });
    const adapter = createAdapter(
      'wallet',
      'Wallet',
      vi.fn(() => availability)
    );
    element = createElement(new WalletManager({ adapters: [adapter] }));
    const onOpen = vi.fn();
    element.addEventListener('open', onOpen);

    const opening = element.open();
    element.close();
    resolveAvailability(true);
    await opening;

    await vi.advanceTimersByTimeAsync(0);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(element.getOverlayRoot()?.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('restores the original body overflow after the final connector closes', async () => {
    document.body.style.overflow = 'clip';
    const manager = new WalletManager({ adapters: [] });
    element = createElement(manager);
    const secondElement = createElement(manager);

    try {
      await element.open();
      await vi.advanceTimersByTimeAsync(0);
      await secondElement.open();
      expect(document.body.style.overflow).toBe('hidden');

      element.close();
      expect(document.body.style.overflow).toBe('hidden');

      secondElement.close();
      expect(document.body.style.overflow).toBe('clip');
    } finally {
      secondElement.disconnectedCallback();
    }
  });

  it('does not restore Xaman when the wallet manager is replaced', async () => {
    const firstXaman = createConfiguredXamanAdapter('rFirstXaman');
    const secondXaman = createConfiguredXamanAdapter('rSecondXaman');
    const firstManager = new WalletManager({ adapters: [firstXaman], autoConnect: false });
    const replacementManager = new WalletManager({ adapters: [secondXaman], autoConnect: false });
    element = createElement(firstManager);
    document.body.appendChild(element);
    element.setWalletManager(replacementManager);

    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(firstXaman.checkXamanState).not.toHaveBeenCalled();
    expect(secondXaman.checkXamanState).not.toHaveBeenCalled();
    expect(firstXaman.connect).not.toHaveBeenCalled();
    expect(secondXaman.connect).not.toHaveBeenCalled();
    expect(replacementManager.connected).toBe(false);
  });

  it('restores a persisted Xaman session only through explicit manager.reconnect', async () => {
    const storage = new MemoryStorageAdapter();
    await new Storage(storage).saveState({
      walletId: 'xaman',
      account: { address: 'rStoredXaman', network: NETWORK },
      network: NETWORK,
      timestamp: Date.now(),
    });
    const xaman = createConfiguredXamanAdapter('rStoredXaman');
    const manager = new WalletManager({ adapters: [xaman], autoConnect: false, storage });
    element = createElement(manager);
    document.body.appendChild(element);

    await expect(manager.reconnect()).resolves.toMatchObject({ address: 'rStoredXaman' });

    expect(xaman.checkXamanState).not.toHaveBeenCalled();
    expect(xaman.connect).toHaveBeenCalledOnce();
  });

  it('preserves manager autoConnect restoration for Xaman without a UI probe', async () => {
    const storage = new MemoryStorageAdapter();
    await new Storage(storage).saveState({
      walletId: 'xaman',
      account: { address: 'rAutoXaman', network: NETWORK },
      network: NETWORK,
      timestamp: Date.now(),
    });
    const xaman = createConfiguredXamanAdapter('rAutoXaman');
    const manager = new WalletManager({ adapters: [xaman], autoConnect: true, storage });
    element = createElement(manager);
    document.body.appendChild(element);

    await vi.waitFor(() => expect(manager.connected).toBe(true));

    expect(xaman.checkXamanState).not.toHaveBeenCalled();
    expect(xaman.connect).toHaveBeenCalledOnce();
  });

  it('does not disconnect a manager-owned WalletConnect session when closing the modal', async () => {
    const preInitialize = vi.fn(async () => {});
    const walletConnect = {
      ...createAdapter(
        'walletconnect',
        'WalletConnect',
        vi.fn(async () => true)
      ),
      connect: vi.fn(async () => ({ address: 'rWalletConnect', network: NETWORK })),
      preInitialize,
    };
    const manager = new WalletManager({ adapters: [walletConnect] });
    await manager.connect('walletconnect');
    element = createElement(manager);
    document.body.appendChild(element);

    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    element.close();

    expect(preInitialize).not.toHaveBeenCalled();
    expect(walletConnect.disconnect).not.toHaveBeenCalled();
    expect(manager.connected).toBe(true);
    expect(manager.wallet).toBe(walletConnect);
  });

  it('does not disconnect a shared manager when rebinding the connector', async () => {
    const sharedAdapter = createAdapter(
      'shared',
      'Shared Wallet',
      vi.fn(async () => true)
    );
    sharedAdapter.connect = vi.fn(async () => ({ address: 'rShared', network: NETWORK }));
    const sharedManager = new WalletManager({ adapters: [sharedAdapter] });
    await sharedManager.connect('shared');
    const replacementManager = new WalletManager({ adapters: [] });
    element = createElement(sharedManager);

    element.setWalletManager(replacementManager);

    expect(sharedAdapter.disconnect).not.toHaveBeenCalled();
    expect(sharedManager.connected).toBe(true);
    expect(sharedManager.wallet).toBe(sharedAdapter);
  });

  it('does not claim an external active session when its UI attempt is rejected', async () => {
    const sharedAdapter = createAdapter(
      'shared',
      'Shared Wallet',
      vi.fn(async () => true)
    );
    sharedAdapter.connect = vi.fn(async () => ({ address: 'rShared', network: NETWORK }));
    const xaman = {
      ...createAdapter(
        'xaman',
        'Xaman',
        vi.fn(async () => true)
      ),
      getMissingConfiguration: vi.fn(() => []),
      checkXamanState: vi.fn(async () => null),
    };
    const sharedManager = new WalletManager({ adapters: [sharedAdapter, xaman] });
    await sharedManager.connect('shared');
    const replacementManager = new WalletManager({ adapters: [] });
    element = createElement(sharedManager);

    const rejectedAttempt = (
      element as unknown as {
        walletService: { connectWallet(walletId: string): Promise<void> };
      }
    ).walletService.connectWallet('xaman');
    element.setWalletManager(replacementManager);
    await rejectedAttempt;

    expect(sharedAdapter.disconnect).not.toHaveBeenCalled();
    expect(sharedManager.connected).toBe(true);
    expect(sharedManager.wallet).toBe(sharedAdapter);
  });

  it('cancels a connector-owned pending session when rebinding the manager', async () => {
    let resolveConnection!: (account: AccountInfo) => void;
    let finishDisconnect!: () => void;
    const walletConnect = {
      ...createAdapter(
        'walletconnect',
        'WalletConnect',
        vi.fn(async () => true)
      ),
      preInitialize: vi.fn(async () => {}),
      connect: vi.fn(() => new Promise<AccountInfo>((resolve) => (resolveConnection = resolve))),
      disconnect: vi.fn(() => new Promise<void>((resolve) => (finishDisconnect = resolve))),
    };
    const previousManager = new WalletManager({ adapters: [walletConnect] });
    const replacementManager = new WalletManager({ adapters: [] });
    element = createElement(previousManager);
    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => expect(walletConnect.preInitialize).toHaveBeenCalledOnce());

    const connection = (
      element as unknown as {
        walletService: { connectWallet(walletId: string): Promise<void> };
      }
    ).walletService.connectWallet('walletconnect');
    await vi.waitFor(() => expect(walletConnect.connect).toHaveBeenCalledOnce());

    element.setWalletManager(replacementManager);
    await vi.waitFor(() => expect(walletConnect.disconnect).toHaveBeenCalledOnce());
    resolveConnection({ address: 'rStaleWalletConnect', network: NETWORK });
    await Promise.resolve();
    finishDisconnect();
    await connection;

    expect(previousManager.connected).toBe(false);
    expect(walletConnect.disconnect).toHaveBeenCalledOnce();
    expect(replacementManager.connected).toBe(false);
  });

  it('cancels and ignores WalletConnect pre-initialization after close', async () => {
    let publishQRCode!: (uri: string) => void;
    const walletConnect = {
      ...createAdapter(
        'walletconnect',
        'WalletConnect',
        vi.fn(async () => true)
      ),
      preInitialize: vi.fn(async (_network, onQRCode?: (uri: string) => void) => {
        publishQRCode = onQRCode!;
      }),
    };
    element = createElement(new WalletManager({ adapters: [walletConnect] }));
    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => expect(walletConnect.preInitialize).toHaveBeenCalledOnce());

    element.close();
    publishQRCode('wc:stale-proposal');
    await vi.advanceTimersByTimeAsync(0);

    expect(walletConnect.disconnect).toHaveBeenCalledOnce();
    expect((element as unknown as { preGeneratedURI: string | null }).preGeneratedURI).toBeNull();
  });

  it('lets the manager exclusively tear down an in-flight WalletConnect attempt', async () => {
    let resolveConnection!: (account: AccountInfo) => void;
    let finishDisconnect!: () => void;
    const walletConnect = {
      ...createAdapter(
        'walletconnect',
        'WalletConnect',
        vi.fn(async () => true)
      ),
      preInitialize: vi.fn(async () => {}),
      connect: vi.fn(() => new Promise<AccountInfo>((resolve) => (resolveConnection = resolve))),
      disconnect: vi.fn(() => new Promise<void>((resolve) => (finishDisconnect = resolve))),
    };
    element = createElement(new WalletManager({ adapters: [walletConnect] }));
    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => expect(walletConnect.preInitialize).toHaveBeenCalledOnce());

    const connection = (
      element as unknown as {
        walletService: { connectWallet(walletId: string): Promise<void> };
      }
    ).walletService.connectWallet('walletconnect');
    await vi.waitFor(() => expect(walletConnect.connect).toHaveBeenCalledOnce());

    element.showWalletList();
    await vi.waitFor(() => expect(walletConnect.disconnect).toHaveBeenCalledOnce());
    resolveConnection({ address: 'rCancelledWalletConnect', network: NETWORK });
    await Promise.resolve();
    expect(walletConnect.disconnect).toHaveBeenCalledOnce();

    finishDisconnect();
    await connection;
    expect(walletConnect.disconnect).toHaveBeenCalledOnce();
  });

  it('settles the public cancelled event when returning to the wallet list', async () => {
    let resolveConnection!: (account: AccountInfo) => void;
    const adapter = createAdapter(
      'wallet',
      'Wallet',
      vi.fn(async () => true)
    );
    adapter.connect = vi.fn(
      () => new Promise<AccountInfo>((resolve) => (resolveConnection = resolve))
    );
    element = createElement(new WalletManager({ adapters: [adapter] }));
    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    const onCancelled = vi.fn();
    element.addEventListener('cancelled', onCancelled);

    const connection = (
      element as unknown as {
        walletService: { connectWallet(walletId: string): Promise<void> };
      }
    ).walletService.connectWallet('wallet');
    await vi.advanceTimersByTimeAsync(TIMINGS.NON_SAFARI_CONNECT_DELAY);
    await vi.waitFor(() => expect(adapter.connect).toHaveBeenCalledOnce());
    element.showWalletList();

    expect(onCancelled).toHaveBeenCalledOnce();
    expect(onCancelled.mock.calls[0]?.[0]).toMatchObject({
      detail: { reason: 'wallet-list', connectionAttemptId: 1 },
    });

    resolveConnection({ address: 'rCancelled', network: NETWORK });
    await connection;
  });

  it('emits connected before closing a real UI-owned manager connection', async () => {
    const adapter = createAdapter(
      'wallet',
      'Wallet',
      vi.fn(async () => true)
    );
    adapter.connect = vi.fn(async () => ({ address: 'rConnected', network: NETWORK }));
    const manager = new WalletManager({
      adapters: [adapter],
      storage: new MemoryStorageAdapter(),
    });
    element = createElement(manager);
    document.body.appendChild(element);

    const events: string[] = [];
    let connectedDetail: Record<string, unknown> | undefined;
    element.addEventListener('connecting', () => events.push('connecting'));
    element.addEventListener('connected', (event) => {
      events.push('connected');
      connectedDetail = (event as CustomEvent<Record<string, unknown>>).detail;
    });
    element.addEventListener('close', () => events.push('close'));

    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    const walletButton = element
      .getOverlayRoot()
      ?.querySelector<HTMLButtonElement>('[data-wallet-id="wallet"]');
    expect(walletButton).not.toBeNull();
    walletButton!.click();

    await vi.advanceTimersByTimeAsync(TIMINGS.NON_SAFARI_CONNECT_DELAY);
    await vi.waitFor(() => expect(manager.connected).toBe(true));

    expect(events.filter((event) => event === 'connected')).toHaveLength(1);
    expect(events.indexOf('connected')).toBeLessThan(events.indexOf('close'));
    expect(connectedDetail).toEqual({
      walletId: 'wallet',
      connectionAttemptId: expect.any(Number),
    });
  });

  it('resolves openAndWait before a connected listener closes the connector', async () => {
    const adapter = createAdapter(
      'wallet',
      'Wallet',
      vi.fn(async () => true)
    );
    adapter.connect = vi.fn(async () => ({ address: 'rConnected', network: NETWORK }));
    const manager = new WalletManager({ adapters: [adapter] });
    element = createElement(manager);

    const events: string[] = [];
    element.addEventListener('connected', () => {
      events.push('connected');
      element!.close();
    });
    element.addEventListener('close', () => events.push('close'));

    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    const connection = (
      element as unknown as {
        openAndWait(): Promise<{ address: string; network: NetworkInfo }>;
      }
    ).openAndWait();
    await vi.waitFor(() =>
      expect(
        element.getOverlayRoot()?.querySelector<HTMLButtonElement>('[data-wallet-id="wallet"]')
      ).not.toBeNull()
    );
    element
      .getOverlayRoot()
      ?.querySelector<HTMLButtonElement>('[data-wallet-id="wallet"]')
      ?.click();

    await vi.advanceTimersByTimeAsync(TIMINGS.NON_SAFARI_CONNECT_DELAY);
    await vi.waitFor(() => expect(manager.connected).toBe(true));
    await expect(connection).resolves.toMatchObject({ address: 'rConnected' });
    expect(events).toEqual(['connected', 'close']);
  });

  it('does not close a replacement manager after a connected listener rebinds it', async () => {
    const adapter = createAdapter(
      'wallet',
      'Wallet',
      vi.fn(async () => true)
    );
    adapter.connect = vi.fn(async () => ({ address: 'rConnected', network: NETWORK }));
    const manager = new WalletManager({ adapters: [adapter] });
    const replacementManager = new WalletManager({ adapters: [] });
    element = createElement(manager);

    const onClose = vi.fn();
    element.addEventListener('connected', () => element!.setWalletManager(replacementManager));
    element.addEventListener('close', onClose);

    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    element
      .getOverlayRoot()
      ?.querySelector<HTMLButtonElement>('[data-wallet-id="wallet"]')
      ?.click();
    await vi.waitFor(() => expect(manager.connected).toBe(true));

    expect(element.walletManager).toBe(replacementManager);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('refreshes the closed connector after an external manager connection', async () => {
    const adapter = createAdapter(
      'wallet',
      'Wallet',
      vi.fn(async () => true)
    );
    adapter.connect = vi.fn(async () => ({ address: 'rExternal', network: NETWORK }));
    const manager = new WalletManager({ adapters: [adapter] });
    element = createElement(manager);

    const onConnected = vi.fn();
    const onClose = vi.fn();
    element.addEventListener('connected', onConnected);
    element.addEventListener('close', onClose);
    const getConnectButton = () =>
      element.shadowRoot?.querySelector<HTMLButtonElement>('#connect-wallet-button');
    expect(getConnectButton()?.textContent).toBe('Connect Wallet');

    await manager.connect('wallet');

    expect(onConnected).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(getConnectButton()?.textContent).toBe('rExt...rnal');
  });

  it('emits connected before closing a WalletConnect desktop connection', async () => {
    const walletConnect = {
      ...createAdapter(
        'walletconnect',
        'WalletConnect',
        vi.fn(async () => true)
      ),
      options: { useModal: false, modalMode: 'never' as const },
      connect: vi.fn(async () => ({ address: 'rWalletConnectDesktop', network: NETWORK })),
    };
    const manager = new WalletManager({ adapters: [walletConnect] });
    element = createElement(manager);

    const events: string[] = [];
    let connectedDetail: Record<string, unknown> | undefined;
    element.addEventListener('connected', (event) => {
      events.push('connected');
      connectedDetail = (event as CustomEvent<Record<string, unknown>>).detail;
    });
    element.addEventListener('close', () => events.push('close'));

    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    element
      .getOverlayRoot()
      ?.querySelector<HTMLButtonElement>('[data-wallet-id="walletconnect"]')
      ?.click();
    await vi.waitFor(() => expect(manager.connected).toBe(true));

    expect(events).toEqual(['connected', 'close']);
    expect(connectedDetail).toEqual({
      walletId: 'walletconnect',
      connectionAttemptId: expect.any(Number),
    });
  });

  it('emits connected before closing a WalletConnect mobile modal connection', async () => {
    const walletConnect = {
      ...createAdapter(
        'walletconnect',
        'WalletConnect',
        vi.fn(async () => true)
      ),
      options: { useModal: true, modalMode: 'always' as const },
      connect: vi.fn(async () => ({ address: 'rWalletConnectMobile', network: NETWORK })),
    };
    const manager = new WalletManager({ adapters: [walletConnect] });
    element = createElement(manager);

    const events: string[] = [];
    let connectedDetail: Record<string, unknown> | undefined;
    element.addEventListener('connected', (event) => {
      events.push('connected');
      connectedDetail = (event as CustomEvent<Record<string, unknown>>).detail;
    });
    element.addEventListener('close', () => events.push('close'));

    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    element
      .getOverlayRoot()
      ?.querySelector<HTMLButtonElement>('[data-wallet-id="walletconnect"]')
      ?.click();
    await vi.advanceTimersByTimeAsync(TIMINGS.NON_SAFARI_CONNECT_DELAY);
    await vi.waitFor(() => expect(manager.connected).toBe(true));

    expect(events).toEqual(['connected', 'close']);
    expect(connectedDetail).toEqual({
      walletId: 'walletconnect',
      connectionAttemptId: expect.any(Number),
    });
  });

  it('emits the account index when a Ledger account connection settles', async () => {
    const ledger = {
      ...createAdapter(
        'ledger',
        'Ledger',
        vi.fn(async () => true)
      ),
      getAccounts: vi.fn(async () => [
        { address: 'rLedger0', publicKey: 'ED0', path: "44'/144'/0'/0/0", index: 0 },
      ]),
      connect: vi.fn(async () => ({ address: 'rLedger0', network: NETWORK })),
    };
    const manager = new WalletManager({ adapters: [ledger] });
    element = createElement(manager);

    const events: string[] = [];
    let connectedDetail: Record<string, unknown> | undefined;
    element.addEventListener('connected', (event) => {
      events.push('connected');
      connectedDetail = (event as CustomEvent<Record<string, unknown>>).detail;
    });
    element.addEventListener('close', () => events.push('close'));

    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    element
      .getOverlayRoot()
      ?.querySelector<HTMLButtonElement>('[data-wallet-id="ledger"]')
      ?.click();
    await vi.advanceTimersByTimeAsync(TIMINGS.NON_SAFARI_CONNECT_DELAY);
    await vi.waitFor(() => expect(ledger.getAccounts).toHaveBeenCalledOnce());
    element.getOverlayRoot()?.querySelector<HTMLButtonElement>('.account-button')?.click();
    await vi.advanceTimersByTimeAsync(TIMINGS.NON_SAFARI_CONNECT_DELAY);
    await vi.waitFor(() => expect(manager.connected).toBe(true));

    expect(events).toEqual(['connected', 'close']);
    expect(connectedDetail).toEqual({
      walletId: 'ledger',
      accountIndex: 0,
      connectionAttemptId: expect.any(Number),
    });
  });

  it('emits the derivation path when a custom Ledger connection settles', async () => {
    const ledger = {
      ...createAdapter(
        'ledger',
        'Ledger',
        vi.fn(async () => true)
      ),
      getAccounts: vi.fn(async () => []),
      connect: vi.fn(async () => ({ address: 'rLedgerCustom', network: NETWORK })),
    };
    const manager = new WalletManager({ adapters: [ledger] });
    element = createElement(manager);

    const events: string[] = [];
    let connectedDetail: Record<string, unknown> | undefined;
    element.addEventListener('connected', (event) => {
      events.push('connected');
      connectedDetail = (event as CustomEvent<Record<string, unknown>>).detail;
    });
    element.addEventListener('close', () => events.push('close'));

    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    element
      .getOverlayRoot()
      ?.querySelector<HTMLButtonElement>('[data-wallet-id="ledger"]')
      ?.click();
    await vi.advanceTimersByTimeAsync(TIMINGS.NON_SAFARI_CONNECT_DELAY);
    await vi.waitFor(() => expect(ledger.getAccounts).toHaveBeenCalledOnce());
    const derivationPath = "44'/144'/7'/0/3";
    const input = element
      .getOverlayRoot()
      ?.querySelector<HTMLInputElement>('#custom-derivation-path');
    expect(input).not.toBeNull();
    input!.value = derivationPath;
    element
      .getOverlayRoot()
      ?.querySelector<HTMLButtonElement>('#custom-path-connect-button')
      ?.click();
    await vi.advanceTimersByTimeAsync(TIMINGS.NON_SAFARI_CONNECT_DELAY);
    await vi.waitFor(() => expect(manager.connected).toBe(true));

    expect(events).toEqual(['connected', 'close']);
    expect(connectedDetail).toEqual({
      walletId: 'ledger',
      derivationPath,
      connectionAttemptId: expect.any(Number),
    });
  });

  it('does not emit cancelled when returning from an already-settled error', async () => {
    const adapter = createAdapter(
      'wallet',
      'Wallet',
      vi.fn(async () => true)
    );
    element = createElement(new WalletManager({ adapters: [adapter] }));
    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    const onCancelled = vi.fn();
    element.addEventListener('cancelled', onCancelled);

    element.showErrorView('wallet', 'Wallet', new Error('settled'));
    element.showWalletList();

    expect(onCancelled).not.toHaveBeenCalled();
  });

  it('does not render a QR code scheduled by an earlier modal session', async () => {
    element = createElement(new WalletManager({ adapters: [] }));
    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    element.showQRCodeView('xaman');
    element.setQRCode('xaman', 'https://xumm.app/sign/stale.png');

    element.close();
    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    element.showQRCodeView('xaman');
    const currentUri = 'https://xumm.app/sign/current.png';
    element.setQRCode('xaman', currentUri);
    await vi.advanceTimersByTimeAsync(TIMINGS.QR_RENDER_DELAY);

    const image = element.getOverlayRoot()?.querySelector<HTMLImageElement>('#qr-container img');
    expect(image?.src).toBe(currentUri);
  });

  it('leaves the loading view when a selected wallet stops responding', async () => {
    const isAvailable = vi
      .fn<WalletAdapter['isAvailable']>()
      .mockResolvedValueOnce(true)
      .mockReturnValueOnce(new Promise<boolean>(() => {}));
    const adapter = createAdapter('wallet', 'Wallet', isAvailable);
    element = createElement(new WalletManager({ adapters: [adapter] }));

    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    (
      element.getOverlayRoot()?.querySelector('[data-wallet-id="wallet"]') as HTMLButtonElement
    ).click();
    await vi.advanceTimersByTimeAsync(TIME.AVAILABILITY_TIMEOUT * 2);

    expect(isAvailable).toHaveBeenCalledTimes(2);
    expect(adapter.connect).not.toHaveBeenCalled();
    expect(element.getOverlayRoot()?.querySelector('#loading-back-button')).toBeNull();
    expect(element.getOverlayRoot()?.textContent).toContain('Wallet is not currently available.');
  });

  it('locks body scrolling while the account dialog is open', () => {
    document.body.style.overflow = 'clip';
    element = createElement(new WalletManager({ adapters: [] }));

    element.openAccountModal();
    expect(document.body.style.overflow).toBe('hidden');

    element.closeAccountModal();
    expect(document.body.style.overflow).toBe('clip');
  });

  it('invalidates a pending refresh when disconnected', async () => {
    let resolveRefresh!: (available: boolean) => void;
    const refresh = new Promise<boolean>((resolve) => {
      resolveRefresh = resolve;
    });
    const isAvailable = vi
      .fn<WalletAdapter['isAvailable']>()
      .mockResolvedValueOnce(true)
      .mockReturnValueOnce(refresh)
      .mockResolvedValue(true);
    const adapter = createAdapter('wallet', 'Wallet', isAvailable);
    element = createElement(new WalletManager({ adapters: [adapter] }));
    document.body.appendChild(element);

    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    element.openAccountModal();
    element.setAttribute('wallets', 'wallet');
    expect(document.querySelector('[data-xrpl-account-modal-portal]')).not.toBeNull();

    element.remove();
    expect(document.querySelector('[data-xrpl-account-modal-portal]')).toBeNull();

    resolveRefresh(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(document.querySelector('[data-xrpl-account-modal-portal]')).toBeNull();

    document.body.appendChild(element);
    expect(document.querySelector('[data-xrpl-account-modal-portal]')).toBeNull();
    await element.open();
    await vi.advanceTimersByTimeAsync(0);

    expect(isAvailable).toHaveBeenCalledTimes(3);
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="wallet"]')).not.toBeNull();
  });

  it('preserves explicit inline hover colors across base-color changes and portals', async () => {
    element = createElement(new WalletManager({ adapters: [] }));
    element.style.setProperty('--xc-primary-color', '#445566');
    element.style.setProperty('--xc-background-color', '#556677');
    for (const [variable, value] of Object.entries(EXPLICIT_HOVER_COLORS)) {
      element.style.setProperty(variable, value);
    }
    document.body.appendChild(element);

    await vi.advanceTimersByTimeAsync(20);
    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    element.openAccountModal();

    const overlayHost = element.getOverlayRoot()?.host as HTMLElement;
    const accountModalHost = element.getAccountModalRoot()?.host as HTMLElement;
    for (const [variable, value] of Object.entries(EXPLICIT_HOVER_COLORS)) {
      expect(element.style.getPropertyValue(variable)).toBe(value);
      expect(overlayHost.style.getPropertyValue(variable)).toBe(value);
      expect(accountModalHost.style.getPropertyValue(variable)).toBe(value);
    }

    element.style.setProperty('--xc-primary-color', '#667788');
    element.style.setProperty('--xc-background-color', '#778899');
    await vi.advanceTimersByTimeAsync(0);

    for (const [variable, value] of Object.entries(EXPLICIT_HOVER_COLORS)) {
      expect(element.style.getPropertyValue(variable)).toBe(value);
      expect(overlayHost.style.getPropertyValue(variable)).toBe(value);
      expect(accountModalHost.style.getPropertyValue(variable)).toBe(value);
    }
  });

  it('preserves stylesheet hover colors when inline base colors change', async () => {
    const style = document.createElement('style');
    style.textContent = `
      xrpl-wallet-connector.stylesheet-hover-colors {
        --xc-primary-button-hover-background: ${EXPLICIT_HOVER_COLORS['--xc-primary-button-hover-background']};
        --xc-connect-button-hover-background: ${EXPLICIT_HOVER_COLORS['--xc-connect-button-hover-background']};
        --xc-account-address-button-hover-color: ${EXPLICIT_HOVER_COLORS['--xc-account-address-button-hover-color']};
      }
    `;
    document.head.appendChild(style);
    element = createElement(new WalletManager({ adapters: [] }));
    element.className = 'stylesheet-hover-colors';
    element.style.setProperty('--xc-primary-color', '#445566');
    element.style.setProperty('--xc-background-color', '#556677');
    document.body.appendChild(element);

    try {
      await vi.advanceTimersByTimeAsync(20);
      await element.open();
      await vi.advanceTimersByTimeAsync(0);
      element.openAccountModal();
      element.style.setProperty('--xc-primary-color', '#667788');
      element.style.setProperty('--xc-background-color', '#778899');
      await vi.advanceTimersByTimeAsync(0);

      const computedStyle = getComputedStyle(element);
      const overlayHost = element.getOverlayRoot()?.host as HTMLElement;
      const accountModalHost = element.getAccountModalRoot()?.host as HTMLElement;
      for (const [variable, value] of Object.entries(EXPLICIT_HOVER_COLORS)) {
        expect(element.style.getPropertyValue(variable)).toBe('');
        expect(computedStyle.getPropertyValue(variable).trim()).toBe(value);
        expect(overlayHost.style.getPropertyValue(variable)).toBe(value);
        expect(accountModalHost.style.getPropertyValue(variable)).toBe(value);
      }
    } finally {
      style.remove();
    }
  });

  it('updates private hover fallbacks when their base colors change', async () => {
    const primaryColor = '#123456';
    const backgroundColor = '#234567';
    element = createElement(new WalletManager({ adapters: [] }));
    element.style.setProperty('--xc-primary-color', primaryColor);
    element.style.setProperty('--xc-background-color', backgroundColor);
    document.body.appendChild(element);

    await vi.advanceTimersByTimeAsync(20);
    await element.open();
    await vi.advanceTimersByTimeAsync(0);
    element.openAccountModal();

    const expectOmittedHover = (colors: ReturnType<typeof derivedHoverColors>) => {
      const overlayHost = element!.getOverlayRoot()?.host as HTMLElement;
      const accountModalHost = element!.getAccountModalRoot()?.host as HTMLElement;
      for (const [variable, value] of Object.entries(colors)) {
        expect(element!.style.getPropertyValue(variable)).toBe(value);
        expect(overlayHost.style.getPropertyValue(variable)).toBe(value);
        expect(accountModalHost.style.getPropertyValue(variable)).toBe(value);
      }
      for (const variable of Object.keys(EXPLICIT_HOVER_COLORS)) {
        expect(element!.style.getPropertyValue(variable)).toBe('');
      }
    };

    expectOmittedHover(derivedHoverColors(primaryColor, backgroundColor));

    const nextPrimaryColor = '#345678';
    const nextBackgroundColor = '#456789';
    element.style.setProperty('--xc-primary-color', nextPrimaryColor);
    element.style.setProperty('--xc-background-color', nextBackgroundColor);
    await vi.advanceTimersByTimeAsync(0);

    expectOmittedHover(derivedHoverColors(nextPrimaryColor, nextBackgroundColor));
  });
});
