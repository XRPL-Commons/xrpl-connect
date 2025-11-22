export function renderAccountSelectionView(
      walletName: string,
      walletIcon: string | undefined,
      accounts: Array<{ address: string; publicKey: string; path: string; index: number }>
    ): string {
      const accountButtons = accounts
        .map(
          (account) => `
        <button class="account-button" data-account-index="${account.index}">
          <div class="account-info">
            <div class="account-address">Account ${account.index}</div>
            <div class="account-address-value">${account.address}</div>
          </div>
        </button>
      `
        )
        .join('');

      return `
      <div class="header">
        <div class="header-with-back">
          <button class="back-button" id="account-selection-back-button" aria-label="Back">←</button>
          <h2 class="title">Select Account</h2>
        </div>
        <button class="close-button" part="close-button" aria-label="Close">×</button>
      </div>

      <div class="content">
        <div class="account-selection-view">
          ${
            walletIcon
              ? `
          <div class="account-selection-wallet-icon">
            <img src="${walletIcon}" alt="${walletName}" class="wallet-icon-small">
          </div>
          `
              : ''
          }
          <p class="account-selection-description">Select which account to connect from your ${walletName}</p>
          <div class="account-list">
            ${accountButtons}
          </div>
          <div class="custom-path-section">
            <p class="custom-path-label">Or enter a custom derivation path:</p>
            <input
              type="text"
              id="custom-derivation-path"
              class="custom-path-input"
              placeholder="44'/144'/0'/0/0"
              value=""
            />
            <button class="custom-path-button" id="custom-path-connect-button">
              Connect with Custom Path
            </button>
          </div>
        </div>
      </div>
    `;
    }
