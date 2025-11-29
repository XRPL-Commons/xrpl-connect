import { WalletService } from './WalletService';
import { TIMINGS } from '../constants';
import { createLogger } from '@xrpl-connect/core';
import { isMobile } from '../utils';

const logger = createLogger('[EventHandler]');

export class EventHandler {
  constructor(
    private component: HTMLElement,
    private walletService: WalletService
  ) {}

  public attachEventListeners() {
    const shadow = (this.component as any).shadow;
    // Connect wallet button
    shadow.querySelector('#connect-wallet-button')?.addEventListener('click', async () => {
      const isConnected = (this.component as any).walletManager?.connected || false;

      if (isConnected) {
        // Open account details modal
        (this.component as any).openAccountModal();
      } else {
        // Open connection modal
        (this.component as any).open();
      }
    });

    // Account modal close button
    shadow.querySelector('#account-modal-close')?.addEventListener('click', () => {
      (this.component as any).closeAccountModal();
    });

    // Account modal disconnect button
    shadow.querySelector('#account-modal-disconnect')?.addEventListener('click', () => {
      (this.component as any).disconnectFromAccountModal();
    });

    // Account modal overlay click
    shadow.querySelector('#account-modal-overlay')?.addEventListener('click', (e: Event) => {
      if (e.target === e.currentTarget) {
        (this.component as any).closeAccountModal();
      }
    });

    // Copy account address button
    shadow.querySelector('#copy-account-address')?.addEventListener('click', async () => {
      const address = (this.component as any).walletManager?.account?.address;
      if (address) {
        try {
          await navigator.clipboard.writeText(address);
          const btn = shadow.querySelector('#copy-account-address') as HTMLButtonElement;
          const originalHTML = btn.innerHTML;
          btn.innerHTML = '<span>Copied!</span>';
          setTimeout(() => {
            if (btn) btn.innerHTML = originalHTML;
          }, TIMINGS.COPY_FEEDBACK_DURATION);
        } catch (error) {
          logger.error('Failed to copy address:', error);
        }
      }
    });

    // Close button
    shadow
      .querySelector('.close-button')
      ?.addEventListener('click', () => (this.component as any).close());

    // Overlay click
    shadow.querySelector('.overlay')?.addEventListener('click', (e: Event) => {
      if (e.target === e.currentTarget) (this.component as any).close();
    });

    // Wallet buttons
    shadow.querySelectorAll('[data-wallet-id]').forEach((button: Element) => {
      button.addEventListener('click', () => {
        const walletId = (button as HTMLElement).dataset.walletId;
        if (walletId) this.walletService.connectWallet(walletId);
      });
    });

    // Switch view button (social auth mode)
    shadow.querySelectorAll('.switch-view-button').forEach((button: Element) => {
      button.addEventListener('click', () => {
        const switchTo = (button as HTMLElement).dataset.switchTo;
        if (switchTo === 'social') {
          (this.component as any).showSocialView();
        } else if (switchTo === 'wallets') {
          (this.component as any).showWalletsView();
        }
      });
    });

    // Back button (QR view)
    shadow.querySelector('#back-button')?.addEventListener('click', () => {
      (this.component as any).showWalletList();
    });

    // Back button (Loading view)
    shadow.querySelector('#loading-back-button')?.addEventListener('click', () => {
      (this.component as any).showWalletList();
    });

    // Copy button (QR view)
    shadow.querySelector('#copy-button')?.addEventListener('click', async () => {
      if ((this.component as any).qrCodeData?.uri) {
        try {
          await navigator.clipboard.writeText((this.component as any).qrCodeData.uri);
          const btn = shadow.querySelector('#copy-button') as HTMLButtonElement;
          if (btn) {
            btn.textContent = 'Copied!';
            setTimeout(
              () => (btn.textContent = 'Copy to Clipboard'),
              TIMINGS.COPY_FEEDBACK_DURATION
            );
          }
        } catch (error) {
          logger.error('Failed to copy to clipboard:', error);
        }
      }
    });

    // Deeplink button
    shadow.querySelector('#deeplink-button')?.addEventListener('click', () => {
      if ((this.component as any).qrCodeData?.uri && (this.component as any).qrCodeData?.walletId) {
        const adapter = (this.component as any).walletManager?.wallets.find(
          (w: any) => w.id === (this.component as any).qrCodeData?.walletId
        );

        let deepLink = (this.component as any).qrCodeData.uri;

        // Try to get proper deep link from adapter
        if (adapter && typeof (adapter as any).getDeepLinkURI === 'function') {
          deepLink = (adapter as any).getDeepLinkURI((this.component as any).qrCodeData.uri);
        }

        // Detect mobile and open deep link
        if (isMobile()) {
          window.location.href = deepLink;
        } else {
          // On desktop, still try to open (might open desktop app if installed)
          window.open(deepLink, '_blank');
        }
      }
    });

    // Error retry button
    shadow.querySelector('#error-retry-button')?.addEventListener('click', () => {
      if ((this.component as any).errorData?.walletId) {
        this.walletService.connectWallet((this.component as any).errorData.walletId);
      }
    });

    // Error back button
    shadow.querySelector('#error-back-button')?.addEventListener('click', () => {
      (this.component as any).showWalletList();
    });

    // Account selection back button
    shadow.querySelector('#account-selection-back-button')?.addEventListener('click', () => {
      (this.component as any).showWalletList();
    });

    // Account selection buttons
    shadow.querySelectorAll('.account-button').forEach((button: Element) => {
      button.addEventListener('click', () => {
        const accountIndex = parseInt((button as HTMLElement).dataset.accountIndex || '0', 10);
        logger.debug('Account selected:', accountIndex);
        this.walletService.connectWithLedgerAccount(accountIndex);
      });
    });

    // Custom derivation path button
    shadow.querySelector('#custom-path-connect-button')?.addEventListener('click', () => {
      const input = shadow.querySelector('#custom-derivation-path') as HTMLInputElement;
      if (input && input.value.trim()) {
        const derivationPath = input.value.trim();
        logger.debug('Custom derivation path entered:', derivationPath);
        this.walletService.connectWithCustomDerivationPath(derivationPath);
      }
    });
  }
}
