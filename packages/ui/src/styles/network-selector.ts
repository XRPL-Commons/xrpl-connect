import { FONT_WEIGHTS, TIMINGS, Z_INDEX } from '../constants';

export const networkSelectorStyles = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :host {
    display: inline-block;
    position: relative;
    font-family: var(--xc-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);

    /* Network selector specific variables */
    --xc-network-button-background: var(--xc-background-color, #000637);
    --xc-network-button-color: var(--xc-text-color, #F5F4E7);
    --xc-network-button-border: 1px solid rgba(255, 255, 255, 0.1);
    --xc-network-button-border-radius: 8px;
    --xc-network-dropdown-background: var(--xc-background-color, #000637);
    --xc-network-dropdown-border: 1px solid rgba(255, 255, 255, 0.1);
    --xc-network-dropdown-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    --xc-network-item-hover-background: var(--xc-background-secondary, #1a1a3e);
  }

  .network-selector {
    position: relative;
  }

  .network-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 50%;
    border: var(--xc-network-button-border);
    background: var(--xc-network-button-background);
    color: var(--xc-network-button-color);
    cursor: pointer;
    transition: all 0.2s;
  }

  .network-button:hover:not(:disabled) {
    background: var(--xc-network-item-hover-background);
  }

  .network-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .network-button.switching {
    opacity: 0.7;
  }

  .globe-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .network-dot {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 4px currentColor;
    border: 1.5px solid var(--xc-network-button-background);
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    min-width: 160px;
    background: var(--xc-network-dropdown-background);
    border: var(--xc-network-dropdown-border);
    border-radius: 12px;
    box-shadow: var(--xc-network-dropdown-shadow);
    z-index: ${Z_INDEX.OVERLAY};
    overflow: hidden;
    animation: slideDown ${TIMINGS.ANIMATION_DURATION}ms ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .dropdown-header {
    padding: 12px 16px 8px;
    font-size: 11px;
    font-weight: ${FONT_WEIGHTS.SEMIBOLD};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.5;
    color: var(--xc-network-button-color);
  }

  .dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border: none;
    background: transparent;
    color: var(--xc-network-button-color);
    font-size: 14px;
    font-weight: ${FONT_WEIGHTS.REGULAR};
    cursor: pointer;
    transition: background 0.15s ease;
    font-family: inherit;
    text-align: left;
  }

  .dropdown-item:hover {
    background: var(--xc-network-item-hover-background);
  }

  .dropdown-item.active {
    background: rgba(14, 165, 233, 0.1);
  }

  .dropdown-item .network-dot {
    width: 10px;
    height: 10px;
  }

  .network-name {
    flex: 1;
  }

  .check-icon {
    color: var(--xc-primary-color, #0EA5E9);
    flex-shrink: 0;
  }
`;
