import { describe, it, expect } from 'vite-plus/test';
import type { WalletAdapter } from '@xrpl-connect/core';
import { mainStyles } from '../src/styles/main';
import { renderWalletListView } from '../src/views/WalletListView';

const wallet = (id: string, url?: string): WalletAdapter =>
  ({ id, name: id, url }) as unknown as WalletAdapter;

describe('renderWalletListView', () => {
  it('renders available wallets as connectable buttons', () => {
    const html = renderWalletListView(null, [wallet('xaman'), wallet('crossmark')]);
    expect(html).toContain('data-wallet-id="xaman"');
    expect(html).toContain('data-wallet-id="crossmark"');
    expect(html).not.toContain('data-install-url');
  });

  it('inherits the configured primary and secondary button colors into wallet labels', () => {
    const textColor = 'rgb(10, 20, 30)';
    const primaryColor = 'rgb(240, 241, 242)';
    const secondaryColor = 'rgb(120, 121, 122)';
    const style = document.createElement('style');
    style.textContent = mainStyles
      .replace(':host', '.wallet-connector-host')
      .replaceAll('var(--text-color)', textColor)
      .replaceAll('var(--xc-primary-button-color)', primaryColor)
      .replaceAll('var(--xc-secondary-button-color)', secondaryColor);
    document.head.appendChild(style);

    const host = document.createElement('div');
    host.className = 'wallet-connector-host';
    host.innerHTML = renderWalletListView(wallet('primary'), [wallet('secondary')]);
    document.body.appendChild(host);

    try {
      const primaryLabel = host.querySelector('.primary-button > span');
      const secondaryLabel = host.querySelector('.wallet-button > span');

      expect(primaryLabel).not.toBeNull();
      expect(secondaryLabel).not.toBeNull();
      expect(getComputedStyle(primaryLabel!).color).toBe(primaryColor);
      expect(getComputedStyle(secondaryLabel!).color).toBe(secondaryColor);
    } finally {
      host.remove();
      style.remove();
    }
  });

  it('renders no install rows by default (unavailable omitted)', () => {
    const html = renderWalletListView(null, [wallet('xaman')]);
    expect(html).not.toContain('wallet-button--unavailable');
    expect(html).not.toContain('Install');
  });

  it('renders unavailable wallets with an Install link pointing at their url', () => {
    const html = renderWalletListView(
      null,
      [wallet('xaman'), wallet('crossmark', 'https://crossmark.io')],
      new Set(['crossmark'])
    );
    expect(html).toContain('data-install-url="https://crossmark.io/"');
    expect(html).toContain('wallet-button--unavailable');
    expect(html).toContain('Install');
    // Unavailable wallets must not be connectable.
    expect(html).not.toContain('data-wallet-id="crossmark"');
  });

  it('disables unavailable wallets that have no install URL', () => {
    const html = renderWalletListView(null, [wallet('ledger')], new Set(['ledger']));
    expect(html).toContain('disabled aria-disabled="true"');
    expect(html).toContain('Unavailable');
    expect(html).not.toContain('data-install-url=""');
  });

  it('preserves mixed available and unavailable wallet order', () => {
    const html = renderWalletListView(
      null,
      [wallet('missing', 'https://example.com'), wallet('installed')],
      new Set(['missing'])
    );
    const host = document.createElement('div');
    host.innerHTML = html;
    const labels = [...host.querySelectorAll('.wallet-button > span:first-child')].map(
      (label) => label.textContent
    );
    expect(labels).toEqual(['missing', 'installed']);
  });

  it('disables unsafe install URLs without injecting attributes', () => {
    const maliciousUrl = 'https://example.com/" autofocus onfocus="globalThis.pwned=true';
    const html = renderWalletListView(
      null,
      [wallet('malicious', maliciousUrl), wallet('script', 'javascript:alert(1)')],
      new Set(['malicious', 'script'])
    );
    const host = document.createElement('div');
    host.innerHTML = html;
    const buttons = host.querySelectorAll('.wallet-button--unavailable');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].hasAttribute('autofocus')).toBe(false);
    expect(buttons[0].hasAttribute('onfocus')).toBe(false);
    expect(buttons[1].hasAttribute('data-install-url')).toBe(false);
    expect(buttons[1].hasAttribute('disabled')).toBe(true);
  });
});
