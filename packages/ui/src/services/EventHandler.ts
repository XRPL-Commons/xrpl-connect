import { WalletService } from './WalletService';
import { TIMINGS } from '../constants';
import type { WalletAdapter } from '@xrpl-connect/core';
import { createLogger, supportsDeepLink } from '@xrpl-connect/core';
import { isMobile } from '../utils';

const logger = createLogger('[EventHandler]');

interface TrackedListener {
  target: EventTarget;
  type: string;
  handler: EventListener;
}

export class EventHandler {
  private listeners: TrackedListener[] = [];

  constructor(
    private component: HTMLElement,
    private walletService: WalletService
  ) {}

  private add(target: EventTarget | null | undefined, type: string, handler: EventListener) {
    if (!target) return;
    target.addEventListener(type, handler);
    this.listeners.push({ target, type, handler });
  }

  public detachEventListeners() {
    for (const { target, type, handler } of this.listeners) {
      target.removeEventListener(type, handler);
    }
    this.listeners = [];
  }

  public attachEventListeners() {
    // Remove any previously tracked listeners before re-binding, otherwise
    // every render() would stack a new copy on the same (or re-created) elements.
    this.detachEventListeners();

    const shadow = (this.component as any).shadow as ShadowRoot;
    const overlayRoot: ShadowRoot | null = (this.component as any).getOverlayRoot();
    const accountRoot: ShadowRoot | null = (this.component as any).getAccountModalRoot();

    // Connect wallet button (in component shadow root)
    this.add(shadow.querySelector('#connect-wallet-button'), 'click', async () => {
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
    this.add(accountRoot?.querySelector('#account-modal-close'), 'click', () => {
      (this.component as any).closeAccountModal();
    });

    // Account modal disconnect button (in account modal portal)
    this.add(accountRoot?.querySelector('#account-modal-disconnect'), 'click', () => {
      (this.component as any).disconnectFromAccountModal();
    });

    // Account modal overlay click (in account modal portal)
    this.add(accountRoot?.querySelector('#account-modal-overlay'), 'click', (e: Event) => {
      if (e.target === e.currentTarget) {
        (this.component as any).closeAccountModal();
      }
    });

    // Copy account address button (in account modal portal)
    this.add(accountRoot?.querySelector('#copy-account-address'), 'click', async () => {
      const address = (this.component as any).walletManager?.account?.address;
      if (address) {
        try {
          await navigator.clipboard.writeText(address);
          const btn = accountRoot?.querySelector(
            '#copy-account-address'
          ) as HTMLButtonElement | null;
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
    this.add(overlayRoot?.querySelector('.close-button'), 'click', () =>
      (this.component as any).close()
    );

    // Overlay click (in overlay portal)
    this.add(overlayRoot?.querySelector('.overlay'), 'click', (e: Event) => {
      if (e.target === e.currentTarget) (this.component as any).close();
    });

    // Wallet buttons (in overlay portal)
    overlayRoot?.querySelectorAll('[data-wallet-id]').forEach((button: Element) => {
      this.add(button, 'click', () => {
        const walletId = (button as HTMLElement).dataset.walletId;
        if (walletId) this.walletService.connectWallet(walletId);
      });
    });

    // Back button (QR view, in overlay portal)
    this.add(overlayRoot?.querySelector('#back-button'), 'click', () => {
      (this.component as any).showWalletList();
    });

    // Back button (Loading view, in overlay portal)
    this.add(overlayRoot?.querySelector('#loading-back-button'), 'click', () => {
      (this.component as any).showWalletList();
    });

    // Copy button (QR view, in overlay portal)
    this.add(overlayRoot?.querySelector('#copy-button'), 'click', async () => {
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
    this.add(overlayRoot?.querySelector('#deeplink-button'), 'click', () => {
      if ((this.component as any).qrCodeData?.uri && (this.component as any).qrCodeData?.walletId) {
        const adapter = (this.component as any).walletManager?.wallets.find(
          (w: WalletAdapter) => w.id === (this.component as any).qrCodeData?.walletId
        ) as WalletAdapter | undefined;

        let deepLink = (this.component as any).qrCodeData.uri;

        // Try to get proper deep link from adapter
        if (adapter && supportsDeepLink(adapter)) {
          deepLink = adapter.getDeepLinkURI((this.component as any).qrCodeData.uri);
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
    this.add(overlayRoot?.querySelector('#error-retry-button'), 'click', () => {
      if ((this.component as any).errorData?.walletId) {
        this.walletService.connectWallet((this.component as any).errorData.walletId);
      }
    });

    // Error back button (in overlay portal)
    this.add(overlayRoot?.querySelector('#error-back-button'), 'click', () => {
      (this.component as any).showWalletList();
    });

    // Account selection back button (in overlay portal)
    this.add(overlayRoot?.querySelector('#account-selection-back-button'), 'click', () => {
      (this.component as any).showWalletList();
    });

    // Account selection buttons (in overlay portal)
    overlayRoot?.querySelectorAll('.account-button').forEach((button: Element) => {
      this.add(button, 'click', () => {
        const accountIndex = parseInt((button as HTMLElement).dataset.accountIndex || '0', 10);
        logger.debug('Account selected:', accountIndex);
        this.walletService.connectWithLedgerAccount(accountIndex);
      });
    });

    // Custom derivation path button (in overlay portal)
    this.add(overlayRoot?.querySelector('#custom-path-connect-button'), 'click', () => {
      const input = overlayRoot?.querySelector(
        '#custom-derivation-path'
      ) as HTMLInputElement | null;
      if (input && input.value.trim()) {
        const derivationPath = input.value.trim();
        logger.debug('Custom derivation path entered:', derivationPath);
        this.walletService.connectWithCustomDerivationPath(derivationPath);
      }
    });
  }
}
