export function renderLoadingView(walletName: string, walletIcon?: string): string {
  return `
      <div class="header">
        <div class="header-with-back">
          <button class="back-button" id="loading-back-button" aria-label="Back">←</button>
          <h2 class="title">Connect Wallet</h2>
        </div>
        <button class="close-button" part="close-button" aria-label="Close">×</button>
      </div>

      <div class="content loading-content">
        <div class="loading-view">
          <div class="loading-logo-container">
            ${walletIcon ? `<img src="${walletIcon}" alt="${walletName}" class="loading-logo">` : ''}
            <div class="loading-border"></div>
          </div>
          <div class="loading-text">
            <p>Requesting connection...</p>
            <p style="margin-top: 8px; font-size: 14px; opacity: 0.7;">Check your ${walletName}</p>
          </div>
        </div>
      </div>
    `;
}
