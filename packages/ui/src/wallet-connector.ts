/**
 * XRPL Wallet Connector Web Component
 * A framework-agnostic web component for connecting to XRPL wallets
 */

import type { WalletManager } from '@xrpl-connect/core';
import QRCode from 'qrcode';

/**
 * Calculate luminance to determine if text should be black or white
 * Based on WCAG relative luminance formula
 */
function getLuminance(hex: string): number {
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
 */
function getTextColor(backgroundColor: string): string {
  const luminance = getLuminance(backgroundColor);
  // Use white text for dark backgrounds (luminance < 0.5)
  return luminance < 0.5 ? '#ffffff' : '#000000';
}

export class WalletConnectorElement extends HTMLElement {
  private walletManager: WalletManager | null = null;
  private shadow: ShadowRoot;
  private isOpen = false;
  private primaryWalletId: string | null = null;
  private viewState: 'list' | 'qr' = 'list';
  private qrCodeData: { walletId: string; uri: string } | null = null;

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
    this.render();
    this.dispatchEvent(new CustomEvent('open'));
  }

  /**
   * Close the modal
   */
  close() {
    this.isOpen = false;
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
   * Connect to a specific wallet
   */
  private async connectWallet(walletId: string, options?: any) {
    if (!this.walletManager) {
      console.error('WalletManager not set');
      return;
    }

    try {
      // Check if wallet uses QR code flow (only WalletConnect for now)
      const wallet = this.walletManager.wallets.find((w) => w.id === walletId);
      console.log('[WalletConnector] Connecting to wallet:', walletId);

      if (wallet && walletId === 'walletconnect') {
        // Show QR code view first
        console.log('[WalletConnector] Showing QR view for', walletId);
        this.showQRCodeView(walletId);

        // Set up QR code callback for this wallet
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
        // For non-QR wallets (including Xaman popup), connect directly
        this.dispatchEvent(new CustomEvent('connecting', { detail: { walletId } }));
        await this.walletManager.connect(walletId, options);
        this.dispatchEvent(new CustomEvent('connected', { detail: { walletId } }));
      }
    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: { error, walletId } }));
      console.error('Failed to connect:', error);
      // Return to wallet list on error
      this.showWalletList();
    }
  }

  /**
   * Show QR code view
   */
  private showQRCodeView(walletId: string, uri?: string) {
    this.viewState = 'qr';
    this.qrCodeData = { walletId, uri: uri || '' };
    this.render();
  }

  /**
   * Show wallet list view
   */
  private showWalletList() {
    this.viewState = 'list';
    this.qrCodeData = null;
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
   * Render QR code using QRCode library or direct image
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
            style="width: 280px; height: 280px; border-radius: 16px; display: block;"
            onload="console.log('[WalletConnector] QR image loaded successfully')"
            onerror="console.error('[WalletConnector] Failed to load QR image')"
          />
        `;
        return;
      }

      // Otherwise, generate QR code from URI (for WalletConnect, etc.)
      console.log('[WalletConnector] Generating QR code from URI');
      const qrDataUrl = await QRCode.toDataURL(uri, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      });

      // Create img element with QR code
      container.innerHTML = `
        <img
          src="${qrDataUrl}"
          alt="QR Code"
          style="width: 280px; height: 280px; border-radius: 16px; display: block;"
        />
      `;
      console.log('[WalletConnector] QR code generated successfully');
    } catch (error) {
      console.error('[WalletConnector] Failed to generate QR code:', error);
      container.innerHTML = `
        <div style="width: 280px; height: 280px; background: #f5f5f5; border-radius: 16px; display: flex; align-items: center; justify-content: center; padding: 20px;">
          <p style="color: #333; font-size: 14px; text-align: center;">
            Failed to generate QR code
          </p>
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

    // Core theme values
    const backgroundColor = this.getAttribute('background-color') || '#000637';
    const textColor = this.getAttribute('text-color') || getTextColor(backgroundColor);
    const primaryColor = this.getAttribute('primary-color') || '#0ea5e9';
    const fontFamily = this.getAttribute('font-family') || "'Inter', sans-serif";
    const customCSS = this.getAttribute('custom-css') || '';

    this.primaryWalletId = this.getAttribute('primary-wallet');

    // Wallets
    const wallets = this.walletManager?.wallets || [];
    const primaryWallet = this.primaryWalletId
      ? wallets.find((w) => w.id === this.primaryWalletId)
      : null;
    const otherWallets = wallets.filter((w) => w.id !== this.primaryWalletId);

    // Render based on view state
    const contentHTML =
      this.viewState === 'qr' && this.qrCodeData
        ? this.renderQRView()
        : this.renderWalletListView(primaryWallet, otherWallets);

    this.shadow.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');

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
        width: 88%;
        max-width: 400px;
        max-height: 85vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: slideUp 0.3s ease-out;
        box-shadow: 0 8px 16px 20px rgba(0, 0, 0, 0.1);
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
        padding: 0 20px 20px;
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
        transition: all 0.2s;
      }

      .wallet-button:hover {
        background: var(--wallet-btn-hover);
        transform: translateX(3px);
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

      ${customCSS}
    </style>

    <div class="overlay" part="overlay">
      <div class="modal" part="modal">
        ${contentHTML}
      </div>
    </div>
  `;

    this.attachEventListeners();
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
          <div class="qr-placeholder" id="qr-container">
            <p>Loading QR Code...</p>
          </div>
          <div class="qr-instructions">
            <p>Scan with your ${walletName} app</p>
          </div>
          <div class="qr-deeplink">
            <button class="deeplink-button" id="deeplink-button">
              Open ${walletName}
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

    // Back button
    this.shadow.querySelector('#back-button')?.addEventListener('click', () => {
      this.showWalletList();
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
