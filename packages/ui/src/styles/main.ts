import { SIZES, TIMINGS, Z_INDEX, FONT_WEIGHTS } from '../constants';

export const mainStyles = `
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
`;
