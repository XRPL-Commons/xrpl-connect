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

      .title {
        font-size: 22px;
        font-weight: 600;
        letter-spacing: -0.3px;
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
      }


      .primary-button {
        width: 100%;
        padding: 16px 20px;
        border-radius: 12px;
        border: none;
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

      .wallet-button {
        width: 70%;
        padding: 16px 20px;
        border-radius: 12px;
        margin: auto;
        margin-bottom: 16px; 
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
        transform: translateX(3px);
      }

      ${customCSS}
    </style>

    <div class="overlay" part="overlay">
      <div class="modal" part="modal">
        <div class="header">
          <h2 class="title">Connect Wallet</h2>
          <button class="close-button" part="close-button" aria-label="Close">×</button>
        </div>

        <div class="content">
          ${
            primaryWallet
              ? `
            <div class="wallet-list">
              <button class="wallet-button primary" data-wallet-id="${primaryWallet.id}">
                <span>${primaryWallet.name}</span>
                ${primaryWallet.icon ? `<img src="${primaryWallet.icon}" width="24" height="24" >` : ''}
              </button>
            </div>
          `
              : ''
          }
          <div class="wallet-list">
            ${otherWallets
              .map(
                (wallet) => `
              <button class="wallet-button" data-wallet-id="${wallet.id}">
                <span>${wallet.name}</span>
                ${wallet.icon ? `<img src="${wallet.icon}" width="24" height="24">` : ''}
              </button>`
              )
              .join('')}
          </div>
        </div>
      </div>
    </div>
  `;

    // Event listeners
    this.shadow.querySelector('.close-button')?.addEventListener('click', () => this.close());
    this.shadow.querySelector('.overlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.close();
    });
    this.shadow.querySelectorAll('[data-wallet-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const walletId = (button as HTMLElement).dataset.walletId;
        if (walletId) this.connectWallet(walletId);
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
