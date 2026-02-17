export function renderQRView(walletName: string): string {
  return `
    <div class="header">
      <div class="header-with-back">
        <button class="back-button" id="back-button" aria-label="Back">←</button>
        <h2 class="title">${walletName}</h2>
      </div>
      <button class="close-button" part="close-button" aria-label="Close">×</button>
    </div>

    <div class="content">
      <div class="qr-view">
        <div class="qr-card">
          <div class="qr-header">Scan with Phone</div>
          <div class="qr-container" id="qr-container">
            <div class="qr-loading">Loading QR...</div>
          </div>
          <div class="qr-footer">
            <button class="copy-button" id="copy-button">Copy to Clipboard</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
