/**
 * XRPL Wallet Connector Web Component
 * A framework-agnostic web component for connecting to XRPL wallets
 */

import type { WalletManager } from '@xrpl-connect/core';
import QRCodeStyling from 'qr-code-styling';

/**
 * Calculate luminance to determine if text should be black or white
 * Based on WCAG relative luminance formula
 */
/*function getLuminance(hex: string): number {
  // Remove # if present
  const color = hex.replace('#', '');

  // Convert to RGB
  const r = parseInt(color.substring(0, 2), 16) / 255;
  const g = parseInt(color.substring(2, 4), 16) / 255;
  const b = parseInt(color.substring(4, 6), 16) / 255;

  // Apply gamma correction
  const [rs, gs, bs] = [r, g, b].map((c) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  // Calculate relative luminance
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Get text color (black or white) based on background luminance
 *
function getTextColor(backgroundColor: string): string {
  const luminance = getLuminance(backgroundColor);
  // Use white text for dark backgrounds (luminance < 0.5)
  return luminance < 0.5 ? '#ffffff' : '#000000';
}*/

export class WalletConnectorElement extends HTMLElement {
  private walletManager: WalletManager | null = null;
  private shadow: ShadowRoot;
  private isOpen = false;
  private isFirstOpen = true;
  private primaryWalletId: string | null = null;
  private viewState: 'list' | 'qr' | 'loading' | 'error' = 'list';
  private qrCodeData: { walletId: string; uri: string } | null = null;
  private loadingData: { walletId: string; walletName: string; walletIcon?: string } | null = null;
  private errorData: { walletId: string; walletName: string; error: Error } | null = null;
  private previousModalHeight: number = 0;
  private preGeneratedQRCode: any | null = null; // Store pre-generated QR code
  private preGeneratedURI: string | null = null; // Store the URI used for pre-generation

