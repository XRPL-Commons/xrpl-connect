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

    const modal = connector.getOverlayRoot()?.innerHTML ?? '';
    expect(unavailableWallet.isAvailable).toHaveBeenCalledOnce();
    expect(modal).not.toContain('data-wallet-id="unavailable"');
    expect(modal).not.toContain('Unavailable Wallet');
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

    const modal = connector.getOverlayRoot()?.innerHTML ?? '';
    expect(unconfiguredWallet.getMissingConfiguration).toHaveBeenCalledWith(undefined);
    expect(unconfiguredWallet.isAvailable).not.toHaveBeenCalled();
    expect(modal).not.toContain('data-wallet-id="unconfigured"');
    expect(modal).not.toContain('Unconfigured Wallet');
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
    expect(connector.getOverlayRoot()?.innerHTML).toContain('https://old.example/install');

    const replacement = createWallet('shared', false, 'https://new.example/install');
    connector.setWalletManager(new WalletManager({ adapters: [replacement] }));

    expect(connector.getOverlayRoot()?.innerHTML).not.toContain('https://old.example/install');
  });
});
