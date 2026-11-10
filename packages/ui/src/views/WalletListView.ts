import type { WalletAdapter } from '@xrpl-connect/core';
import { WALLET_CONNECTOR_PARTS } from '../customization';
import type { SocialLogin } from '../types';
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
    width: 28,
    height: 28,
  });
  if (image) button.prepend(image);
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
  if (image) button.prepend(image);
  return button;
}

function createSocialLoginButton(socialLogin: SocialLogin): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'wallet-button social-login-button';
  button.dataset.socialLoginId = socialLogin.id;
  button.setAttribute('aria-label', socialLogin.label);

  const label = document.createElement('span');
  label.textContent = socialLogin.label;

  const image = createWalletImage(socialLogin.icon, socialLogin.label, {
    width: 28,
    height: 28,
  });
  if (image) button.append(image);
  button.append(label);
  return button;
}

function createSocialLoginGroupButton(icon?: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'wallet-button social-login-group-button';
  button.id = 'social-login-button';
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  const image = createWalletImage(icon, '', { width: 28, height: 28 });
  if (image) button.append(image);
  const label = document.createElement('span');
  label.textContent = 'Sign in with socials';
  button.append(label);
  return button;
}

export interface SocialLoginDiscoveryErrorView {
  readonly adapterId: string;
  readonly adapterName: string;
}

export interface SocialLoginViewOptions {
  readonly loading?: boolean;
  readonly errors?: readonly SocialLoginDiscoveryErrorView[];
}

export function renderWalletListView(
  primaryWallet: WalletAdapter | null,
  otherWallets: WalletAdapter[],
  unavailableWalletIds: ReadonlySet<string> = new Set(),
  loading = false,
  socialLogins: readonly SocialLogin[] = [],
  socialLoginAvailable = false,
  socialLoginIcon?: string
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

  content.setAttribute('aria-busy', String(loading));
  if (loading) {
    const status = document.createElement('p');
    status.className = 'wallet-empty';
    status.setAttribute('role', 'status');
    status.textContent = 'Finding available wallets…';
    walletList.append(status);
  }

  if (primaryWallet) content.prepend(createWalletButton(primaryWallet, true));
  if (
    !loading &&
    !primaryWallet &&
    otherWallets.length === 0 &&
    socialLogins.length === 0 &&
    !socialLoginAvailable
  ) {
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
    if (socialLoginAvailable || socialLogins.length > 0) {
      walletList.append(createSocialLoginGroupButton(socialLoginIcon));
    }
  }

  return view;
}

export function renderSocialLoginView(
  socialLogins: readonly SocialLogin[],
  options: SocialLoginViewOptions = {}
): DocumentFragment {
  const view = createStaticView`
      <div class="header">
        <div class="header-with-back">
          <button class="back-button" id="social-login-back-button" aria-label="Back to wallets">
            ←
          </button>
          <h2 class="title" id="wallet-dialog-title">Sign in with socials</h2>
        </div>
        <button class="close-button" aria-label="Close">×</button>
      </div>

      <div class="content" role="region" aria-label="Social sign-in methods" tabindex="0">
        <div class="wallet-list"></div>
      </div>
    `;
  getViewElement(view, '.close-button').setAttribute(
    'part',
    WALLET_CONNECTOR_PARTS.walletModal.closeButton
  );

  const walletList = getViewElement(view, '.wallet-list');
  const content = getViewElement(view, '.content');
  content.setAttribute('aria-busy', String(options.loading ?? false));
  if (options.loading) {
    const loading = document.createElement('p');
    loading.className = 'wallet-empty social-login-loading';
    loading.setAttribute('role', 'status');
    loading.textContent = 'Loading available sign-in methods…';
    walletList.append(loading);
  }
  for (const socialLogin of socialLogins) {
    walletList.append(createSocialLoginButton(socialLogin));
  }
  for (const error of options.errors ?? []) {
    const errorRow = document.createElement('div');
    errorRow.className = 'social-login-discovery-error';
    const message = document.createElement('p');
    message.textContent = `Unable to load sign-in methods for ${error.adapterName}.`;
    const retry = document.createElement('button');
    retry.className = 'error-button error-button-secondary';
    retry.type = 'button';
    retry.dataset.socialLoginRetryId = error.adapterId;
    retry.textContent = 'Try again';
    errorRow.append(message, retry);
    walletList.append(errorRow);
  }
  if (!options.loading && socialLogins.length === 0 && (options.errors ?? []).length === 0) {
    const empty = document.createElement('p');
    empty.className = 'wallet-empty';
    empty.textContent = 'No social sign-in methods are currently available.';
    walletList.append(empty);
  }
  return view;
}
