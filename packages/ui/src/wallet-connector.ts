/**
 * XRPL Wallet Connector Web Component
 * A framework-agnostic web component for connecting to XRPL wallets
 */

import type { WalletManager } from '@xrpl-connect/core';
import { createLogger } from '@xrpl-connect/core';
import QRCodeStyling from 'qr-code-styling';
import { SIZES, TIMINGS, Z_INDEX, QR_CONFIG, ERROR_CODES, FONT_WEIGHTS } from './constants';
import { isSafari, isMobile, isXamanQRImage, delay, adjustColorBrightness } from './utils';

/**
 * Logger instance for wallet connector
 */
const logger = createLogger('[WalletConnector]');

// Only define the component in browser (guard against SSR)
let WalletConnectorElement: any = null;

if (typeof window !== 'undefined' && typeof HTMLElement !== 'undefined') {
  class WalletConnectorElementImpl extends HTMLElement {
    private walletManager: WalletManager | null = null;
    private shadow: ShadowRoot;
    private isOpen = false;
    private isFirstOpen = true;
    private primaryWalletId: string | null = null;
    private viewState: 'list' | 'qr' | 'loading' | 'error' | 'account-selection' = 'list';
    private qrCodeData: { walletId: string; uri: string } | null = null;
    private loadingData: { walletId: string; walletName: string; walletIcon?: string } | null = null;
    private errorData: { walletId: string; walletName: string; error: Error } | null = null;
    private accountSelectionData: { walletId: string; walletName: string; walletIcon?: string; accounts: Array<{ address: string; publicKey: string; path: string; index: number }> } | null = null;
    private previousModalHeight: number = 0;
    private preGeneratedQRCode: any | null = null; // Store pre-generated QR code
    private preGeneratedURI: string | null = null; // Store the URI used for pre-generation
    private specifiedWalletIds: string[] = []; // Wallet IDs specified via 'wallets' attribute
    private availableWallets: any[] = []; // Cache of available wallets
    private walletAvailabilityChecked: boolean = false; // Flag to track if availability has been checked
    private accountModalOpen: boolean = false; // Track if account details modal is open
    private accountBalance: string | null = null; // Cached account balance

    // Observed attributes
    static get observedAttributes() {
      return ['primary-wallet', 'wallets'];
    }

    constructor() {
      super();
      this.shadow = this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();

      // Update derived colors on initial load
      requestAnimationFrame(() => this.updateDerivedColors());

      // Observe style attribute changes for CSS variable updates
      const styleObserver = new MutationObserver(() => {
        this.updateDerivedColors();
      });

      styleObserver.observe(this, {
        attributes: true,
        attributeFilter: ['style'],
      });
    }

    /**
     * Update derived colors (like hover states) based on color changes
     */
    private updateDerivedColors() {
      const computedStyle = window.getComputedStyle(this);
      const primaryColor = computedStyle.getPropertyValue('--xc-primary-color').trim() || '#0EA5E9';
      const backgroundColor =
        computedStyle.getPropertyValue('--xc-background-color').trim() || '#000637';

      // Calculate lighter shades for hover states
      const primaryHoverColor = adjustColorBrightness(primaryColor, 0.15);
      const backgroundHoverColor = adjustColorBrightness(backgroundColor, 0.15);

      // Apply hover colors
      this.style.setProperty('--xc-primary-button-hover-background', primaryHoverColor);
      this.style.setProperty('--xc-connect-button-hover-background', backgroundHoverColor);
      this.style.setProperty('--xc-account-address-button-hover-color', primaryHoverColor);
    }

    attributeChangedCallback(_name: string, _oldValue: string, _newValue: string) {
      if (this.shadow.children.length > 0) {
        this.render();
      }
    }

    /**
     * Set the WalletManager instance
     */
    setWalletManager(manager: WalletManager) {
      this.walletManager = manager;

      // Listen to wallet manager events
      this.walletManager.on('connect', () => {
        this.close();
        this.render(); // Re-render to update button
      });

      this.walletManager.on('disconnect', () => {
        this.render(); // Re-render to update button
      });

      this.walletManager.on('accountChanged', () => {
        this.render(); // Re-render to update button with new account
      });

      this.render();

      // Check for existing Xaman session after a short delay
      this.checkXamanStateOnInit();
    }

    /**
     * Check for existing Xaman authentication on page load
     */
    private async checkXamanStateOnInit() {
      try {
        if (this.listAdapters().includes('xaman')) {
          const xamanAdapter: any = this.walletManager?.adapters?.get('xaman');

          if (!xamanAdapter) {
            return;
          }

          const account = await xamanAdapter.checkXamanState();
          if (account) {
            if (this.walletManager && !this.walletManager.connected) {
              await this.walletManager.connect('xaman');
            }
          }
        }
      } catch (err) {
        console.error('Failed to check Xaman state:', err);
      }
    }

    /**
     * Parse wallet IDs from the 'wallets' attribute
     */
    private parseWalletAttribute(): string[] {
      const walletsAttr = this.getAttribute('wallets') || '';
      if (!walletsAttr) {
        // If no wallets attribute, use all available wallets
        return this.walletManager?.wallets.map((w) => w.id) || [];
      }
      // Parse comma-separated wallet IDs
      return walletsAttr
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
    }

    private listAdapters(): string[] {
      const returnArray: string[] = [];
      if (!this.walletManager?.wallets) return returnArray;

      for (const adapter of Object.values(this.walletManager.wallets)) {
        returnArray.push(adapter.id);
      }

      return returnArray;
    }

    /**
     * Check which wallets are available
     * Filters wallets based on 'wallets' attribute and checks isAvailable() on each
     */
    private async checkWalletAvailability() {
      if (!this.walletManager || !this.walletManager.wallets.length) {
        logger.warn('No wallet manager or wallets registered');
        this.availableWallets = [];
        return;
      }

      try {
        // Parse the specified wallet IDs from attribute
        this.specifiedWalletIds = this.parseWalletAttribute();

        logger.debug('Checking availability for wallets:', this.specifiedWalletIds);

        // Get adapters for specified wallet IDs
        const walletsToCheck = this.walletManager.wallets.filter((w) =>
          this.specifiedWalletIds.includes(w.id)
        );

        // Check availability for each wallet in parallel
        const availabilityChecks = await Promise.all(
          walletsToCheck.map(async (wallet) => {
            try {
              const available = await wallet.isAvailable();
              logger.debug(`Wallet ${wallet.id} availability: ${available}`);
              return { wallet, available };
            } catch (error) {
              logger.warn(`Error checking availability for ${wallet.id}:`, error);
              return { wallet, available: false };
            }
          })
        );

        // Filter to only available wallets and maintain order from specified list
        this.availableWallets = this.specifiedWalletIds
          .map((id) => availabilityChecks.find((check) => check.wallet.id === id)?.wallet)
          .filter(
            (wallet): wallet is any =>
              (wallet !== undefined &&
                availabilityChecks.find((c) => c.wallet.id === wallet.id)?.available) ??
              false
          );

        logger.debug(
          'Available wallets:',
          this.availableWallets.map((w) => w.id)
        );
      } catch (error) {
        logger.error('Error checking wallet availability:', error);
        this.availableWallets = [];
      }
    }

    /**
     * Open the modal
     */
    async open() {
      this.isOpen = true;
      this.isFirstOpen = true;

      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';

      // Check wallet availability when opening modal for the first time
      if (!this.walletAvailabilityChecked) {
        await this.checkWalletAvailability();
        this.walletAvailabilityChecked = true;
      }

      this.render();
      this.dispatchEvent(new CustomEvent('open'));

      // Pre-initialize WalletConnect to reduce loading time
      this.preInitializeWalletConnect();
    }

    /**
     * Close the modal
     */
    close() {
      this.isOpen = false;

      // Restore body scroll when modal is closed
      document.body.style.overflow = '';

      // Reset state to wallet list view when closing
      this.viewState = 'list';
      this.qrCodeData = null;
      this.loadingData = null;
      this.errorData = null;
      this.accountSelectionData = null;
      this.render();
      this.dispatchEvent(new CustomEvent('close'));
    }

    /**
     * Toggle the modal
     */
    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    /**
     * Open the account details modal
     */
    private openAccountModal() {
      this.accountModalOpen = true;
      this.render();
    }

    /**
     * Close the account details modal
     */
    private closeAccountModal() {
      this.accountModalOpen = false;
      this.render();
    }

    /**
     * Disconnect wallet from the account modal
     */
    private async disconnectFromAccountModal() {
      try {
        await this.walletManager?.disconnect();
        this.closeAccountModal();
        this.render();
      } catch (error) {
        logger.error('Failed to disconnect:', error);
      }
    }

    /**
     * Set the account balance to display in the account modal
     */
    setAccountBalance(balance: string) {
      this.accountBalance = balance;
      this.render();
    }

    /**
     * Get the current account balance
     */
    getAccountBalance(): string | null {
      return this.accountBalance;
    }

    /**
     * Pre-initialize WalletConnect when modal opens to reduce loading time
     * Based on ConnectKit's eager initialization pattern
     */
    private async preInitializeWalletConnect() {
      if (!this.walletManager) return;

      // Find WalletConnect adapter
      const walletConnectAdapter = this.walletManager.wallets.find((w) => w.id === 'walletconnect');

      if (!walletConnectAdapter) return;

      // Check if adapter has preInitialize method
      if (typeof (walletConnectAdapter as any).preInitialize === 'function') {
        try {
          logger.debug('Pre-initializing WalletConnect...');

          // Extract projectId from adapter's stored options
          const projectId = (walletConnectAdapter as any).options?.projectId;

          // Pass network information if available
          const network = (this.walletManager as any).options?.network;

          // Store the QR generation callback in the adapter's options
          // The adapter will call this callback during pre-initialization
          if (!(walletConnectAdapter as any).options) {
            (walletConnectAdapter as any).options = {};
          }
          (walletConnectAdapter as any).options.onQRCode = (uri: string) => {
            logger.debug('Pre-generating QR code...');
            this.preGenerateQRCode(uri);
          };

          // Pre-initialize with projectId and network
          await (walletConnectAdapter as any).preInitialize(projectId, network);
        } catch (error) {
          logger.warn('Failed to pre-initialize WalletConnect:', error);
          // Silent failure - connection will initialize on demand if this fails
        }
      }
    }

    /**
     * Pre-generate QR code to have it ready when user clicks WalletConnect
     */
    private async preGenerateQRCode(uri: string) {
      try {
        this.preGeneratedURI = uri;

        // Get wallet icon for embedding
        const wallet = this.walletManager?.wallets.find((w) => w.id === 'walletconnect');

        // Create QR code instance
        const qrCode = new QRCodeStyling({
          width: QR_CONFIG.SIZE,
          height: QR_CONFIG.SIZE,
          type: 'svg',
          data: uri,
          image: wallet?.icon,
          margin: QR_CONFIG.MARGIN,
          qrOptions: {
            errorCorrectionLevel: QR_CONFIG.ERROR_CORRECTION_LEVEL,
          },
          dotsOptions: {
            type: QR_CONFIG.DOT_TYPE,
            color: QR_CONFIG.DOT_COLOR,
          },
          backgroundOptions: {
            color: QR_CONFIG.BACKGROUND_COLOR,
          },
          imageOptions: {
            crossOrigin: 'anonymous',
            margin: QR_CONFIG.IMAGE_MARGIN,
            imageSize: QR_CONFIG.IMAGE_SIZE,
          },
        });

        // Store the pre-generated QR code
        this.preGeneratedQRCode = qrCode;
        logger.debug('QR code pre-generated successfully');
      } catch (error) {
        logger.warn('Failed to pre-generate QR code:', error);
        // Silent failure - QR will be generated on demand if this fails
      }
    }

    /**
     * Connect to a specific wallet
     */
    private async connectWallet(walletId: string, options?: any) {
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
            this.showLoadingView(walletId, wallet.name, wallet.icon);

            this.dispatchEvent(new CustomEvent('connecting', { detail: { walletId } }));

            // Small delay to show the loading animation before WC modal appears
            await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);

            // Connect - WalletConnect modal will open on top of our loading view
            await this.walletManager.connect(walletId, options);
            this.dispatchEvent(new CustomEvent('connected', { detail: { walletId } }));

            // Close our modal after successful connection
            this.close();
          } else {
            // ===== USE CUSTOM QR (Desktop mode) =====
            logger.debug('Using custom QR code (desktop mode)');

            // Show QR code view first for WalletConnect
            this.showQRCodeView(walletId);

            // Set up QR code callback
            const connectOptions = {
              ...options,
              onQRCode: (uri: string) => {
                logger.debug('QR code callback received:', uri.substring(0, 50) + '...');
                this.setQRCode(walletId, uri);
              },
            };

            this.dispatchEvent(new CustomEvent('connecting', { detail: { walletId } }));
            await this.walletManager.connect(walletId, connectOptions);
            this.dispatchEvent(new CustomEvent('connected', { detail: { walletId } }));
          }
        } else if (walletId === 'ledger') {
          // For Ledger, show account selection first
          const isAvailable = await wallet.isAvailable();

          if (!isAvailable) {
            throw new Error(`${wallet.name} is not supported in this browser. Please use Chrome, Edge, or Opera.`);
          }

          // Show loading while fetching accounts
          this.showLoadingView(walletId, wallet.name, wallet.icon);

          // Small delay for UI
          if (!isSafari()) {
            await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);
          }

          // Fetch accounts from Ledger
          logger.debug('Fetching Ledger accounts...');
          const accounts = await (wallet as any).getAccounts(5, 0);
          logger.debug('Fetched accounts:', accounts);

          // Show account selection view
          this.showAccountSelectionView(walletId, wallet.name, wallet.icon, accounts);
        } else {
          // For extension wallets, check availability first
          const isAvailable = await wallet.isAvailable();

          if (!isAvailable) {
            // Wallet not installed - show appropriate error
            throw new Error(`${wallet.name} is not installed. Please install the extension first.`);
          }

          // Show loading state
          this.showLoadingView(walletId, wallet.name, wallet.icon);

          this.dispatchEvent(new CustomEvent('connecting', { detail: { walletId } }));

          // Browser-specific delay (Safari needs immediate connection for user gesture)
          if (!isSafari()) {
            // Small delay for UI animation on non-Safari browsers
            await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);
          }

          await this.walletManager.connect(walletId, options);
          this.dispatchEvent(new CustomEvent('connected', { detail: { walletId } }));
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

        this.showErrorView(walletId, wallet?.name || 'Wallet', new Error(errorMessage));
        this.dispatchEvent(new CustomEvent('error', { detail: { error, walletId, errorType } }));
        logger.error('Failed to connect:', error);
      }
    }

    /**
     * Connect with selected Ledger account
     */
    private async connectWithLedgerAccount(accountIndex: number) {
      if (!this.walletManager || !this.accountSelectionData) return;

      const { walletId, walletName, walletIcon } = this.accountSelectionData;

      try {
        // Show loading state
        this.showLoadingView(walletId, walletName, walletIcon);

        // Small delay for UI
        if (!isSafari()) {
          await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);
        }

        logger.debug('Connecting to Ledger with account index:', accountIndex);
        this.dispatchEvent(new CustomEvent('connecting', { detail: { walletId, accountIndex } }));

        // Connect with selected account index
        await this.walletManager.connect(walletId, { accountIndex });

        this.dispatchEvent(new CustomEvent('connected', { detail: { walletId, accountIndex } }));
      } catch (error: any) {
        // Handle error - show error view
        let errorMessage = error.message || 'An unexpected error occurred';
        let errorType: 'rejected' | 'unavailable' | 'failed' = 'failed';

        if (error.code === ERROR_CODES.USER_REJECTED || errorMessage.toLowerCase().includes('user rejected')) {
          errorType = 'rejected';
          errorMessage = 'Connection request was cancelled';
        }

        logger.debug('Connection error type:', errorType, 'Code:', error.code);
        this.showErrorView(walletId, walletName, new Error(errorMessage));
        this.dispatchEvent(new CustomEvent('error', { detail: { error, walletId, errorType } }));
        logger.error('Failed to connect:', error);
      }
    }

    /**
     * Connect with a custom derivation path for Ledger
     */
    private async connectWithCustomDerivationPath(derivationPath: string) {
      if (!this.walletManager || !this.accountSelectionData) return;

      const { walletId, walletName, walletIcon } = this.accountSelectionData;

      try {
        // Validate derivation path format
        const pathRegex = /^44'\/144'\/\d+'\/\d+\/\d+$/;
        if (!pathRegex.test(derivationPath)) {
          throw new Error('Invalid derivation path format. Expected format: 44\'/144\'/0\'/0/0');
        }

        // Show loading state
        this.showLoadingView(walletId, walletName, walletIcon);

        // Small delay for UI
        if (!isSafari()) {
          await delay(TIMINGS.NON_SAFARI_CONNECT_DELAY);
        }

        logger.debug('Connecting to Ledger with custom derivation path:', derivationPath);
        this.dispatchEvent(new CustomEvent('connecting', { detail: { walletId, derivationPath } }));

        // Connect with custom derivation path
        await this.walletManager.connect(walletId, { derivationPath });

        this.dispatchEvent(new CustomEvent('connected', { detail: { walletId, derivationPath } }));
      } catch (error: any) {
        // Handle error - show error view
        let errorMessage = error.message || 'An unexpected error occurred';
        let errorType: 'rejected' | 'unavailable' | 'failed' = 'failed';

        if (error.code === ERROR_CODES.USER_REJECTED || errorMessage.toLowerCase().includes('user rejected')) {
          errorType = 'rejected';
          errorMessage = 'Connection request was cancelled';
        }

        logger.debug('Connection error type:', errorType, 'Code:', error.code);
        this.showErrorView(walletId, walletName, new Error(errorMessage));
        this.dispatchEvent(new CustomEvent('error', { detail: { error, walletId, errorType } }));
        logger.error('Failed to connect:', error);
      }
    }

    /**
     * Show QR code view
     */
    private showQRCodeView(walletId: string, uri?: string) {
      this.viewState = 'qr';
      this.qrCodeData = { walletId, uri: uri || '' };
      this.loadingData = null;
      this.errorData = null;
      this.accountSelectionData = null;
      this.render();
    }

    /**
     * Show loading view
     */
    private showLoadingView(walletId: string, walletName: string, walletIcon?: string) {
      this.viewState = 'loading';
      this.loadingData = { walletId, walletName, walletIcon };
      this.qrCodeData = null;
      this.errorData = null;
      this.accountSelectionData = null;
      this.render();
    }

    /**
     * Show error view
     */
    private showErrorView(walletId: string, walletName: string, error: Error) {
      this.viewState = 'error';
      this.errorData = { walletId, walletName, error };
      this.qrCodeData = null;
      this.loadingData = null;
      this.accountSelectionData = null;
      this.render();
    }

    /**
     * Show wallet list view
     */
    private showWalletList() {
      this.viewState = 'list';
      this.qrCodeData = null;
      this.loadingData = null;
      this.errorData = null;
      this.accountSelectionData = null;
      this.render();
    }

    /**
     * Show account selection view
     */
    private showAccountSelectionView(walletId: string, walletName: string, walletIcon: string | undefined, accounts: Array<{ address: string; publicKey: string; path: string; index: number }>) {
      this.viewState = 'account-selection';
      this.accountSelectionData = { walletId, walletName, walletIcon, accounts };
      this.qrCodeData = null;
      this.loadingData = null;
      this.errorData = null;
      this.render();
    }

    /**
     * Update QR code with URI
     * Called by wallet adapters when QR code URI is ready
     */
    public setQRCode(walletId: string, uri: string) {
      logger.debug('setQRCode called:', {
        walletId,
        uri: uri.substring(0, 60) + '...',
        viewState: this.viewState,
        qrCodeData: this.qrCodeData,
      });

      if (this.viewState === 'qr' && this.qrCodeData?.walletId === walletId) {
        this.qrCodeData.uri = uri;

        setTimeout(() => {
          logger.debug('Attempting to render QR code...');
          const container = this.shadow.querySelector('#qr-container');
          logger.debug('QR container found:', !!container);
          this.renderQRCode(uri);
        }, TIMINGS.QR_RENDER_DELAY);
      } else {
        logger.warn('QR code view not active or wallet mismatch', {
          viewState: this.viewState,
          expectedWallet: walletId,
          currentDataWallet: this.qrCodeData?.walletId,
        });
      }
    }

    /**
     * Render QR code using QRCodeStyling library
     * Supports both URI strings and direct image URLs (for Xaman)
     */
    private async renderQRCode(uri: string) {
      logger.debug('renderQRCode called with URI:', uri.substring(0, 60) + '...');
      const container = this.shadow.querySelector('#qr-container');
      if (!container || !uri) {
        logger.warn('No container or URI for QR code rendering');
        return;
      }

      try {
        // Check if URI is already a QR code image URL (Xaman provides PNG directly)
        if (isXamanQRImage(uri)) {
          logger.debug('Using direct QR code image from Xaman');
          container.innerHTML = `
          <img
            src="${uri}"
            alt="QR Code"
            style="width: ${SIZES.QR_CODE}px; height: ${SIZES.QR_CODE}px; border-radius: 16px; display: block;"
          />
        `;
          return;
        }

        // Check if we have a pre-generated QR code with matching URI
        if (this.preGeneratedQRCode && this.preGeneratedURI === uri) {
          logger.debug('Using pre-generated QR code - instant render!');
          container.innerHTML = '';
          this.preGeneratedQRCode.append(container as HTMLElement);
          return;
        }

        // Otherwise, generate modern QR code with qr-code-styling
        logger.debug('Generating modern QR code from URI');
        const wallet = this.walletManager?.wallets.find((w) => w.id === this.qrCodeData?.walletId);

        const qrCode = new QRCodeStyling({
          width: QR_CONFIG.SIZE,
          height: QR_CONFIG.SIZE,
          type: 'svg',
          data: uri,
          image: wallet?.icon,
          margin: QR_CONFIG.MARGIN,
          qrOptions: {
            errorCorrectionLevel: QR_CONFIG.ERROR_CORRECTION_LEVEL,
          },
          dotsOptions: {
            type: QR_CONFIG.DOT_TYPE,
            color: QR_CONFIG.DOT_COLOR,
          },
          backgroundOptions: {
            color: QR_CONFIG.BACKGROUND_COLOR,
          },
          imageOptions: {
            crossOrigin: 'anonymous',
            margin: QR_CONFIG.IMAGE_MARGIN,
            imageSize: QR_CONFIG.IMAGE_SIZE,
          },
        });

        // Clear container and append QR code
        container.innerHTML = '';
        qrCode.append(container as HTMLElement);
        logger.debug('Modern QR code generated successfully');
      } catch (error) {
        logger.error('Failed to generate QR code:', error);
        container.innerHTML = `
        <div class="qr-loading" style="color: #ef4444;">
          Failed to generate QR code
        </div>
      `;
      }
    }

    /**
     * Truncate address for display
     */
    private truncateAddress(address: string, chars: number = 6): string {
      if (address.length <= chars * 2) return address;
      return `${address.substring(0, chars)}...${address.substring(address.length - chars)}`;
    }

    /**
     * Generate a deterministic gradient from wallet address
     * Creates a unique color pair based on the address hash
     */
    private generateGradientFromAddress(address: string): { color1: string; color2: string } {
      // Simple hash function to convert address to number
      let hash = 0;
      for (let i = 0; i < address.length; i++) {
        const char = address.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }

      // Generate two colors from the hash
      const hue1 = Math.abs(hash % 360);
      const hue2 = (hue1 + 60) % 360; // Offset by 60 degrees for contrast

      const color1 = `hsl(${hue1}, 70%, 55%)`;
      const color2 = `hsl(${hue2}, 70%, 55%)`;

      return { color1, color2 };
    }

    /**
     * Render the component
     */
    private render() {
      // Capture current modal height before re-rendering
      const existingModal = this.shadow.querySelector('.modal') as HTMLElement;
      if (existingModal) {
        this.previousModalHeight = existingModal.offsetHeight;
      }

      this.primaryWalletId = this.getAttribute('primary-wallet');

      // Check connection state
      const isConnected = this.walletManager?.connected || false;
      const currentAccount = this.walletManager?.account;
      const buttonText =
        isConnected && currentAccount
          ? this.truncateAddress(currentAccount.address, 4)
          : 'Connect Wallet';

      // Use available wallets if any have been checked, otherwise fallback to all wallets
      const wallets =
        this.walletAvailabilityChecked && this.availableWallets.length > 0
          ? this.availableWallets
          : this.walletManager?.wallets || [];

      const primaryWallet = this.primaryWalletId
        ? wallets.find((w) => w.id === this.primaryWalletId)
        : null;
      const otherWallets = wallets.filter((w) => w.id !== this.primaryWalletId);

      // Render based on view state
      let contentHTML = '';
      if (this.viewState === 'qr' && this.qrCodeData) {
        contentHTML = this.renderQRView();
      } else if (this.viewState === 'loading' && this.loadingData) {
        contentHTML = this.renderLoadingView();
      } else if (this.viewState === 'error' && this.errorData) {
        contentHTML = this.renderErrorView();
      } else if (this.viewState === 'account-selection' && this.accountSelectionData) {
        contentHTML = this.renderAccountSelectionView();
      } else {
        contentHTML = this.renderWalletListView(primaryWallet, otherWallets);
      }

      const overlayClass = this.isFirstOpen ? 'overlay fade-in' : 'overlay';
      const modalClass = this.isFirstOpen ? 'modal slide-up' : 'modal';

      // Set flag to false after first render
      if (this.isFirstOpen) {
        this.isFirstOpen = false;
      }

      this.shadow.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Karla:wght@300;400;600&display=swap');

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: var(--font-family);
        color: var(--text-color);
      }

      html, body {
        overflow-y: overlay;
      }

      :host {
        /* Defaults for CSS variables - can be overridden via style attribute or CSS */
        /* General */
        --xc-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        --xc-border-radius: 12px;
        --xc-overlay-background: rgba(0, 0, 0, 0.7);
        --xc-overlay-backdrop-filter: blur(0px);

        /* Colors */
        --xc-primary-color: #0EA5E9;
        --xc-background-color: #000637;
        --xc-text-color: #F5F4E7;
        --xc-text-muted-color: rgba(245, 244, 231, 0.6);
        --xc-background-secondary: #1a1a3e;
        --xc-background-tertiary: #242452;
        --xc-loading-border-color: #0EA5E9;

        /* Connect Button */
        --xc-connect-button-font-size: 16px;
        --xc-connect-button-border-radius: 8px;
        --xc-connect-button-color: var(--xc-text-color);
        --xc-connect-button-background: var(--xc-background-color);
        --xc-connect-button-border: 1px solid rgba(255, 255, 255, 0.1);
        --xc-connect-button-hover-background: var(--xc-background-color);
        --xc-connect-button-font-weight: 600;

        /* Primary Button */
        --xc-primary-button-color: #ffffff;
        --xc-primary-button-background: var(--xc-primary-color);
        --xc-primary-button-border-radius: 8px;
        --xc-primary-button-font-weight: 600;
        --xc-primary-button-hover-background: var(--xc-primary-color);

        /* Secondary Button */
        --xc-secondary-button-color: var(--xc-text-color);
        --xc-secondary-button-background: var(--xc-background-secondary);
        --xc-secondary-button-border-radius: 8px;
        --xc-secondary-button-font-weight: 500;
        --xc-secondary-button-hover-background: var(--xc-background-tertiary);

        /* Account Address Button */
        --xc-account-address-button-hover-color: var(--xc-primary-color);

        /* Modal */
        --xc-modal-background: var(--xc-background-color);
        --xc-modal-border-radius: 12px;
        --xc-modal-box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);

        /* Miscellaneous */
        --xc-focus-color: var(--xc-primary-color);
        --xc-danger-color: #ef4444;
        --xc-success-color: #10b981;
        --xc-warning-color: #f59e0b;

        /* Internal aliases */
        --bg-color: var(--xc-background-color);
        --text-color: var(--xc-text-color);
        --primary-color: var(--xc-primary-color);
        --primary-bn-hover: var(--xc-primary-button-hover-background);
        --font-family: var(--xc-font-family);
        --wallet-btn-bg: var(--xc-background-secondary);
        --wallet-btn-hover: var(--xc-background-tertiary);
      }

      /* WalletConnect Modal Overrides */
      /* These styles ensure the WalletConnect modal appears correctly and matches your theme */
      wcm-modal,
      w3m-modal {
        /* Ensure modal appears on top of everything */
        --wcm-z-index: 2147483647 !important;
        --w3m-z-index: 2147483647 !important;

        /* Match your app's theme (optional) */
        --wcm-accent-color: var(--xc-primary-color) !important;
        --wcm-background-color: var(--xc-background-color) !important;
      }

      @keyframes heightChange {
        from { height: var(--old-height); }
        to { height: var(--new-height); }
      }

      .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--xc-overlay-background);
        backdrop-filter: var(--xc-overlay-backdrop-filter);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: ${Z_INDEX.OVERLAY};
      }

      .overlay.fade-in {
        animation: fadeIn ${TIMINGS.ANIMATION_DURATION}ms ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .modal {
        background: var(--xc-modal-background);
        color: var(--xc-text-color);
        border-radius: var(--xc-modal-border-radius);
        width: ${SIZES.MODAL_WIDTH}px;
        max-width: calc(100vw - 32px);
        max-height: 85vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: var(--xc-modal-box-shadow);
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition: height ${TIMINGS.ANIMATION_DURATION}ms cubic-bezier(0.25, 0.1, 0.25, 1);
      }

      .modal.slide-up {
        animation: slideUp 0.3s ease-out;
      }

      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: ${SIZES.HEADER_PADDING}px 20px 16px;
      }

      .header-with-back {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .back-button {
        width: ${SIZES.CLOSE_BUTTON_SIZE}px;
        height: ${SIZES.CLOSE_BUTTON_SIZE}px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: var(--text-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        opacity: 0.7;
        transition: all 0.2s;
      }

      .back-button:hover {
        opacity: 1;
        background: var(--wallet-btn-bg);
      }

      .title {
        font-size: 22px;
        font-weight: ${FONT_WEIGHTS.SEMIBOLD};
        letter-spacing: -0.3px;
        flex: 1;
      }

      .close-button {
        width: ${SIZES.CLOSE_BUTTON_SIZE}px;
        height: ${SIZES.CLOSE_BUTTON_SIZE}px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: var(--text-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        opacity: 0.7;
        transition: all 0.2s;
      }

      .close-button:hover {
        opacity: 1;
        background: var(--wallet-btn-bg);
      }

      .content {
        flex: 1;
        overflow-y: hidden;
        padding: 0 24px 24px;
        transition: opacity 0.3s ease;
        -ms-overflow-style: none;
        scrollbar-width: none;
      }

      .content::-webkit-scrollbar {
        display: none;
      }

      .connect-button {
        padding: ${SIZES.BUTTON_PADDING_VERTICAL}px ${SIZES.BUTTON_PADDING_HORIZONTAL}px;
        border-radius: var(--xc-connect-button-border-radius);
        border: var(--xc-connect-button-border);
        background: var(--xc-connect-button-background);
        color: var(--xc-connect-button-color);
        font-size: var(--xc-connect-button-font-size);
        font-weight: var(--xc-connect-button-font-weight);
        cursor: pointer;
        transition: all 0.2s;
        font-family: var(--xc-font-family);
      }

      .connect-button:hover {
        background: var(--xc-connect-button-hover-background);
      }

      .primary-button {
        width: 100%;
        padding: ${SIZES.BUTTON_PADDING_VERTICAL}px ${SIZES.BUTTON_PADDING_HORIZONTAL}px;
        border-radius: var(--xc-primary-button-border-radius);
        border: none;
        margin-bottom: 20px;
        background: var(--xc-primary-button-background);
        color: var(--xc-primary-button-color);
        font-size: 16px;
        font-weight: var(--xc-primary-button-font-weight);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        transition: all 0.2s;
      }

      .primary-button:hover {
          background: var(--xc-primary-button-hover-background);
      }

      .wallet-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .wallet-button {
        width: 100%;
        padding: ${SIZES.BUTTON_PADDING_VERTICAL}px ${SIZES.BUTTON_PADDING_HORIZONTAL}px;
        border-radius: var(--xc-secondary-button-border-radius);
        border: none;
        background: var(--xc-secondary-button-background);
        color: var(--xc-secondary-button-color);
        font-size: 16px;
        font-weight: var(--xc-secondary-button-font-weight);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: background 0.2s;
      }

      .wallet-button:hover {
        background: var(--xc-secondary-button-hover-background);
      }

      .wallet-button img {
        border-radius: 6px;
      }

      .qr-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        padding: 20px 0;
      }

      .qr-card {
        background: #fff;
        border-radius: ${SIZES.MODAL_BORDER_RADIUS}px;
        padding: ${SIZES.QR_CARD_PADDING}px;
        width: 100%;
        max-width: 295px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05);
        border: 1px solid rgba(0,0,0,0.06);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 18px;
      }

      .qr-header {
        font-size: 16px;
        font-weight: ${FONT_WEIGHTS.SEMIBOLD};
        color: #111;
      }

      .qr-container {
        width: ${SIZES.QR_CODE}px;
        height: ${SIZES.QR_CODE}px;
        border-radius: 16px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
      }

      .qr-container img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .qr-loading {
        font-size: 14px;
        color: #555;
      }

      .qr-footer {
        width: 100%;
        display: flex;
        justify-content: center;
      }

      .copy-button {
        padding: 12px 16px;
        border: none;
        border-radius: 10px;
        background: #f3f3f3;
        color: #111;
        font-weight: ${FONT_WEIGHTS.MEDIUM};
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .copy-button:hover {
        background: #e5e5e5;
      }

      .qr-placeholder {
        width: 280px;
        height: 280px;
        background: white;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .qr-instructions {
        text-align: center;
        font-size: 14px;
        opacity: 0.8;
        line-height: 1.5;
      }

      .qr-deeplink {
        width: 100%;
        margin-top: 10px;
      }

      .deeplink-button {
        width: 100%;
        padding: 14px ${SIZES.BUTTON_PADDING_HORIZONTAL}px;
        border-radius: ${SIZES.BUTTON_BORDER_RADIUS}px;
        border: none;
        background: var(--primary-color);
        color: white;
        font-size: 15px;
        font-weight: ${FONT_WEIGHTS.SEMIBOLD};
        cursor: pointer;
        transition: all 0.2s;
      }

      .deeplink-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(14, 165, 233, 0.3);
      }

      /* Loading View */
      .loading-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
        padding: 40px 0;
      }

      .loading-logo-container {
        position: relative;
        width: 120px;
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .loading-logo {
        width: ${SIZES.LOADING_LOGO}px;
        height: ${SIZES.LOADING_LOGO}px;
        border-radius: 16px;
        z-index: ${Z_INDEX.LOADING_LOGO};
        position: relative;
      }

      .loading-border {
        position: absolute;
        top: -4px;
        left: -4px;
        right: -4px;
        bottom: -4px;
        border-radius: 20px;
        overflow: hidden;
      }

      .loading-border::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: conic-gradient(
          transparent 0deg 90deg,
          var(--xc-loading-border-color) 90deg 180deg,
          transparent 180deg 270deg,
          var(--xc-loading-border-color) 270deg 360deg
        );
        animation: rotate 2s linear infinite;
      }

      .loading-border::after {
        content: '';
        position: absolute;
        top: 4px;
        left: 4px;
        right: 4px;
        bottom: 4px;
        background: var(--xc-background-color);
        border-radius: 16px;
        z-index: ${Z_INDEX.LOADING_BORDER_AFTER};
      }

      @keyframes rotate {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      .loading-text {
        text-align: center;
        font-size: 16px;
        font-weight: ${FONT_WEIGHTS.LIGHT};
        opacity: 0.9;
      }

      /* Error View */
      .error-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        padding: 30px 0;
      }

      .error-icon {
        width: ${SIZES.ICON_LARGE}px;
        height: ${SIZES.ICON_LARGE}px;
        border-radius: 50%;
        background: rgba(239, 68, 68, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 48px;
        color: #ef4444;
      }

      .error-text {
        text-align: center;
      }

      .error-title {
        font-size: 18px;
        font-weight: ${FONT_WEIGHTS.SEMIBOLD};
        margin-bottom: 8px;
      }

      .error-message {
        font-size: 14px;
        font-weight: ${FONT_WEIGHTS.LIGHT};
        opacity: 0.8;
        line-height: 1.5;
      }

      .error-buttons {
        width: 100%;
        display: flex;
        gap: 12px;
        margin-top: 10px;
      }

      .error-button {
        flex: 1;
        padding: 14px ${SIZES.BUTTON_PADDING_HORIZONTAL}px;
        border-radius: ${SIZES.BUTTON_BORDER_RADIUS}px;
        border: none;
        font-size: 15px;
        font-weight: ${FONT_WEIGHTS.SEMIBOLD};
        cursor: pointer;
        transition: all 0.2s;
      }

      .error-button-primary {
        background: var(--primary-color);
        color: white;
      }

      .error-button-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(14, 165, 233, 0.3);
      }

      .error-button-secondary {
        background: var(--wallet-btn-bg);
        color: var(--text-color);
      }

      .error-button-secondary:hover {
        background: var(--wallet-btn-hover);
      }

      /* Account Selection Styles */
      .account-selection-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        padding: 20px 0;
      }

      .account-selection-wallet-icon {
        width: ${SIZES.ICON_LARGE}px;
        height: ${SIZES.ICON_LARGE}px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .wallet-icon-small {
        width: 100%;
        height: 100%;
        object-fit: contain;
        border-radius: 12px;
      }

      .account-selection-description {
        text-align: center;
        font-size: 14px;
        font-weight: ${FONT_WEIGHTS.LIGHT};
        opacity: 0.8;
        line-height: 1.5;
        margin: 0;
      }

      .account-list {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .account-button {
        width: 100%;
        padding: 16px ${SIZES.BUTTON_PADDING_HORIZONTAL}px;
        border-radius: ${SIZES.BUTTON_BORDER_RADIUS}px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        background: var(--wallet-btn-bg);
        color: var(--text-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        transition: all 0.2s;
      }

      .account-button:hover {
        background: var(--wallet-btn-hover);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .account-info {
        display: flex;
        flex-direction: column;
        gap: 6px;
        text-align: left;
        width: 100%;
      }

      .account-address {
        font-size: 15px;
        font-weight: ${FONT_WEIGHTS.SEMIBOLD};
      }

      .account-address-value {
        font-size: 13px;
        font-weight: ${FONT_WEIGHTS.LIGHT};
        opacity: 0.7;
        font-family: monospace;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .custom-path-section {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        width: 100%;
      }

      .custom-path-label {
        font-size: 14px;
        font-weight: ${FONT_WEIGHTS.MEDIUM};
        margin-bottom: 12px;
        color: var(--text-color);
      }

      .custom-path-input {
        width: 100%;
        padding: 12px ${SIZES.BUTTON_PADDING_HORIZONTAL}px;
        border-radius: ${SIZES.BUTTON_BORDER_RADIUS}px;
        border: 1px solid rgba(0, 0, 0, 0.2);
        background: var(--wallet-btn-bg);
        color: var(--text-color);
        font-size: 14px;
        font-family: monospace;
        margin-bottom: 12px;
        box-sizing: border-box;
      }

      .custom-path-input:focus {
        outline: none;
        border-color: var(--primary-color, #007bff);
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
      }

      .custom-path-button {
        width: 100%;
        padding: 14px ${SIZES.BUTTON_PADDING_HORIZONTAL}px;
        border-radius: ${SIZES.BUTTON_BORDER_RADIUS}px;
        border: none;
        background: var(--primary-color, #007bff);
        color: white;
        font-size: 15px;
        font-weight: ${FONT_WEIGHTS.SEMIBOLD};
        cursor: pointer;
        transition: all 0.2s;
      }

      .custom-path-button:hover {
        background: var(--primary-color-hover, #0056b3);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }

      .custom-path-button:active {
        transform: translateY(0);
      }

      /* Account Modal Styles */
      .account-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--xc-overlay-background);
        backdrop-filter: var(--xc-overlay-backdrop-filter);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: ${Z_INDEX.OVERLAY};
        animation: fadeIn ${TIMINGS.ANIMATION_DURATION}ms ease-out;
      }

      .account-modal {
        background: var(--xc-modal-background);
        color: var(--xc-text-color);
        border-radius: var(--xc-modal-border-radius);
        width: 100%;
        max-width: 280px;
        padding: 0;
        box-shadow: var(--xc-modal-box-shadow);
        border: 1px solid rgba(255, 255, 255, 0.08);
        animation: slideUp 0.3s ease-out;
        overflow: hidden;
      }

      .account-modal-header {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px 20px;
        background: rgba(255, 255, 255, 0.02);
        position: relative;
      }

      .account-modal-title {
        font-size: 16px;
        font-weight: ${FONT_WEIGHTS.SEMIBOLD};
        letter-spacing: -0.3px;
        flex: 1;
        text-align: center;
      }

      .account-modal-close {
        position: absolute;
        right: 8px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: var(--text-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        opacity: 0.6;
        transition: all 0.2s;
        flex-shrink: 0;
      }

      .account-modal-close:hover {
        opacity: 1;
        background: var(--wallet-btn-bg);
      }

      .account-modal-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px 24px 32px;
        gap: 0;
        text-align: center;
      }

      .account-avatar-container {
        width: 100px;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        margin-bottom: 28px;
        flex-shrink: 0;
      }

      .account-info-section {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
      }

      .account-address-button {
        background: none;
        border: none;
        color: var(--text-color);
        cursor: pointer;
        font-size: 14px;
        font-weight: ${FONT_WEIGHTS.SEMIBOLD};
        font-family: var(--font-family);
        padding: 0;
        transition: opacity 0.2s;
        letter-spacing: 0.3px;
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: center;
      }

      .account-address-button:hover {
        color: var(--xc-account-address-button-hover-color);
      }

      .copy-icon {
        width: 20px;
        height: 20px;
        opacity: 0.5;
        transition: opacity 0.2s ease;
        flex-shrink: 0;
      }

      .account-address-button:hover .copy-icon {
        opacity: 1;
        color: var(--xc-account-address-button-hover-color);
      }

      .account-balance-display {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 8px;
      }

      .account-balance-value {
        font-size: 28px;
        font-weight: ${FONT_WEIGHTS.SEMIBOLD};
        color: var(--primary-color);
      }

      .account-balance-unit {
        font-size: 14px;
        font-weight: ${FONT_WEIGHTS.MEDIUM};
        opacity: 0.8;
      }

      .account-disconnect-button {
        width: 100%;
        padding: 12px ${SIZES.BUTTON_PADDING_HORIZONTAL}px;
        border-radius: var(--xc-secondary-button-border-radius);
        border: none;
        background: var(--xc-secondary-button-background);
        color: var(--xc-secondary-button-color);
        font-size: 14px;
        font-weight: var(--xc-secondary-button-font-weight);
        cursor: pointer;
        transition: all 0.2s;
        font-family: var(--xc-font-family);
        margin-top: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .account-disconnect-button:hover {
        background: var(--xc-secondary-button-hover-background);
      }

      .disconnect-icon {
        width: 15px;
        height: 14px;
        transition: opacity 0.2s ease;
        flex-shrink: 0;
      }

      .account-disconnect-button:hover .disconnect-icon {
        opacity: 1;
      }

      .account-disconnect-button:hover .disconnect-icon path {
        fill: #ef4444;
      }
    </style>

    <button class="connect-button" id="connect-wallet-button" part="connect-button">${buttonText}</button>

    ${
      this.isOpen
        ? `
    <div class="${overlayClass}" part="overlay">
      <div class="${modalClass}" part="modal">
        ${contentHTML}
      </div>
    </div>
    `
        : ''
    }

    ${this.accountModalOpen ? this.renderAccountModal() : ''}
  `;

      this.attachEventListeners();

      // Update modal height smoothly after render
      requestAnimationFrame(() => {
        this.updateModalHeight();
      });
    }

    /**
     * Update modal height with smooth transition
     */
    private updateModalHeight() {
      const modal = this.shadow.querySelector('.modal') as HTMLElement;
      if (!modal) return;

      // Use the stored previous height
      const oldHeight = this.previousModalHeight;

      // Measure new content height (modal is currently auto)
      const newHeight = modal.offsetHeight;

      // If heights are different and we have a valid old height, animate the transition
      if (oldHeight > 0 && newHeight > 0 && oldHeight !== newHeight) {
        // Set old height explicitly
        modal.style.height = `${oldHeight}px`;

        // Force reflow to apply the old height
        void modal.offsetHeight;

        // Transition to new height
        requestAnimationFrame(() => {
          modal.style.height = `${newHeight}px`;
        });
      }

      // Store current height for next transition
      this.previousModalHeight = newHeight;
    }

    /**
     * Render wallet list view
     */
    private renderWalletListView(primaryWallet: any | null, otherWallets: any[]): string {
      return `
      <div class="header">
        <h2 class="title">Connect Wallet</h2>
        <button class="close-button" part="close-button" aria-label="Close">×</button>
      </div>

      <div class="content">
        ${
          primaryWallet
            ? `
          <button class="primary-button" data-wallet-id="${primaryWallet.id}">
            ${primaryWallet.icon ? `<img src="${primaryWallet.icon}" width="24" height="24" alt="${primaryWallet.name}">` : ''}
            <span>Continue with ${primaryWallet.name}</span>
          </button>
        `
            : ''
        }
        <div class="wallet-list">
          ${otherWallets
            .map(
              (wallet) => `
            <button class="wallet-button" data-wallet-id="${wallet.id}">
              <span>${wallet.name}</span>
              ${wallet.icon ? `<img src="${wallet.icon}" width="28" height="28" alt="${wallet.name}">` : ''}
            </button>`
            )
            .join('')}
        </div>
      </div>
    `;
    }

    /**
     * Render QR code view
     */
    private renderQRView(): string {
      const wallet = this.walletManager?.wallets.find((w) => w.id === this.qrCodeData?.walletId);
      const walletName = wallet?.name || 'Wallet';

      return `
    <div class="header">
      <div class="header-with-back">
        <button class="back-button" id="back-button" aria-label="Back">←</button>
        <h2 class="title">${walletName}</h2>
      </div>
      <button class="close-button" part="close-button" aria-label="Close">×</button>
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
    }

    /**
     * Render loading view
     */
    private renderLoadingView(): string {
      if (!this.loadingData) return '';

      const { walletName, walletIcon } = this.loadingData;

      return `
      <div class="header">
        <div class="header-with-back">
          <button class="back-button" id="loading-back-button" aria-label="Back">←</button>
          <h2 class="title">Connect Wallet</h2>
        </div>
        <button class="close-button" part="close-button" aria-label="Close">×</button>
      </div>

      <div class="content loading-content">
        <div class="loading-view">
          <div class="loading-logo-container">
            ${walletIcon ? `<img src="${walletIcon}" alt="${walletName}" class="loading-logo">` : ''}
            <div class="loading-border"></div>
          </div>
          <div class="loading-text">
            <p>Requesting connection...</p>
            <p style="margin-top: 8px; font-size: 14px; opacity: 0.7;">Check your ${walletName}</p>
          </div>
        </div>
      </div>
    `;
    }

    /**
     * Render error view
     */
    private renderErrorView(): string {
      if (!this.errorData) return '';

      const { walletName, error } = this.errorData;

      return `
      <div class="header">
        <h2 class="title">Connection Failed</h2>
        <button class="close-button" part="close-button" aria-label="Close">×</button>
      </div>

      <div class="content">
        <div class="error-view">
          <div class="error-icon">⚠</div>
          <div class="error-text">
            <div class="error-title">Failed to connect to ${walletName}</div>
            <div class="error-message">${error.message}</div>
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
    }

    /**
     * Render account selection view for Ledger
     */
    private renderAccountSelectionView(): string {
      if (!this.accountSelectionData) return '';

      const { walletName, walletIcon, accounts } = this.accountSelectionData;

      const accountButtons = accounts
        .map(
          (account) => `
        <button class="account-button" data-account-index="${account.index}">
          <div class="account-info">
            <div class="account-address">Account ${account.index}</div>
            <div class="account-address-value">${account.address}</div>
          </div>
        </button>
      `
        )
        .join('');

      return `
      <div class="header">
        <div class="header-with-back">
          <button class="back-button" id="account-selection-back-button" aria-label="Back">←</button>
          <h2 class="title">Select Account</h2>
        </div>
        <button class="close-button" part="close-button" aria-label="Close">×</button>
      </div>

      <div class="content">
        <div class="account-selection-view">
          ${walletIcon ? `
          <div class="account-selection-wallet-icon">
            <img src="${walletIcon}" alt="${walletName}" class="wallet-icon-small">
          </div>
          ` : ''}
          <p class="account-selection-description">Select which account to connect from your ${walletName}</p>
          <div class="account-list">
            ${accountButtons}
          </div>
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
    }

    /**
     * Render account details modal
     */
    private renderAccountModal(): string {
      const account = this.walletManager?.account;

      if (!account) return '';

      const truncatedAddress = this.truncateAddress(account.address, 6);
      const { color1, color2 } = this.generateGradientFromAddress(account.address);

      return `
      <div id="account-modal-overlay" class="account-modal-overlay">
        <div class="account-modal">
          <div class="account-modal-header">
            <h2 class="account-modal-title">Connected</h2>
            <button class="account-modal-close" id="account-modal-close" aria-label="Close">×</button>
          </div>

          <div class="account-modal-content">
            <div class="account-avatar-container" style="background: linear-gradient(135deg, ${color1}, ${color2});">
            </div>

            <div class="account-info-section">
              <button class="account-address-button" id="copy-account-address" title="Click to copy full address">
                <span>${truncatedAddress}</span>
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  class="copy-icon"
                >
                  <path d="M14 9.5V7C14 5.89543 13.1046 5 12 5H7C5.89543 5 5 5.89543 5 7V12C5 13.1046 5.89543 14 7 14H9.5" stroke="currentColor" stroke-width="2"></path>
                  <rect x="10" y="10" width="9" height="9" rx="2" stroke="currentColor" stroke-width="2"></rect>
                </svg>
              </button>

              ${
                this.accountBalance
                  ? `
                <div class="account-balance-display">
                  <span class="account-balance-value">${this.accountBalance}</span>
                  <span class="account-balance-unit">XRP</span>
                </div>
              `
                  : ''
              }
            </div>

            <button class="account-disconnect-button" id="account-modal-disconnect">
              <svg
                aria-hidden="true"
                width="15"
                height="14"
                viewBox="0 0 15 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="disconnect-icon"
              >
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M4 0C1.79086 0 0 1.79086 0 4V10C0 12.2091 1.79086 14 4 14H6C6.55228 14 7 13.5523 7 13C7 12.4477 6.55228 12 6 12H4C2.89543 12 2 11.1046 2 10V4C2 2.89543 2.89543 2 4 2H6C6.55228 2 7 1.55228 7 1C7 0.447715 6.55228 0 6 0H4ZM11.7071 3.29289C11.3166 2.90237 10.6834 2.90237 10.2929 3.29289C9.90237 3.68342 9.90237 4.31658 10.2929 4.70711L11.5858 6H9.5H6C5.44772 6 5 6.44772 5 7C5 7.55228 5.44772 8 6 8H9.5H11.5858L10.2929 9.29289C9.90237 9.68342 9.90237 10.3166 10.2929 10.7071C10.6834 11.0976 11.3166 11.0976 11.7071 10.7071L14.7071 7.70711C15.0976 7.31658 15.0976 6.68342 14.7071 6.29289L11.7071 3.29289Z"
                  fill="currentColor"
                  fill-opacity="0.4"
                ></path>
              </svg>
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      </div>
    `;
    }

    /**
     * Attach event listeners
     */
    private attachEventListeners() {
      // Connect wallet button
      this.shadow.querySelector('#connect-wallet-button')?.addEventListener('click', async () => {
        const isConnected = this.walletManager?.connected || false;

        if (isConnected) {
          // Open account details modal
          this.openAccountModal();
        } else {
          // Open connection modal
          this.open();
        }
      });

      // Account modal close button
      this.shadow.querySelector('#account-modal-close')?.addEventListener('click', () => {
        this.closeAccountModal();
      });

      // Account modal disconnect button
      this.shadow.querySelector('#account-modal-disconnect')?.addEventListener('click', () => {
        this.disconnectFromAccountModal();
      });

      // Account modal overlay click
      this.shadow.querySelector('#account-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
          this.closeAccountModal();
        }
      });

      // Copy account address button
      this.shadow.querySelector('#copy-account-address')?.addEventListener('click', async () => {
        const address = this.walletManager?.account?.address;
        if (address) {
          try {
            await navigator.clipboard.writeText(address);
            const btn = this.shadow.querySelector('#copy-account-address') as HTMLButtonElement;
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
      this.shadow.querySelector('.close-button')?.addEventListener('click', () => this.close());

      // Overlay click
      this.shadow.querySelector('.overlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) this.close();
      });

      // Wallet buttons
      this.shadow.querySelectorAll('[data-wallet-id]').forEach((button) => {
        button.addEventListener('click', () => {
          const walletId = (button as HTMLElement).dataset.walletId;
          if (walletId) this.connectWallet(walletId);
        });
      });

      // Back button (QR view)
      this.shadow.querySelector('#back-button')?.addEventListener('click', () => {
        this.showWalletList();
      });

      // Back button (Loading view)
      this.shadow.querySelector('#loading-back-button')?.addEventListener('click', () => {
        this.showWalletList();
      });

      // Copy button (QR view)
      this.shadow.querySelector('#copy-button')?.addEventListener('click', async () => {
        if (this.qrCodeData?.uri) {
          try {
            await navigator.clipboard.writeText(this.qrCodeData.uri);
            const btn = this.shadow.querySelector('#copy-button') as HTMLButtonElement;
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
      this.shadow.querySelector('#deeplink-button')?.addEventListener('click', () => {
        if (this.qrCodeData?.uri && this.qrCodeData?.walletId) {
          const adapter = this.walletManager?.wallets.find(
            (w) => w.id === this.qrCodeData?.walletId
          );

          let deepLink = this.qrCodeData.uri;

          // Try to get proper deep link from adapter
          if (adapter && typeof (adapter as any).getDeepLinkURI === 'function') {
            deepLink = (adapter as any).getDeepLinkURI(this.qrCodeData.uri);
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
      this.shadow.querySelector('#error-retry-button')?.addEventListener('click', () => {
        if (this.errorData?.walletId) {
          this.connectWallet(this.errorData.walletId);
        }
      });

      // Error back button
      this.shadow.querySelector('#error-back-button')?.addEventListener('click', () => {
        this.showWalletList();
      });

      // Account selection back button
      this.shadow.querySelector('#account-selection-back-button')?.addEventListener('click', () => {
        this.showWalletList();
      });

      // Account selection buttons
      this.shadow.querySelectorAll('.account-button').forEach((button) => {
        button.addEventListener('click', () => {
          const accountIndex = parseInt((button as HTMLElement).dataset.accountIndex || '0', 10);
          logger.debug('Account selected:', accountIndex);
          this.connectWithLedgerAccount(accountIndex);
        });
      });

      // Custom derivation path button
      this.shadow.querySelector('#custom-path-connect-button')?.addEventListener('click', () => {
        const input = this.shadow.querySelector('#custom-derivation-path') as HTMLInputElement;
        if (input && input.value.trim()) {
          const derivationPath = input.value.trim();
          logger.debug('Custom derivation path entered:', derivationPath);
          this.connectWithCustomDerivationPath(derivationPath);
        }
      });
    }
  }

  // Assign the class to the export variable
  WalletConnectorElement = WalletConnectorElementImpl;

  // Register the custom element
  if (!customElements.get('xrpl-wallet-connector')) {
    customElements.define('xrpl-wallet-connector', WalletConnectorElement);
  }
}

// Export the class (will be null on server, defined on client)
export { WalletConnectorElement };