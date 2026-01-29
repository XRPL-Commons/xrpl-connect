/**
 * XRPL Wallet Connector Web Component
 * A framework-agnostic web component for connecting to XRPL wallets
 */

import type { WalletManager, NetworkInfo } from '@xrpl-connect/core';
import { createLogger, STANDARD_NETWORKS } from '@xrpl-connect/core';
import QRCodeStyling from 'qr-code-styling';
import { mainStyles } from './styles/main';
import { SIZES, TIMINGS, QR_CONFIG } from './constants';
import {
  renderWalletListView,
  renderQRView,
  renderLoadingView,
  renderErrorView,
  renderAccountSelectionView,
  renderAccountModal,
} from './views';
import { WalletService, EventHandler } from './services';
import { isXamanQRImage, adjustColorBrightness } from './utils';

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
    private isGlobeVisible: boolean = false; // Track if globe icon is visible
    private currentNetwork: NetworkInfo; // Current network
    private isNetworkDropdownOpen: boolean = false; // Track if network dropdown is open
    private isNetworkSwitching: boolean = false; // Track if network is switching
    private boundHandleMouseMove: ((e: MouseEvent) => void) | null = null; // Bound mouse handler
    private boundHandleOutsideClick: ((e: MouseEvent) => void) | null = null; // Bound click handler

    // Observed attributes
    static get observedAttributes() {
      return ['primary-wallet', 'wallets'];
    }

    constructor() {
      super();
      this.shadow = this.attachShadow({ mode: 'open' });
      // Default to testnet
      this.currentNetwork = STANDARD_NETWORKS.testnet;
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

      // Set up mouse proximity tracking for globe icon
      this.boundHandleMouseMove = this.handleMouseMove.bind(this);
      this.boundHandleOutsideClick = this.handleOutsideClick.bind(this);
      document.addEventListener('mousemove', this.boundHandleMouseMove);
      document.addEventListener('click', this.boundHandleOutsideClick);
    }

    disconnectedCallback() {
      // Clean up event listeners
      if (this.boundHandleMouseMove) {
        document.removeEventListener('mousemove', this.boundHandleMouseMove);
      }
      if (this.boundHandleOutsideClick) {
        document.removeEventListener('click', this.boundHandleOutsideClick);
      }
    }

    /**
     * Handle mouse movement for globe proximity detection
     */
    private handleMouseMove(e: MouseEvent) {
      // Keep globe visible while dropdown is open
      if (this.isNetworkDropdownOpen) {
        if (!this.isGlobeVisible) {
          this.isGlobeVisible = true;
          this.updateGlobeVisibility();
        }
        return;
      }

      const connectButton = this.shadow.querySelector('#connect-wallet-button');
      if (!connectButton) return;

      const rect = connectButton.getBoundingClientRect();
      const proximityThreshold = 100; // pixels
      const leftExtension = 75; // extra pixels to check on the left side

      // Create an asymmetric detection area (extended on the left)
      const isWithinX =
        e.clientX >= rect.left - proximityThreshold - leftExtension &&
        e.clientX <= rect.right + proximityThreshold;
      const isWithinY =
        e.clientY >= rect.top - proximityThreshold && e.clientY <= rect.bottom + proximityThreshold;

      const shouldShowGlobe = isWithinX && isWithinY;

      if (shouldShowGlobe !== this.isGlobeVisible) {
        this.isGlobeVisible = shouldShowGlobe;
        this.updateGlobeVisibility();
      }
    }

    /**
     * Handle clicks outside the network dropdown
     */
    private handleOutsideClick(e: MouseEvent) {
      if (this.isNetworkDropdownOpen) {
        const dropdown = this.shadow.querySelector('.network-dropdown');
        const globeButton = this.shadow.querySelector('#globe-button');

        // Use composedPath to get the actual clicked element through shadow DOM boundaries
        const path = e.composedPath();

        // Check if click is outside dropdown and globe button
        const clickedOnDropdown = dropdown && path.includes(dropdown);
        const clickedOnGlobe = globeButton && path.includes(globeButton);

        if (!clickedOnDropdown && !clickedOnGlobe) {
          this.isNetworkDropdownOpen = false;
          this.render();
        }
      }
    }

    /**
     * Update globe visibility with animation
     */
    private updateGlobeVisibility() {
      const globeContainer = this.shadow.querySelector('.globe-container') as HTMLElement;
      if (globeContainer) {
        if (this.isGlobeVisible) {
          globeContainer.classList.add('visible');
        } else {
          globeContainer.classList.remove('visible');
        }
      }
    }

    /**
     * Network colors for the dot indicator
     */
    private getNetworkColor(networkId: string): string {
      const colors: Record<string, string> = {
        mainnet: '#10b981', // Green
        testnet: '#3b82f6', // Blue
        devnet: '#f59e0b', // Orange
      };
      return colors[networkId] || '#6b7280'; // Default gray for custom networks
    }

    /**
     * Get available networks
     */
    private getNetworks(): NetworkInfo[] {
      return Object.values(STANDARD_NETWORKS);
    }

    /**
     * Toggle the network dropdown
     */
    public toggleNetworkDropdown() {
      this.isNetworkDropdownOpen = !this.isNetworkDropdownOpen;
      this.render();
    }

    /**
     * Switch network by ID (public method for event handler)
     */
    public switchNetworkById(networkId: string) {
      if (STANDARD_NETWORKS[networkId]) {
        this.switchNetwork(STANDARD_NETWORKS[networkId]);
      }
    }

    /**
     * Switch to a different network
     */
    private async switchNetwork(network: NetworkInfo) {
      if (this.isNetworkSwitching || network.id === this.currentNetwork.id) {
        this.isNetworkDropdownOpen = false;
        this.render();
        return;
      }

      this.isNetworkSwitching = true;
      this.isNetworkDropdownOpen = false;

      try {
        logger.debug('Switching network to:', network.id);

        const wasConnected = this.walletManager?.connected;
        const currentWalletId = this.walletManager?.wallet?.id;

        // Disconnect if connected
        if (wasConnected) {
          await this.walletManager?.disconnect();
        }

        // Update internal state
        this.currentNetwork = network;

        // Update the wallet manager's network option
        if (this.walletManager) {
          (this.walletManager as any).options = {
            ...(this.walletManager as any).options,
            network: network.id,
          };
        }

        // Auto-reconnect if was connected
        if (wasConnected && currentWalletId && this.walletManager) {
          logger.debug('Auto-reconnecting to wallet:', currentWalletId);
          try {
            await this.walletManager.connect(currentWalletId, { network: network.id });
          } catch (error) {
            logger.warn('Auto-reconnect failed:', error);
            this.dispatchEvent(
              new CustomEvent('network-switch-error', {
                detail: { network, error },
              })
            );
          }
        }

        // Emit network changed event
        this.dispatchEvent(
          new CustomEvent('network-change', {
            detail: { network },
          })
        );

        this.render();
      } catch (error) {
        logger.error('Failed to switch network:', error);
        this.dispatchEvent(
          new CustomEvent('network-switch-error', {
            detail: { network, error },
          })
        );
      } finally {
        this.isNetworkSwitching = false;
        this.render();
      }
    }

    /**
     * Get the current network
     */
    getNetwork(): NetworkInfo {
      return this.currentNetwork;
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

      // Get the current network from the manager
      const managerOptions = (manager as any).options;
      if (managerOptions?.network) {
        const network = managerOptions.network;
        if (typeof network === 'string' && STANDARD_NETWORKS[network]) {
          this.currentNetwork = STANDARD_NETWORKS[network];
        } else if (typeof network === 'object' && network.id) {
          this.currentNetwork = network;
        }
      }

      // Listen to wallet manager events
      this.walletManager.on('connect', (account: unknown) => {
        // Update network from account if available
        if (account && typeof account === 'object' && 'network' in account) {
          const acc = account as { network: NetworkInfo };
          this.currentNetwork = acc.network;
        }
        this.close();
        this.render(); // Re-render to update button
      });

      this.walletManager.on('disconnect', () => {
        this.render(); // Re-render to update button
      });

      this.walletManager.on('accountChanged', () => {
        this.render(); // Re-render to update button with new account
      });

      // Listen to network changes
      this.walletManager.on('networkChanged', (network: unknown) => {
        if (network && typeof network === 'object' && 'id' in network) {
          this.currentNetwork = network as NetworkInfo;
          this.render();
        }
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
    public openAccountModal() {
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
    public async disconnectFromAccountModal() {
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

    private walletService: WalletService | undefined;
    private eventHandler: EventHandler | undefined;

    /**
     * Show QR code view
     */
    public showQRCodeView(walletId: string, uri?: string) {
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
    public showLoadingView(walletId: string, walletName: string, walletIcon?: string) {
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
    public showErrorView(walletId: string, walletName: string, error: Error) {
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
    public showWalletList() {
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
    public showAccountSelectionView(
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

      const networks = this.getNetworks();
      const currentColor = this.getNetworkColor(this.currentNetwork.id);

      this.shadow.innerHTML = `
    <style>
      ${mainStyles}
    </style>

    <div class="button-container">
      <div class="globe-container${this.isGlobeVisible ? ' visible' : ''}">
        <button
          class="globe-button${this.isNetworkSwitching ? ' switching' : ''}"
          id="globe-button"
          part="globe-button"
          title="${this.currentNetwork.name}"
          ${this.isNetworkSwitching ? 'disabled' : ''}
        >
          <svg class="globe-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
            <ellipse cx="12" cy="12" rx="4" ry="10" stroke="currentColor" stroke-width="1.5"/>
            <path d="M2 12h20" stroke="currentColor" stroke-width="1.5"/>
            <path d="M4 7h16M4 17h16" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
          </svg>
          <span class="network-dot" style="background-color: ${currentColor}"></span>
        </button>

        ${
          this.isNetworkDropdownOpen
            ? `
        <div class="network-dropdown" part="network-dropdown">
          <div class="network-dropdown-header">Select Network</div>
          ${networks
            .map(
              (network) => `
            <button
              class="network-dropdown-item${network.id === this.currentNetwork.id ? ' active' : ''}"
              data-network-id="${network.id}"
            >
              <span class="network-name">${network.name}</span>
              ${
                network.id === this.currentNetwork.id
                  ? `
                <svg class="check-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              `
                  : ''
              }
            </button>
          `
            )
            .join('')}
        </div>
        `
            : ''
        }
      </div>

      <button class="connect-button" id="connect-wallet-button" part="connect-button">${buttonText}</button>
    </div>

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

    ${this.accountModalOpen ? renderAccountModal(this.walletManager?.account ?? null, this.accountBalance, this.truncateAddress, this.generateGradientFromAddress) : ''}
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
