export function renderWalletListView(
  primaryWallet: any | null,
  otherWallets: any[],
  socialAuthEnabled: boolean = false,
  currentView: 'social' | 'wallets' = 'social'
): string {
  // If social auth is enabled, render based on current view
  if (socialAuthEnabled) {
    if (currentView === 'social') {
      // Show only Web3Auth button with switch to wallets
      const web3authWallet = primaryWallet?.id === 'web3auth'
        ? primaryWallet
        : otherWallets.find(w => w.id === 'web3auth');

      return `
        <div class="header">
          <h2 class="title">Connect Wallet</h2>
          <button class="close-button" part="close-button" aria-label="Close">×</button>
        </div>

        <div class="content">
          ${
            web3authWallet
              ? `
            <button class="primary-button" data-wallet-id="${web3authWallet.id}">
              ${web3authWallet.icon ? `<img src="${web3authWallet.icon}" width="24" height="24" alt="${web3authWallet.name}">` : ''}
              <span>Continue with Social Login</span>
            </button>
          `
              : ''
          }
          <button class="switch-view-button" data-switch-to="wallets">
            Or connect with wallet
          </button>
        </div>
      `;
    } else {
      // Show wallet list with switch to social
      const walletsWithoutWeb3Auth = [primaryWallet, ...otherWallets].filter(w => w && w.id !== 'web3auth');
      const primary = walletsWithoutWeb3Auth[0];
      const others = walletsWithoutWeb3Auth.slice(1);

      return `
        <div class="header">
          <h2 class="title">Connect Wallet</h2>
          <button class="close-button" part="close-button" aria-label="Close">×</button>
        </div>

        <div class="content">
          ${
            primary
              ? `
            <button class="primary-button" data-wallet-id="${primary.id}">
              ${primary.icon ? `<img src="${primary.icon}" width="24" height="24" alt="${primary.name}">` : ''}
              <span>Continue with ${primary.name}</span>
            </button>
          `
              : ''
          }
          <div class="wallet-list">
            ${others
              .map(
                (wallet) => `
              <button class="wallet-button" data-wallet-id="${wallet.id}">
                <span>${wallet.name}</span>
                ${wallet.icon ? `<img src="${wallet.icon}" width="28" height="28" alt="${wallet.name}">` : ''}
              </button>`
              )
              .join('')}
          </div>
          <button class="switch-view-button" data-switch-to="social">
            Or use social login
          </button>
        </div>
      `;
    }
  }

  // Original behavior when social auth is not enabled
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
          ${otherWallets
            .map(
              (wallet) => `
            <button class="wallet-button" data-wallet-id="${wallet.id}">
              <span>${wallet.name}</span>
              ${wallet.icon ? `<img src="${wallet.icon}" width="28" height="28" alt="${wallet.name}">` : ''}
            </button>`
            )
            .join('')}
        </div>
      </div>
    `;
}
