import type { WalletAdapter } from '@xrpl-connect/core';
import { WALLET_CONNECTOR_PARTS } from '../customization';
import { getSafeExternalUrl } from '../utils';
import { createStaticView, createWalletImage, getViewElement } from './dom';

function createWalletButton(wallet: WalletAdapter, primary: boolean): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = primary ? 'primary-button' : 'wallet-button';
  button.dataset.walletId = wallet.id;

  const label = document.createElement('span');
  label.append(primary ? 'Continue with ' : '', wallet.name);
  button.append(label);

  const image = createWalletImage(wallet.icon, wallet.name, {
    width: primary ? 24 : 28,
    height: primary ? 24 : 28,
  });
  if (image) {
    if (primary) button.prepend(image);
    else button.append(image);
  }
  return button;
}

function createUnavailableWalletButton(wallet: WalletAdapter): HTMLButtonElement {
  const installUrl = getSafeExternalUrl(wallet.url);
  const label = installUrl ? 'Install' : 'Unavailable';
  const button = document.createElement('button');
  button.className = 'wallet-button wallet-button--unavailable';
  button.setAttribute('aria-label', `${label} ${wallet.name}`);
  if (installUrl) {
    button.dataset.installUrl = installUrl;
  } else {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
  }

  const name = document.createElement('span');
  name.textContent = wallet.name;
  const installLabel = document.createElement('span');
  installLabel.className = 'wallet-install-label';
  installLabel.textContent = label;
  button.append(name, installLabel);

  const image = createWalletImage(wallet.icon, wallet.name, { width: 28, height: 28 });
  if (image) button.append(image);
  return button;
}

export function renderWalletListView(
  primaryWallet: WalletAdapter | null,
  otherWallets: WalletAdapter[],
  unavailableWalletIds: ReadonlySet<string> = new Set()
): DocumentFragment {
  const view = createStaticView`
      <div class="header">
        <h2 class="title" id="wallet-dialog-title">Connect Wallet</h2>
        <button class="close-button" aria-label="Close">×</button>
      </div>

      <div class="content" role="region" aria-label="Wallet options" tabindex="0">
        <div class="wallet-list"></div>
      </div>
    `;
  getViewElement(view, '.close-button').setAttribute(
    'part',
    WALLET_CONNECTOR_PARTS.walletModal.closeButton
  );
  const content = getViewElement(view, '.content');
  const walletList = getViewElement(view, '.wallet-list');

  if (primaryWallet) content.prepend(createWalletButton(primaryWallet, true));
  if (!primaryWallet && otherWallets.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'wallet-empty';
    emptyMessage.textContent = 'No wallets are currently available.';
    walletList.append(emptyMessage);
  } else {
    for (const wallet of otherWallets) {
      walletList.append(
        unavailableWalletIds.has(wallet.id)
          ? createUnavailableWalletButton(wallet)
          : createWalletButton(wallet, false)
      );
    }
  }

  return view;
}
