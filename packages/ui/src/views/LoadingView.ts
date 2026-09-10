import { WALLET_CONNECTOR_PARTS } from '../customization';
import { createStaticView, createWalletImage, getViewElement } from './dom';

export function renderLoadingView(walletName: string, walletIcon?: string): DocumentFragment {
  const view = createStaticView`
      <div class="header">
        <div class="header-with-back">
          <button class="back-button" id="loading-back-button" aria-label="Back">←</button>
          <h2 class="title" id="wallet-dialog-title">Connect Wallet</h2>
        </div>
        <button class="close-button" aria-label="Close">×</button>
      </div>

      <div class="content loading-content">
        <div class="loading-view">
          <div class="loading-logo-container">
            <div class="loading-border"></div>
          </div>
          <div class="loading-text">
            <p>Requesting connection...</p>
            <p class="loading-wallet-message"></p>
          </div>
        </div>
      </div>
    `;
  getViewElement(view, '.close-button').setAttribute(
    'part',
    WALLET_CONNECTOR_PARTS.walletModal.closeButton
  );
  const image = createWalletImage(walletIcon, walletName, { className: 'loading-logo' });
  if (image) getViewElement(view, '.loading-logo-container').prepend(image);
  getViewElement(view, '.loading-wallet-message').append('Check your ', walletName);
  return view;
}
