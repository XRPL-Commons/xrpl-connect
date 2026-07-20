import type { WalletAdapter } from '@xrpl-connect/core';
import { getSafeExternalUrl } from '../utils';

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderWalletListView(
  primaryWallet: WalletAdapter | null,
  otherWallets: WalletAdapter[],
  unavailableWalletIds: ReadonlySet<string> = new Set()
): string {
  return `
      <div class="header">
        <h2 class="title">Connect Wallet</h2>
        <button class="close-button" part="close-button" aria-label="Close">×</button>
      </div>

      <div class="content">
        ${
          primaryWallet
            ? `
          <button class="primary-button" data-wallet-id="${primaryWallet.id}">
            ${primaryWallet.icon ? `<img src="${primaryWallet.icon}" width="24" height="24" alt="${primaryWallet.name}">` : ''}
            <span>Continue with ${primaryWallet.name}</span>
          </button>
        `
            : ''
        }
        <div class="wallet-list">
          ${
            !primaryWallet && otherWallets.length === 0
              ? '<p class="wallet-empty">No wallets are currently available.</p>'
              : otherWallets
                  .map((wallet) => {
                    if (unavailableWalletIds.has(wallet.id)) {
                      const installUrl = getSafeExternalUrl(wallet.url);
                      const installAttribute = installUrl
                        ? `data-install-url="${escapeHtmlAttribute(installUrl)}"`
                        : 'disabled aria-disabled="true"';
                      const label = installUrl ? 'Install' : 'Unavailable';
                      return `
            <button class="wallet-button wallet-button--unavailable" ${installAttribute} aria-label="${label} ${wallet.name}">
              <span>${wallet.name}</span>
              <span class="wallet-install-label">${label}</span>
              ${wallet.icon ? `<img src="${wallet.icon}" width="28" height="28" alt="${wallet.name}">` : ''}
            </button>`;
                    }

                    return `
            <button class="wallet-button" data-wallet-id="${wallet.id}">
              <span>${wallet.name}</span>
              ${wallet.icon ? `<img src="${wallet.icon}" width="28" height="28" alt="${wallet.name}">` : ''}
            </button>`;
                  })
                  .join('')
          }
        </div>
      </div>
    `;
}
