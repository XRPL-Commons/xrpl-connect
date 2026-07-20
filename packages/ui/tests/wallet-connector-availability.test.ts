import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletManager, type WalletAdapter } from '@xrpl-connect/core';
import { WalletConnectorElement } from '../src/wallet-connector';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('WalletConnectorElement availability rendering', () => {
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
});
