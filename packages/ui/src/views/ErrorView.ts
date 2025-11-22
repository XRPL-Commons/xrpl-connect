export function renderErrorView(walletName: string, error: Error): string {
  return `
      <div class="header">
        <h2 class="title">Connection Failed</h2>
        <button class="close-button" part="close-button" aria-label="Close">×</button>
      </div>

      <div class="content">
        <div class="error-view">
          <div class="error-icon">⚠</div>
          <div class="error-text">
            <div class="error-title">Failed to connect to ${walletName}</div>
            <div class="error-message">${error.message}</div>
          </div>
          <div class="error-buttons">
            <button class="error-button error-button-secondary" id="error-back-button">
              Back
            </button>
            <button class="error-button error-button-primary" id="error-retry-button">
              Try Again
            </button>
          </div>
        </div>
      </div>
    `;
}
