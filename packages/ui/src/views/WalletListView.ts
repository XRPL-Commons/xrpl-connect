import type { WalletAdapter } from '@xrpl-connect/core';

export function renderWalletListView(
  primaryWallet: WalletAdapter | null,
  otherWallets: WalletAdapter[],
  unavailableWallets: WalletAdapter[] = []
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
                  .map(
                    (wallet) => `
            <button class="wallet-button" data-wallet-id="${wallet.id}">
              <span>${wallet.name}</span>
              ${wallet.icon ? `<img src="${wallet.icon}" width="28" height="28" alt="${wallet.name}">` : ''}
            </button>`
                  )
                  .join('')
          }
          ${unavailableWallets
            .map((wallet) => {
              const installAttribute = wallet.url
                ? `data-install-url="${wallet.url}"`
                : 'disabled aria-disabled="true"';
              const label = wallet.url ? 'Install' : 'Unavailable';
              return `
            <button class="wallet-button wallet-button--unavailable" ${installAttribute} aria-label="${label} ${wallet.name}">
              <span>${wallet.name}</span>
              <span class="wallet-install-label">${label}</span>
              ${wallet.icon ? `<img src="${wallet.icon}" width="28" height="28" alt="${wallet.name}">` : ''}
            </button>`;
            })
            .join('')}
        </div>
      </div>
    `;
}
