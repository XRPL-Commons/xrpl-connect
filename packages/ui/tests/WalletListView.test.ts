import { describe, it, expect } from 'vitest';
import type { WalletAdapter } from '@xrpl-connect/core';
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

  it('renders no install rows by default (unavailable omitted)', () => {
    const html = renderWalletListView(null, [wallet('xaman')]);
    expect(html).not.toContain('wallet-button--unavailable');
    expect(html).not.toContain('Install');
  });

  it('renders unavailable wallets with an Install link pointing at their url', () => {
    const html = renderWalletListView(
      null,
      [wallet('xaman')],
      [wallet('crossmark', 'https://crossmark.io')]
    );
    expect(html).toContain('data-install-url="https://crossmark.io"');
    expect(html).toContain('wallet-button--unavailable');
    expect(html).toContain('Install');
    // Unavailable wallets must not be connectable.
    expect(html).not.toContain('data-wallet-id="crossmark"');
  });

  it('disables unavailable wallets that have no install URL', () => {
    const html = renderWalletListView(null, [], [wallet('ledger')]);
    expect(html).toContain('disabled aria-disabled="true"');
    expect(html).toContain('Unavailable');
    expect(html).not.toContain('data-install-url=""');
  });
});
