import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIME, WalletManager } from '@xrpl-connect/core';
import type { NetworkInfo, WalletAdapter } from '@xrpl-connect/core';
import '../src/wallet-connector';

const NETWORK: NetworkInfo = { id: 'testnet', name: 'Testnet', wss: 'wss://example' };

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
    disconnectedCallback(): void;
    getOverlayRoot(): ShadowRoot | null;
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
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders an empty state instead of falling back to unavailable wallets', async () => {
    const isAvailable = vi.fn(async () => false);
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
    expect(isAvailable).toHaveBeenCalledTimes(1);
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
});
