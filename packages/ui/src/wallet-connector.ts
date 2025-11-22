/**
 * XRPL Wallet Connector Web Component
 * A framework-agnostic web component for connecting to XRPL wallets
 */

import type { WalletManager } from '@xrpl-connect/core';
import { createLogger } from '@xrpl-connect/core';
import QRCodeStyling from 'qr-code-styling';
import { mainStyles } from './styles/main';
import { SIZES, TIMINGS, Z_INDEX, QR_CONFIG, ERROR_CODES, FONT_WEIGHTS } from './constants';
import {
  renderWalletListView,
  renderQRView,
  renderLoadingView,
  renderErrorView,
  renderAccountSelectionView,
  renderAccountModal,
} from './views';
import { WalletService, EventHandler } from './services';
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
    private loadingData: { walletId: string; walletName: string; walletIcon?: string } | null =
      null;
    private errorData: { walletId: string; walletName: string; error: Error } | null = null;
    private accountSelectionData: {
      walletId: string;
      walletName: string;
      walletIcon?: string;
      accounts: Array<{ address: string; publicKey: string; path: string; index: number }>;
    } | null = null;
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
      this.walletService = new WalletService(this.walletManager, this);
      this.eventHandler = new EventHandler(this, this.walletService);

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

    private walletService: WalletService;
    private eventHandler: EventHandler;



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
    private showAccountSelectionView(
      walletId: string,
      walletName: string,
      walletIcon: string | undefined,
      accounts: Array<{ address: string; publicKey: string; path: string; index: number }>
    ) {
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
        const wallet = this.walletManager?.wallets.find((w) => w.id === this.qrCodeData?.walletId);
        const walletName = wallet?.name || 'Wallet';
        contentHTML = renderQRView(walletName);
      } else if (this.viewState === 'loading' && this.loadingData) {
        contentHTML = renderLoadingView(this.loadingData.walletName, this.loadingData.walletIcon);
      } else if (this.viewState === 'error' && this.errorData) {
        contentHTML = renderErrorView(this.errorData.walletName, this.errorData.error);
      } else if (this.viewState === 'account-selection' && this.accountSelectionData) {
        contentHTML = renderAccountSelectionView(
          this.accountSelectionData.walletName,
          this.accountSelectionData.walletIcon,
          this.accountSelectionData.accounts
        );
      } else {
        contentHTML = renderWalletListView(primaryWallet, otherWallets);
      }

      const overlayClass = this.isFirstOpen ? 'overlay fade-in' : 'overlay';
      const modalClass = this.isFirstOpen ? 'modal slide-up' : 'modal';

      // Set flag to false after first render
      if (this.isFirstOpen) {
        this.isFirstOpen = false;
      }

      this.shadow.innerHTML = `
    <style>
      ${mainStyles}
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

    ${this.accountModalOpen ? renderAccountModal(this.walletManager?.account, this.accountBalance, this.truncateAddress, this.generateGradientFromAddress) : ''}
  `;

      this.eventHandler?.attachEventListeners();

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







    private eventHandler: EventHandler | undefined;
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