  // Observed attributes
  static get observedAttributes() {
    return [
      'background-color',
      'text-color',
      'primary-color',
      'font-family',
      'custom-css',
      'primary-wallet',
      'show-help',
    ];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
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
    });

    this.render();
  }

  /**
   * Open the modal
   */
  open() {
    this.isOpen = true;
    this.isFirstOpen = true;
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
    // Reset state to wallet list view when closing
    this.viewState = 'list';
    this.qrCodeData = null;
    this.loadingData = null;
    this.errorData = null;
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
        console.log('[WalletConnector] Pre-initializing WalletConnect...');

        // Extract projectId from adapter's stored options
        const projectId = (walletConnectAdapter as any).options?.projectId;

        // Pass network information if available
        const network = (this.walletManager as any).options?.network;

        // Store the QR generation callback in the adapter's options
        // The adapter will call this callback during pre-initialization
        if (!((walletConnectAdapter as any).options)) {
          (walletConnectAdapter as any).options = {};
        }
        (walletConnectAdapter as any).options.onQRCode = (uri: string) => {
          console.log('[WalletConnector] Pre-generating QR code...');
          this.preGenerateQRCode(uri);
        };

        // Pre-initialize with projectId and network
        await (walletConnectAdapter as any).preInitialize(projectId, network);
      } catch (error) {
        console.warn('[WalletConnector] Failed to pre-initialize WalletConnect:', error);
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
        width: 260,
        height: 260,
        type: 'svg',
        data: uri,
        image: wallet?.icon,
        margin: 0,
        qrOptions: {
          errorCorrectionLevel: 'Q',
        },
        dotsOptions: {
          type: 'rounded',
          color: '#000637',
        },
        backgroundOptions: {
          color: 'transparent',
        },
        imageOptions: {
          crossOrigin: 'anonymous',
          margin: 6,
          imageSize: 0.25,
        },
      });

      // Store the pre-generated QR code
      this.preGeneratedQRCode = qrCode;
      console.log('[WalletConnector] QR code pre-generated successfully');
    } catch (error) {
      console.warn('[WalletConnector] Failed to pre-generate QR code:', error);
      // Silent failure - QR will be generated on demand if this fails
    }
  }

  /**
   * Connect to a specific wallet
   */
  private async connectWallet(walletId: string, options?: any) {
    if (!this.walletManager) {
      console.error('WalletManager not set');
      return;
    }

    try {
      // Get wallet info
      const wallet = this.walletManager.wallets.find((w) => w.id === walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      console.log('[WalletConnector] Connecting to wallet:', walletId);

      if (walletId === 'walletconnect') {
        // Show QR code view first for WalletConnect
        console.log('[WalletConnector] Showing QR view for', walletId);
        this.showQRCodeView(walletId);

        // Set up QR code callback
        const connectOptions = {
          ...options,
          onQRCode: (uri: string) => {
            console.log(
              '[WalletConnector] QR code callback received:',
              uri.substring(0, 50) + '...'
            );
            this.setQRCode(walletId, uri);
          },
        };

        this.dispatchEvent(new CustomEvent('connecting', { detail: { walletId } }));
        await this.walletManager.connect(walletId, connectOptions);
        this.dispatchEvent(new CustomEvent('connected', { detail: { walletId } }));
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
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        if (!isSafari) {
          // Small delay for UI animation on non-Safari browsers
          await new Promise((resolve) => setTimeout(resolve, 100));
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
      if (error.code === 4001 || errorMessage.toLowerCase().includes('user rejected')) {
        errorType = 'rejected';
        errorMessage = 'Connection request was cancelled';
      } else if (error.code === -32002 || errorMessage.toLowerCase().includes('already pending')) {
        errorType = 'unavailable';
        errorMessage = 'Wallet popup was closed or did not respond. Please try again.';
      } else if (errorMessage.toLowerCase().includes('not installed')) {
        errorType = 'unavailable';
      }

      console.log('[WalletConnector] Error type:', errorType, 'Code:', error.code);

      this.showErrorView(walletId, wallet?.name || 'Wallet', new Error(errorMessage));
      this.dispatchEvent(new CustomEvent('error', { detail: { error, walletId, errorType } }));
      console.error('Failed to connect:', error);
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
    this.render();
  }

  /**
   * Update QR code with URI (called by adapters)
   */
  public setQRCode(walletId: string, uri: string) {
    console.log('[WalletConnector] setQRCode called:', {
      walletId,
      uri: uri.substring(0, 60) + '...',
      viewState: this.viewState,
      qrCodeData: this.qrCodeData,
    });

    if (this.viewState === 'qr' && this.qrCodeData?.walletId === walletId) {
      this.qrCodeData.uri = uri;

      // Wait for DOM to be ready with a slightly longer delay
      setTimeout(() => {
        console.log('[WalletConnector] Attempting to render QR code after timeout...');
        const container = this.shadow.querySelector('#qr-container');
        console.log('[WalletConnector] QR container found:', !!container);
        this.renderQRCode(uri);
      }, 100);
    } else {
      console.warn('[WalletConnector] QR code view not active or wallet mismatch', {
        viewState: this.viewState,
        expectedWallet: walletId,
        currentDataWallet: this.qrCodeData?.walletId,
      });
    }
  }

  /**
   * Render QR code using QRCodeStyling library with modern dot-style design
   */
  private async renderQRCode(uri: string) {
    console.log('[WalletConnector] renderQRCode called with URI:', uri.substring(0, 60) + '...');
    const container = this.shadow.querySelector('#qr-container');
    if (!container || !uri) {
      console.warn('[WalletConnector] No container or URI');
      return;
    }

    try {
      // Check if URI is already a QR code image URL (Xaman provides PNG directly)
      if (uri.includes('xumm.app/sign') && uri.includes('.png')) {
        console.log('[WalletConnector] Using direct QR code image from Xaman');
        container.innerHTML = `
          <img
            src="${uri}"
            alt="QR Code"
            style="width: 260px; height: 260px; border-radius: 16px; display: block;"
            onload="console.log('[WalletConnector] QR image loaded successfully')"
            onerror="console.error('[WalletConnector] Failed to load QR image')"
          />
        `;
        return;
      }

      // Check if we have a pre-generated QR code with matching URI
      if (this.preGeneratedQRCode && this.preGeneratedURI === uri) {
        console.log('[WalletConnector] Using pre-generated QR code - instant render!');
        container.innerHTML = '';
        this.preGeneratedQRCode.append(container as HTMLElement);
        return;
      }

      // Otherwise, generate modern QR code with qr-code-styling
      console.log('[WalletConnector] Generating modern QR code from URI');
      const wallet = this.walletManager?.wallets.find((w) => w.id === this.qrCodeData?.walletId);

      const qrCode = new QRCodeStyling({
        width: 260,
        height: 260,
        type: 'svg',
        data: uri,
        image: wallet?.icon,
        margin: 0,
        qrOptions: {
          errorCorrectionLevel: 'Q',
        },
        dotsOptions: {
          type: 'rounded',
          color: '#000637',
        },
        backgroundOptions: {
          color: 'transparent',
        },
        imageOptions: {
          crossOrigin: 'anonymous',
          margin: 6,
          imageSize: 0.25,
        },
      });

      // Clear container and append QR code
      container.innerHTML = '';
      qrCode.append(container as HTMLElement);
      console.log('[WalletConnector] Modern QR code generated successfully');
    } catch (error) {
      console.error('[WalletConnector] Failed to generate QR code:', error);
      container.innerHTML = `
        <div class="qr-loading" style="color: #ef4444;">
          Failed to generate QR code
        </div>
      `;
    }
  }

  /**
   * Render the component
   */

  private render() {
    if (!this.isOpen) {
      this.shadow.innerHTML = '';
      return;
    }

    // Capture current modal height before re-rendering
    const existingModal = this.shadow.querySelector('.modal') as HTMLElement;
    if (existingModal) {
      this.previousModalHeight = existingModal.offsetHeight;
    }

    // Core theme values
    const backgroundColor = this.getAttribute('background-color') || '#000637';
    const textColor = this.getAttribute('text-color') || '#F5F4E7';
    const primaryColor = this.getAttribute('primary-color') || '#0ea5e9';
    const fontFamily = this.getAttribute('font-family') || "'Karla', sans-serif";
    const customCSS = this.getAttribute('custom-css') || '';

    this.primaryWalletId = this.getAttribute('primary-wallet');

    // Wallets
    const wallets = this.walletManager?.wallets || [];
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

      :host {
        --bg-color: ${backgroundColor};
        --text-color: ${textColor};
        --primary-color: ${primaryColor};
        --font-family: ${fontFamily};
        --wallet-btn-bg: ${this.adjustColor(backgroundColor, 0.1)};
        --wallet-btn-hover: ${this.adjustColor(backgroundColor, 0.15)};
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
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      }

      .overlay.fade-in {
        animation: fadeIn 0.2s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .modal {
        background: var(--bg-color);
        color: var(--text-color);
        border-radius: 20px;
        width: 343px;
        max-width: calc(100vw - 32px);
        max-height: 85vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition: height 200ms cubic-bezier(0.25, 0.1, 0.25, 1);
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
        padding: 18px 20px 16px;
      }

      .header-with-back {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .back-button {
        width: 34px;
        height: 34px;
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
        font-weight: 600;
        letter-spacing: -0.3px;
        flex: 1;
      }

      .close-button {
        width: 34px;
        height: 34px;
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
        overflow-y: auto;
        padding: 0 24px 24px;
        transition: opacity 0.3s ease;
      }

      .primary-button {
        width: 100%;
        padding: 16px 20px;
        border-radius: 12px;
        border: none;
        margin-bottom: 20px;
        background: var(--primary-color);
        color: white;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        transition: all 0.2s;
      }

      .primary-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(14, 165, 233, 0.3);
      }

      .wallet-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .wallet-button {
        width: 100%;
        padding: 16px 20px;
        border-radius: 12px;
        border: none;
        background: var(--wallet-btn-bg);
        color: var(--text-color);
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: background 0.2s;
      }

      .wallet-button:hover {
        background: var(--wallet-btn-hover);
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
  border-radius: 20px;
  padding: 28px;
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
  font-weight: 600;
  color: #111;
}

.qr-container {
  width: 260px;
  height: 260px;
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
  font-weight: 500;
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
        padding: 14px 20px;
        border-radius: 12px;
        border: none;
        background: var(--primary-color);
        color: white;
        font-size: 15px;
        font-weight: 600;
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
        width: 80px;
        height: 80px;
        border-radius: 16px;
        object-fit: contain;
        z-index: 1;
      }

      .loading-border {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: 20px;
        border: 3px solid transparent;
        border-top-color: var(--text-color);
        border-right-color: var(--text-color);
        animation: spin 1.5s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .loading-text {
        text-align: center;
        font-size: 16px;
        font-weight: 300;
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
        width: 80px;
        height: 80px;
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
        font-weight: 600;
        margin-bottom: 8px;
      }

      .error-message {
        font-size: 14px;
        font-weight: 300;
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
        padding: 14px 20px;
        border-radius: 12px;
        border: none;
        font-size: 15px;
        font-weight: 600;
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

      ${customCSS}
    </style>

    <div class="${overlayClass}" part="overlay">
      <div class="${modalClass}" part="modal">
        ${contentHTML}
      </div>
    </div>
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
    //const walletIcon = wallet?.icon || '';

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

      <div class="content">
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

    const { walletName } = this.errorData;

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
   * Attach event listeners
   */
  private attachEventListeners() {
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
            setTimeout(() => (btn.textContent = 'Copy to Clipboard'), 2000);
          }
        } catch (error) {
          console.error('Failed to copy to clipboard:', error);
        }
      }
    });

    // Deeplink button
    this.shadow.querySelector('#deeplink-button')?.addEventListener('click', () => {
      if (this.qrCodeData?.uri && this.qrCodeData?.walletId) {
        const adapter = this.walletManager?.wallets.find((w) => w.id === this.qrCodeData?.walletId);

        let deepLink = this.qrCodeData.uri;

        // Try to get proper deep link from adapter
        if (adapter && typeof (adapter as any).getDeepLinkURI === 'function') {
          deepLink = (adapter as any).getDeepLinkURI(this.qrCodeData.uri);
        }

        // Detect mobile and open deep link
        if (this.isMobile()) {
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
  }

  /**
   * Detect if user is on mobile
   */
  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  /**
   * Adjust color brightness
   */
  private adjustColor(hex: string, amount: number): string {
    const color = hex.replace('#', '');
    const num = parseInt(color, 16);

    let r = (num >> 16) + Math.round(255 * amount);
    let g = ((num >> 8) & 0x00ff) + Math.round(255 * amount);
    let b = (num & 0x0000ff) + Math.round(255 * amount);

    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
}

// Register the custom element
if (typeof window !== 'undefined' && !customElements.get('xrpl-wallet-connector')) {
  customElements.define('xrpl-wallet-connector', WalletConnectorElement);
}
