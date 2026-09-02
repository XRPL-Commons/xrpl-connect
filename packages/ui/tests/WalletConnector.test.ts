import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { MemoryStorageAdapter, TIME, WalletManager } from '@xrpl-connect/core';
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

  it('does not probe Xaman session state without constructor configuration', async () => {
    const xaman = {
      ...createAdapter(
        'xaman',
        'Xaman',
        vi.fn(async () => true)
      ),
      getMissingConfiguration: vi.fn(() => ['apiKey']),
      checkXamanState: vi.fn(async () => null),
    };

    element = createElement(new WalletManager({ adapters: [xaman] }));
    await Promise.resolve();

    expect(xaman.getMissingConfiguration).toHaveBeenCalledWith(undefined);
    expect(xaman.checkXamanState).not.toHaveBeenCalled();
  });

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

  it('cancels an in-flight connection owned by a replaced manager', async () => {
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
    await vi.waitFor(() => expect(firstAdapter.disconnect).toHaveBeenCalledOnce());
    resolveConnection({ address: 'rFirst', network: NETWORK });

    await expect(connection).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
    expect(firstManager.connected).toBe(false);
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

    const overlay = element.getOverlayRoot();
    expect(overlay?.querySelector('[data-wallet-id="unavailable"]')).toBeNull();
    expect(overlay?.querySelector('.wallet-empty')?.textContent).toContain(
      'No wallets are currently available.'
    );

    element.close();
    await element.open();

    expect(isAvailable).toHaveBeenCalledTimes(2);
    expect(
      element.getOverlayRoot()?.querySelector('[data-wallet-id="unavailable"]')
    ).not.toBeNull();
  });

  it('preserves available wallets while retrying only unavailable wallets', async () => {
    const availableProbe = vi
      .fn<WalletAdapter['isAvailable']>()
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const recoveringProbe = vi
      .fn<WalletAdapter['isAvailable']>()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const available = createAdapter('available', 'Available Wallet', availableProbe);
    const recovering = createAdapter('recovering', 'Recovering Wallet', recoveringProbe);
    element = createElement(new WalletManager({ adapters: [available, recovering] }));

    await element.open();
    element.close();
    await element.open();

    expect(availableProbe).toHaveBeenCalledTimes(1);
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
    await element.open();

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
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="first"]')).not.toBeNull();

    element.close();
    element.setWalletManager(new WalletManager({ adapters: [secondAdapter] }));
    await element.open();

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
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="first"]')).not.toBeNull();
    expect(secondAvailable).not.toHaveBeenCalled();

    element.close();
    element.setAttribute('wallets', 'second');
    await element.open();

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

  it('ignores an older availability check that finishes after a newer one', async () => {
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

    resolveFirst(false);
    await firstOpen;

    expect(isAvailable).toHaveBeenCalledTimes(2);
    expect(element.getOverlayRoot()?.querySelector('[data-wallet-id="wallet"]')).not.toBeNull();
  });

  it('does not finish opening after the modal is closed during an availability check', async () => {
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

    expect(onOpen).not.toHaveBeenCalled();
    expect(element.getOverlayRoot()).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('restores the original body overflow after the final connector closes', async () => {
    document.body.style.overflow = 'clip';
    const manager = new WalletManager({ adapters: [] });
    element = createElement(manager);
    const secondElement = createElement(manager);

    try {
      await element.open();
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

  it('ignores a Xaman state probe after the wallet manager is replaced', async () => {
    let resolveState!: (account: { address: string; network: NetworkInfo }) => void;
    const state = new Promise<{ address: string; network: NetworkInfo }>((resolve) => {
      resolveState = resolve;
    });
    const xaman = {
      ...createAdapter(
        'xaman',
        'Xaman',
        vi.fn(async () => true)
      ),
      getMissingConfiguration: vi.fn(() => []),
      checkXamanState: vi.fn(() => state),
    };
    const firstManager = new WalletManager({ adapters: [xaman] });
    const replacementManager = new WalletManager({ adapters: [] });
    element = createElement(firstManager);
    document.body.appendChild(element);
    element.setWalletManager(firstManager);
    await vi.waitFor(() => expect(xaman.checkXamanState).toHaveBeenCalled());

    element.setWalletManager(replacementManager);
    resolveState({ address: 'rStaleXaman', network: NETWORK });
    await vi.advanceTimersByTimeAsync(0);

    expect(xaman.connect).not.toHaveBeenCalled();
    expect(replacementManager.connected).toBe(false);
  });

  it('retries a detached Xaman state probe when the element is connected', async () => {
    const xaman = {
      ...createAdapter(
        'xaman',
        'Xaman',
        vi.fn(async () => true)
      ),
      connect: vi.fn(async () => ({ address: 'rXamanSession', network: NETWORK })),
      getMissingConfiguration: vi.fn(() => []),
      checkXamanState: vi.fn(async () => ({ address: 'rXamanSession', network: NETWORK })),
    };
    const manager = new WalletManager({ adapters: [xaman] });
    element = createElement(manager);

    await vi.advanceTimersByTimeAsync(0);
    expect(manager.connected).toBe(false);
    document.body.appendChild(element);
    await vi.waitFor(() => expect(manager.connected).toBe(true));

    expect(xaman.checkXamanState).toHaveBeenCalledTimes(2);
    expect(xaman.connect).toHaveBeenCalledOnce();
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
    await vi.waitFor(() => expect(walletConnect.preInitialize).toHaveBeenCalledOnce());

    element.close();
    publishQRCode('wc:stale-proposal');
    await vi.advanceTimersByTimeAsync(0);

    expect(walletConnect.disconnect).toHaveBeenCalledOnce();
    expect((element as unknown as { preGeneratedURI: string | null }).preGeneratedURI).toBeNull();
  });

  it('does not render a QR code scheduled by an earlier modal session', async () => {
    element = createElement(new WalletManager({ adapters: [] }));
    await element.open();
    element.showQRCodeView('xaman');
    element.setQRCode('xaman', 'https://xumm.app/sign/stale.png');

    element.close();
    await element.open();
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
