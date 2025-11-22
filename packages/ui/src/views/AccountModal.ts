export function renderAccountModal(
      account: { address: string } | null,
      accountBalance: string | null,
      truncateAddress: (address: string, chars?: number) => string,
      generateGradientFromAddress: (address: string) => { color1: string; color2: string }
    ): string {
      if (!account) return '';

      const truncatedAddress = truncateAddress(account.address, 6);
      const { color1, color2 } = generateGradientFromAddress(account.address);

      return `
      <div id="account-modal-overlay" class="account-modal-overlay">
        <div class="account-modal">
          <div class="account-modal-header">
            <h2 class="account-modal-title">Connected</h2>
            <button class="account-modal-close" id="account-modal-close" aria-label="Close">×</button>
          </div>

          <div class="account-modal-content">
            <div class="account-avatar-container" style="background: linear-gradient(135deg, ${color1}, ${color2});">
            </div>

            <div class="account-info-section">
              <button class="account-address-button" id="copy-account-address" title="Click to copy full address">
                <span>${truncatedAddress}</span>
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  class="copy-icon"
                >
                  <path d="M14 9.5V7C14 5.89543 13.1046 5 12 5H7C5.89543 5 5 5.89543 5 7V12C5 13.1046 5.89543 14 7 14H9.5" stroke="currentColor" stroke-width="2"></path>
                  <rect x="10" y="10" width="9" height="9" rx="2" stroke="currentColor" stroke-width="2"></rect>
                </svg>
              </button>

              ${
                accountBalance
                  ? `
                <div class="account-balance-display">
                  <span class="account-balance-value">${accountBalance}</span>
                  <span class="account-balance-unit">XRP</span>
                </div>
              `
                  : ''
              }
            </div>

            <button class="account-disconnect-button" id="account-modal-disconnect">
              <svg
                aria-hidden="true"
                width="15"
                height="14"
                viewBox="0 0 15 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="disconnect-icon"
              >
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M4 0C1.79086 0 0 1.79086 0 4V10C0 12.2091 1.79086 14 4 14H6C6.55228 14 7 13.5523 7 13C7 12.4477 6.55228 12 6 12H4C2.89543 12 2 11.1046 2 10V4C2 2.89543 2.89543 2 4 2H6C6.55228 2 7 1.55228 7 1C7 0.447715 6.55228 0 6 0H4ZM11.7071 3.29289C11.3166 2.90237 10.6834 2.90237 10.2929 3.29289C9.90237 3.68342 9.90237 4.31658 10.2929 4.70711L11.5858 6H9.5H6C5.44772 6 5 6.44772 5 7C5 7.55228 5.44772 8 6 8H9.5H11.5858L10.2929 9.29289C9.90237 9.68342 9.90237 10.3166 10.2929 10.7071C10.6834 11.0976 11.3166 11.0976 11.7071 10.7071L14.7071 7.70711C15.0976 7.31658 15.0976 6.68342 14.7071 6.29289L11.7071 3.29289Z"
                  fill="currentColor"
                  fill-opacity="0.4"
                ></path>
              </svg>
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      </div>
    `;
    }
