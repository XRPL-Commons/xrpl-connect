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
    const shadow = (this.component as any).shadow as ShadowRoot;
    const overlayRoot: ShadowRoot | null = (this.component as any).getOverlayRoot();
    const accountRoot: ShadowRoot | null = (this.component as any).getAccountModalRoot();

    // Connect wallet button (in component shadow root)
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

    // Account modal close button (in account modal portal)
    accountRoot?.querySelector('#account-modal-close')?.addEventListener('click', () => {
      (this.component as any).closeAccountModal();
    });

    // Account modal disconnect button (in account modal portal)
    accountRoot?.querySelector('#account-modal-disconnect')?.addEventListener('click', () => {
      (this.component as any).disconnectFromAccountModal();
    });

    // Account modal overlay click (in account modal portal)
    accountRoot?.querySelector('#account-modal-overlay')?.addEventListener('click', (e: Event) => {
      if (e.target === e.currentTarget) {
        (this.component as any).closeAccountModal();
      }
    });

    // Copy account address button (in account modal portal)
    accountRoot?.querySelector('#copy-account-address')?.addEventListener('click', async () => {
      const address = (this.component as any).walletManager?.account?.address;
      if (address) {
        try {
          await navigator.clipboard.writeText(address);
          const btn = accountRoot?.querySelector('#copy-account-address') as HTMLButtonElement | null;
          if (!btn) return;
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

    // Close button (in overlay portal)
    overlayRoot
      ?.querySelector('.close-button')
      ?.addEventListener('click', () => (this.component as any).close());

    // Overlay click (in overlay portal)
    overlayRoot?.querySelector('.overlay')?.addEventListener('click', (e: Event) => {
      if (e.target === e.currentTarget) (this.component as any).close();
    });

    // Wallet buttons (in overlay portal)
    overlayRoot?.querySelectorAll('[data-wallet-id]').forEach((button: Element) => {
      button.addEventListener('click', () => {
        const walletId = (button as HTMLElement).dataset.walletId;
        if (walletId) this.walletService.connectWallet(walletId);
      });
    });

    // Back button (QR view, in overlay portal)
    overlayRoot?.querySelector('#back-button')?.addEventListener('click', () => {
      (this.component as any).showWalletList();
    });

    // Back button (Loading view, in overlay portal)
    overlayRoot?.querySelector('#loading-back-button')?.addEventListener('click', () => {
      (this.component as any).showWalletList();
    });

    // Copy button (QR view, in overlay portal)
    overlayRoot?.querySelector('#copy-button')?.addEventListener('click', async () => {
      if ((this.component as any).qrCodeData?.uri) {
        try {
          await navigator.clipboard.writeText((this.component as any).qrCodeData.uri);
          const btn = overlayRoot?.querySelector('#copy-button') as HTMLButtonElement | null;
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

    // Deeplink button (in overlay portal)
    overlayRoot?.querySelector('#deeplink-button')?.addEventListener('click', () => {
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

    // Error retry button (in overlay portal)
    overlayRoot?.querySelector('#error-retry-button')?.addEventListener('click', () => {
      if ((this.component as any).errorData?.walletId) {
        this.walletService.connectWallet((this.component as any).errorData.walletId);
      }
    });

    // Error back button (in overlay portal)
    overlayRoot?.querySelector('#error-back-button')?.addEventListener('click', () => {
      (this.component as any).showWalletList();
    });

    // Account selection back button (in overlay portal)
    overlayRoot?.querySelector('#account-selection-back-button')?.addEventListener('click', () => {
      (this.component as any).showWalletList();
    });

    // Account selection buttons (in overlay portal)
    overlayRoot?.querySelectorAll('.account-button').forEach((button: Element) => {
      button.addEventListener('click', () => {
        const accountIndex = parseInt((button as HTMLElement).dataset.accountIndex || '0', 10);
        logger.debug('Account selected:', accountIndex);
        this.walletService.connectWithLedgerAccount(accountIndex);
      });
    });

    // Custom derivation path button (in overlay portal)
    overlayRoot?.querySelector('#custom-path-connect-button')?.addEventListener('click', () => {
      const input = overlayRoot?.querySelector('#custom-derivation-path') as HTMLInputElement | null;
      if (input && input.value.trim()) {
        const derivationPath = input.value.trim();
        logger.debug('Custom derivation path entered:', derivationPath);
        this.walletService.connectWithCustomDerivationPath(derivationPath);
      }
    });
  }
}
