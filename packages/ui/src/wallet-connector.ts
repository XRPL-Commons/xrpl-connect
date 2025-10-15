/**
 * XRPL Wallet Connector Web Component
 * A framework-agnostic web component for connecting to XRPL wallets
 */

import type { WalletManager } from '@xrpl-connect/core';

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
  const [rs, gs, bs] = [r, g, b].map(c => {
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

  // Observed attributes
  static get observedAttributes() {
    return ['background-color', 'primary-wallet', 'show-help'];
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
      this.dispatchEvent(new CustomEvent('connecting', { detail: { walletId } }));
      await this.walletManager.connect(walletId, options);
      this.dispatchEvent(new CustomEvent('connected', { detail: { walletId } }));
    } catch (error) {
      this.dispatchEvent(new CustomEvent('error', { detail: { error, walletId } }));
      console.error('Failed to connect:', error);
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

    const backgroundColor = this.getAttribute('background-color') || '#2d3748';
    const textColor = getTextColor(backgroundColor);
    const showHelp = this.getAttribute('show-help') !== 'false';
    this.primaryWalletId = this.getAttribute('primary-wallet');

    // Get available wallets
    const wallets = this.walletManager?.wallets || [];
    const primaryWallet = this.primaryWalletId
      ? wallets.find(w => w.id === this.primaryWalletId)
      : null;
    const otherWallets = wallets.filter(w => w.id !== this.primaryWalletId);

    this.shadow.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        :host {
          --bg-color: ${backgroundColor};
          --text-color: ${textColor};
          --primary-color: #0ea5e9;
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
          border-radius: 24px;
          width: 90%;
          max-width: 460px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s ease-out;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 24px 20px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .help-button {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: var(--wallet-btn-bg);
          color: var(--text-color);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          transition: all 0.2s;
        }

        .help-button:hover {
          background: var(--wallet-btn-hover);
          transform: scale(1.05);
        }

        .title {
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }

        .close-button {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: var(--text-color);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          transition: all 0.2s;
          opacity: 0.7;
        }

        .close-button:hover {
          opacity: 1;
          background: var(--wallet-btn-bg);
        }

        .content {
          flex: 1;
          overflow-y: auto;
          padding: 0 24px 24px;
        }

        .primary-wallet {
          margin-bottom: 20px;
        }

        .primary-button {
          width: 100%;
          padding: 20px 24px;
          border-radius: 16px;
          border: none;
          background: var(--primary-color);
          color: white;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: all 0.2s;
        }

        .primary-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(14, 165, 233, 0.3);
        }

        .primary-button:active {
          transform: translateY(0);
        }

        .wallet-icon {
          width: 28px;
          height: 28px;
          object-fit: contain;
        }

        .divider {
          text-align: center;
          margin: 24px 0;
          color: var(--text-color);
          opacity: 0.5;
          font-size: 14px;
        }

        .wallet-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .wallet-button {
          width: 100%;
          padding: 20px 24px;
          border-radius: 16px;
          border: none;
          background: var(--wallet-btn-bg);
          color: var(--text-color);
          font-size: 18px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.2s;
        }

        .wallet-button:hover {
          background: var(--wallet-btn-hover);
          transform: translateX(4px);
        }

        .wallet-button:active {
          transform: translateX(2px);
        }

        .wallet-icons {
          display: flex;
          gap: 6px;
        }

        .wallet-icons img {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }

        .footer {
          padding: 16px 24px 24px;
          text-align: center;
        }

        .footer-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--text-color);
          text-decoration: none;
          font-size: 14px;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .footer-link:hover {
          opacity: 1;
        }

        .checkbox-icon {
          width: 20px;
          height: 20px;
          border: 2px solid currentColor;
          border-radius: 4px;
        }

        /* Scrollbar styles */
        .content::-webkit-scrollbar {
          width: 8px;
        }

        .content::-webkit-scrollbar-track {
          background: transparent;
        }

        .content::-webkit-scrollbar-thumb {
          background: var(--wallet-btn-bg);
          border-radius: 4px;
        }

        .content::-webkit-scrollbar-thumb:hover {
          background: var(--wallet-btn-hover);
        }
      </style>

      <div class="overlay" part="overlay">
        <div class="modal" part="modal">
          <div class="header">
            <div class="header-left">
              ${showHelp ? `
                <button class="help-button" part="help-button" aria-label="Help">
                  ?
                </button>
              ` : ''}
              <h2 class="title">Connect Wallet</h2>
            </div>
            <button class="close-button" part="close-button" aria-label="Close">
              ×
            </button>
          </div>

          <div class="content">
            ${primaryWallet ? `
              <div class="primary-wallet">
                <button class="primary-button" data-wallet-id="${primaryWallet.id}">
                  ${primaryWallet.icon ? `<img src="${primaryWallet.icon}" alt="${primaryWallet.name}" class="wallet-icon">` : ''}
                  <span>Continue with ${primaryWallet.name}</span>
                </button>
              </div>

              <div class="divider">or select a wallet from the list below</div>
            ` : ''}

            <div class="wallet-list">
              ${otherWallets.map(wallet => `
                <button class="wallet-button" data-wallet-id="${wallet.id}">
                  <span>${wallet.name}</span>
                  ${wallet.icon ? `
                    <div class="wallet-icons">
                      <img src="${wallet.icon}" alt="${wallet.name}">
                    </div>
                  ` : ''}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="footer">
            <a href="https://xrpl.org/wallets" target="_blank" class="footer-link">
              <span class="checkbox-icon"></span>
              <span>I don't have a wallet</span>
            </a>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    this.shadow.querySelector('.close-button')?.addEventListener('click', () => {
      this.close();
    });

    this.shadow.querySelector('.overlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.close();
      }
    });

    this.shadow.querySelectorAll('[data-wallet-id]').forEach(button => {
      button.addEventListener('click', () => {
        const walletId = (button as HTMLElement).dataset.walletId;
        if (walletId) {
          this.connectWallet(walletId);
        }
      });
    });
  }

  /**
   * Adjust color brightness
   */
  private adjustColor(hex: string, amount: number): string {
    const color = hex.replace('#', '');
    const num = parseInt(color, 16);

    let r = (num >> 16) + Math.round(255 * amount);
    let g = ((num >> 8) & 0x00FF) + Math.round(255 * amount);
    let b = (num & 0x0000FF) + Math.round(255 * amount);

    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }
}

// Register the custom element
if (typeof window !== 'undefined' && !customElements.get('xrpl-wallet-connector')) {
  customElements.define('xrpl-wallet-connector', WalletConnectorElement);
}
