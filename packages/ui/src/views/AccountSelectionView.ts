import { WALLET_CONNECTOR_PARTS } from '../customization';
import { createStaticView, createWalletImage, getViewElement } from './dom';

export function renderAccountSelectionView(
  walletName: string,
  walletIcon: string | undefined,
  accounts: Array<{ address: string; publicKey: string; path: string; index: number }>
): DocumentFragment {
  const view = createStaticView`
      <div class="header">
        <div class="header-with-back">
          <button class="back-button" id="account-selection-back-button" aria-label="Back">←</button>
          <h2 class="title" id="wallet-dialog-title">Select Account</h2>
        </div>
        <button class="close-button" aria-label="Close">×</button>
      </div>

      <div class="content">
        <div class="account-selection-view">
          <div class="account-selection-wallet-icon"></div>
          <p class="account-selection-description"></p>
          <div class="account-list"></div>
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
  getViewElement(view, '.close-button').setAttribute(
    'part',
    WALLET_CONNECTOR_PARTS.walletModal.closeButton
  );

  const iconContainer = getViewElement(view, '.account-selection-wallet-icon');
  const image = createWalletImage(walletIcon, walletName, { className: 'wallet-icon-small' });
  if (image) {
    iconContainer.append(image);
  } else {
    iconContainer.remove();
  }

  getViewElement(view, '.account-selection-description').append(
    'Select which account to connect from your ',
    walletName
  );
  const accountList = getViewElement(view, '.account-list');
  for (const account of accounts) {
    const button = document.createElement('button');
    button.className = 'account-button';
    button.dataset.accountIndex = String(account.index);

    const information = document.createElement('div');
    information.className = 'account-info';
    const accountLabel = document.createElement('div');
    accountLabel.className = 'account-address';
    accountLabel.append('Account ', String(account.index));
    const address = document.createElement('div');
    address.className = 'account-address-value';
    address.textContent = account.address;
    information.append(accountLabel, address);
    button.append(information);
    accountList.append(button);
  }

  return view;
}
