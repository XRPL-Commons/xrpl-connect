import { WALLET_CONNECTOR_PARTS } from '../customization';
import { createStaticView, getViewElement } from './dom';

export function renderErrorView(walletName: string, error: Error): DocumentFragment {
  const view = createStaticView`
      <div class="header">
        <h2 class="title" id="wallet-dialog-title">Connection Failed</h2>
        <button class="close-button" aria-label="Close">×</button>
      </div>

      <div class="content">
        <div class="error-view">
          <div class="error-icon">⚠</div>
          <div class="error-text">
            <div class="error-title"></div>
            <div class="error-message"></div>
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
  getViewElement(view, '.close-button').setAttribute(
    'part',
    WALLET_CONNECTOR_PARTS.walletModal.closeButton
  );
  getViewElement(view, '.error-title').append('Failed to connect to ', walletName);
  getViewElement(view, '.error-message').textContent = error.message;
  return view;
}
