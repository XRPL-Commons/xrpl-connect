import { WALLET_CONNECTOR_PARTS } from '../customization';
import { createStaticView, getViewElement } from './dom';

export function renderQRView(walletName: string): DocumentFragment {
  const view = createStaticView`
    <div class="header">
      <div class="header-with-back">
        <button class="back-button" id="back-button" aria-label="Back">←</button>
        <h2 class="title" id="wallet-dialog-title"></h2>
      </div>
      <button class="close-button" aria-label="Close">×</button>
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
  getViewElement(view, '.close-button').setAttribute(
    'part',
    WALLET_CONNECTOR_PARTS.walletModal.closeButton
  );
  getViewElement(view, '.title').textContent = walletName;
  return view;
}
