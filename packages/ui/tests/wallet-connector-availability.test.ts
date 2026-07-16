import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WalletAdapter } from '@xrpl-connect/core';
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
    const Connector = WalletConnectorElement as CustomElementConstructor;
    const connector = new Connector() as HTMLElement & {
      walletManager: {
        wallets: WalletAdapter[];
        connected: boolean;
        account: null;
      };
      open(): Promise<void>;
      overlayPortal: HTMLDivElement;
    };
    connector.walletManager = {
      wallets: [unavailableWallet],
      connected: false,
      account: null,
    };
    document.body.appendChild(connector);

    await connector.open();

    const modal = connector.overlayPortal.shadowRoot?.innerHTML ?? '';
    expect(unavailableWallet.isAvailable).toHaveBeenCalledOnce();
    expect(modal).not.toContain('data-wallet-id="unavailable"');
    expect(modal).not.toContain('Unavailable Wallet');
  });
});
