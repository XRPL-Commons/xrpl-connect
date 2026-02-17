import type { WalletManager } from '@xrpl-connect/core';
import { createLogger } from '@xrpl-connect/core';
import { isSafari, isMobile, delay } from '../utils';
import { TIMINGS, ERROR_CODES } from '../constants';

const logger = createLogger('[WalletService]');

export class WalletService {
  constructor(
    private walletManager: WalletManager,
    private component: HTMLElement
  ) {}

  async connectWallet(walletId: string, options?: any) {
    if (!this.walletManager) {
      logger.error('WalletManager not set');
      return;
    }

    try {
      // Get wallet info
      const wallet = this.walletManager.wallets.find((w) => w.id === walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      logger.debug('Connecting to wallet:', walletId);

      if (walletId === 'walletconnect') {
        // Check if wallet adapter supports modal
        const wcAdapter = wallet as any;
        const useModal = wcAdapter.options?.useModal ?? false;
        const modalMode = wcAdapter.options?.modalMode ?? 'mobile-only';

        const shouldUseModal =
          useModal && (modalMode === 'always' || (modalMode === 'mobile-only' && isMobile()));

        if (shouldUseModal) {
          // ===== USE MODAL (Mobile deeplink mode) =====
          logger.debug('Using WalletConnect modal (mobile deeplink mode)');

          // IMPORTANT: Keep our custom modal open in the background
          // The WalletConnect modal will appear on top, creating a layered effect
          // This gives users the impression they're still in the connection flow

          // Show loading state first (with spinning animation like Xaman)
          (this.component as any).showLoadingView(walletId, wallet.name, wallet.icon);

          this.component.dispatchEvent(new CustomEvent('connecting', { detail: { walletId } }));

          // Small delay to show the loading animation before WC modal appears
          await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);

          // Connect - WalletConnect modal will open on top of our loading view
          await this.walletManager.connect(walletId, options);
          this.component.dispatchEvent(new CustomEvent('connected', { detail: { walletId } }));

          // Close our modal after successful connection
          (this.component as any).close();
        } else {
          // ===== USE CUSTOM QR (Desktop mode) =====
          logger.debug('Using custom QR code (desktop mode)');

          // Show QR code view first for WalletConnect
          (this.component as any).showQRCodeView(walletId);

          // Set up QR code callback
          const connectOptions = {
            ...options,
            onQRCode: (uri: string) => {
              logger.debug('QR code callback received:', uri.substring(0, 50) + '...');
              (this.component as any).setQRCode(walletId, uri);
            },
          };

          this.component.dispatchEvent(new CustomEvent('connecting', { detail: { walletId } }));
          await this.walletManager.connect(walletId, connectOptions);
          this.component.dispatchEvent(new CustomEvent('connected', { detail: { walletId } }));
        }
      } else if (walletId === 'ledger') {
        // For Ledger, show account selection first
        const isAvailable = await wallet.isAvailable();

        if (!isAvailable) {
          throw new Error(
            `${wallet.name} is not supported in this browser. Please use Chrome, Edge, or Opera.`
          );
        }

        // Show loading while fetching accounts
        (this.component as any).showLoadingView(walletId, wallet.name, wallet.icon);

        // Small delay for UI
        if (!isSafari()) {
          await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);
        }

        // Fetch accounts from Ledger
        logger.debug('Fetching Ledger accounts...');
        const accounts = await (wallet as any).getAccounts(5, 0);
        logger.debug('Fetched accounts:', accounts);

        // Show account selection view
        (this.component as any).showAccountSelectionView(
          walletId,
          wallet.name,
          wallet.icon,
          accounts
        );
      } else {
        // For extension wallets, check availability first
        const isAvailable = await wallet.isAvailable();

        if (!isAvailable) {
          // Wallet not installed - show appropriate error
          throw new Error(`${wallet.name} is not installed. Please install the extension first.`);
        }

        // Show loading state
        (this.component as any).showLoadingView(walletId, wallet.name, wallet.icon);

        this.component.dispatchEvent(new CustomEvent('connecting', { detail: { walletId } }));

        // Browser-specific delay (Safari needs immediate connection for user gesture)
        if (!isSafari()) {
          // Small delay for UI animation on non-Safari browsers
          await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);
        }

        await this.walletManager.connect(walletId, options);
        this.component.dispatchEvent(new CustomEvent('connected', { detail: { walletId } }));
      }
    } catch (error: any) {
      const wallet = this.walletManager?.wallets.find((w) => w.id === walletId);

      // Detect error type based on error code (ConnectKit pattern)
      let errorMessage = error.message || 'An unexpected error occurred';
      let errorType: 'rejected' | 'unavailable' | 'failed' = 'failed';

      // Check for specific error codes
      if (
        error.code === ERROR_CODES.USER_REJECTED ||
        errorMessage.toLowerCase().includes('user rejected')
      ) {
        errorType = 'rejected';
        errorMessage = 'Connection request was cancelled';
      } else if (
        error.code === ERROR_CODES.POPUP_CLOSED ||
        errorMessage.toLowerCase().includes('already pending')
      ) {
        errorType = 'unavailable';
        errorMessage = 'Wallet popup was closed or did not respond. Please try again.';
      } else if (errorMessage.toLowerCase().includes('not installed')) {
        errorType = 'unavailable';
      }

      logger.debug('Connection error type:', errorType, 'Code:', error.code);

      (this.component as any).showErrorView(
        walletId,
        wallet?.name || 'Wallet',
        new Error(errorMessage)
      );
      this.component.dispatchEvent(
        new CustomEvent('error', { detail: { error, walletId, errorType } })
      );
      logger.error('Failed to connect:', error);
    }
  }

  async connectWithLedgerAccount(accountIndex: number) {
    if (!this.walletManager || !(this.component as any).accountSelectionData) return;

    const { walletId, walletName, walletIcon } = (this.component as any).accountSelectionData;

    try {
      // Show loading state
      (this.component as any).showLoadingView(walletId, walletName, walletIcon);

      // Small delay for UI
      if (!isSafari()) {
        await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);
      }

      logger.debug('Connecting to Ledger with account index:', accountIndex);
      this.component.dispatchEvent(
        new CustomEvent('connecting', { detail: { walletId, accountIndex } })
      );

      // Connect with selected account index
      await this.walletManager.connect(walletId, { accountIndex } as any); // Custom options for Ledger

      this.component.dispatchEvent(
        new CustomEvent('connected', { detail: { walletId, accountIndex } })
      );
    } catch (error: any) {
      // Handle error - show error view
      let errorMessage = error.message || 'An unexpected error occurred';
      let errorType: 'rejected' | 'unavailable' | 'failed' = 'failed';

      if (
        error.code === ERROR_CODES.USER_REJECTED ||
        errorMessage.toLowerCase().includes('user rejected')
      ) {
        errorType = 'rejected';
        errorMessage = 'Connection request was cancelled';
      }

      logger.debug('Connection error type:', errorType, 'Code:', error.code);
      (this.component as any).showErrorView(walletId, walletName, new Error(errorMessage));
      this.component.dispatchEvent(
        new CustomEvent('error', { detail: { error, walletId, errorType } })
      );
      logger.error('Failed to connect:', error);
    }
  }

  async connectWithCustomDerivationPath(derivationPath: string) {
    if (!this.walletManager || !(this.component as any).accountSelectionData) return;

    const { walletId, walletName, walletIcon } = (this.component as any).accountSelectionData;

    try {
      // Validate derivation path format
      const pathRegex = /^44'\/144'\/\d+'\/\d+\/\d+$/;
      if (!pathRegex.test(derivationPath)) {
        throw new Error("Invalid derivation path format. Expected format: 44'/144'/0'/0/0");
      }

      // Show loading state
      (this.component as any).showLoadingView(walletId, walletName, walletIcon);

      // Small delay for UI
      if (!isSafari()) {
        await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);
      }

      logger.debug('Connecting to Ledger with custom derivation path:', derivationPath);
      this.component.dispatchEvent(
        new CustomEvent('connecting', { detail: { walletId, derivationPath } })
      );

      // Connect with custom derivation path
      await this.walletManager.connect(walletId, { derivationPath } as any); // Custom options for Ledger

      this.component.dispatchEvent(
        new CustomEvent('connected', { detail: { walletId, derivationPath } })
      );
    } catch (error: any) {
      // Handle error - show error view
      let errorMessage = error.message || 'An unexpected error occurred';
      let errorType: 'rejected' | 'unavailable' | 'failed' = 'failed';

      if (
        error.code === ERROR_CODES.USER_REJECTED ||
        errorMessage.toLowerCase().includes('user rejected')
      ) {
        errorType = 'rejected';
        errorMessage = 'Connection request was cancelled';
      }

      logger.debug('Connection error type:', errorType, 'Code:', error.code);
      (this.component as any).showErrorView(walletId, walletName, new Error(errorMessage));
      this.component.dispatchEvent(
        new CustomEvent('error', { detail: { error, walletId, errorType } })
      );
      logger.error('Failed to connect:', error);
    }
  }
}
