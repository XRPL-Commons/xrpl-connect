/**
 * XRPL Network Selector Web Component
 * A framework-agnostic web component for switching XRPL networks
 */

import type { WalletManager, NetworkInfo } from '@xrpl-connect/core';
import { STANDARD_NETWORKS, createLogger } from '@xrpl-connect/core';
import { networkSelectorStyles } from './styles/network-selector';

/**
 * Logger instance for network selector
 */
const logger = createLogger('[NetworkSelector]');

/**
 * Network colors for the dot indicator
 */
const NETWORK_COLORS: Record<string, string> = {
  mainnet: '#10b981', // Green
  testnet: '#3b82f6', // Blue
  devnet: '#f59e0b', // Orange
};

/**
 * Get the color for a network
 */
function getNetworkColor(networkId: string): string {
  return NETWORK_COLORS[networkId] || '#6b7280'; // Default gray for custom networks
}

/**
 * Get short label for a network
 */
function getNetworkLabel(network: NetworkInfo): string {
  switch (network.id) {
    case 'mainnet':
      return 'Main';
    case 'testnet':
      return 'Test';
    case 'devnet':
      return 'Dev';
    default:
      return network.name.substring(0, 4);
  }
}

// Only define the component in browser (guard against SSR)
let NetworkSelectorElement: any = null;

if (typeof window !== 'undefined' && typeof HTMLElement !== 'undefined') {
  class NetworkSelectorElementImpl extends HTMLElement {
    private walletManager: WalletManager | null = null;
    private shadow: ShadowRoot;
    private isDropdownOpen = false;
    private currentNetwork: NetworkInfo;
    private isSwitching = false;

    constructor() {
      super();
      this.shadow = this.attachShadow({ mode: 'open' });
      // Default to testnet
      this.currentNetwork = STANDARD_NETWORKS.testnet;
    }

    connectedCallback() {
      this.render();

      // Close dropdown when clicking outside
      document.addEventListener('click', this.handleOutsideClick);
    }

    disconnectedCallback() {
      document.removeEventListener('click', this.handleOutsideClick);
    }

    private handleOutsideClick = (event: MouseEvent) => {
      if (!this.contains(event.target as Node)) {
        this.closeDropdown();
      }
    };

    /**
     * Set the WalletManager instance
     */
    setWalletManager(manager: WalletManager) {
      this.walletManager = manager;

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

      // Listen to network changes
      manager.on('networkChanged', (network: unknown) => {
        if (network && typeof network === 'object' && 'id' in network) {
          this.currentNetwork = network as NetworkInfo;
          this.render();
        }
      });

      // Listen to connect events to update network from account
      manager.on('connect', (account: unknown) => {
        if (account && typeof account === 'object' && 'network' in account) {
          const acc = account as { network: NetworkInfo };
          this.currentNetwork = acc.network;
          this.render();
        }
      });

      this.render();
    }

    /**
     * Get available networks
     */
    private getNetworks(): NetworkInfo[] {
      return Object.values(STANDARD_NETWORKS);
    }

    /**
     * Open the dropdown
     */
    private openDropdown() {
      this.isDropdownOpen = true;
      this.render();
    }

    /**
     * Close the dropdown
     */
    private closeDropdown() {
      if (this.isDropdownOpen) {
        this.isDropdownOpen = false;
        this.render();
      }
    }

    /**
     * Toggle the dropdown
     */
    private toggleDropdown() {
      if (this.isDropdownOpen) {
        this.closeDropdown();
      } else {
        this.openDropdown();
      }
    }

    /**
     * Switch to a different network
     */
    private async switchNetwork(network: NetworkInfo) {
      if (this.isSwitching || network.id === this.currentNetwork.id) {
        this.closeDropdown();
        return;
      }

      this.isSwitching = true;
      this.closeDropdown();

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
            // Emit error event but don't throw
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
        this.isSwitching = false;
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
     * Render the component
     */
    private render() {
      const networks = this.getNetworks();
      const currentColor = getNetworkColor(this.currentNetwork.id);
      const currentLabel = getNetworkLabel(this.currentNetwork);

      this.shadow.innerHTML = `
        <style>
          ${networkSelectorStyles}
        </style>

        <div class="network-selector">
          <button
            class="network-button${this.isSwitching ? ' switching' : ''}"
            id="network-toggle"
            part="network-button"
            ${this.isSwitching ? 'disabled' : ''}
          >
            <span class="network-dot" style="background-color: ${currentColor}"></span>
            <span class="network-label">${this.isSwitching ? '...' : currentLabel}</span>
            <svg class="chevron${this.isDropdownOpen ? ' open' : ''}" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          ${
            this.isDropdownOpen
              ? `
          <div class="dropdown" part="dropdown">
            <div class="dropdown-header">Select Network</div>
            ${networks
              .map(
                (network) => `
              <button
                class="dropdown-item${network.id === this.currentNetwork.id ? ' active' : ''}"
                data-network-id="${network.id}"
              >
                <span class="network-dot" style="background-color: ${getNetworkColor(network.id)}"></span>
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
      `;

      this.attachEventListeners();
    }

    /**
     * Attach event listeners
     */
    private attachEventListeners() {
      // Toggle button
      const toggleButton = this.shadow.querySelector('#network-toggle');
      if (toggleButton) {
        toggleButton.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleDropdown();
        });
      }

      // Dropdown items
      const dropdownItems = this.shadow.querySelectorAll('.dropdown-item');
      dropdownItems.forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const networkId = (item as HTMLElement).dataset.networkId;
          if (networkId && STANDARD_NETWORKS[networkId]) {
            this.switchNetwork(STANDARD_NETWORKS[networkId]);
          }
        });
      });
    }
  }

  // Assign the class to the export variable
  NetworkSelectorElement = NetworkSelectorElementImpl;

  // Register the custom element
  if (!customElements.get('xrpl-network-selector')) {
    customElements.define('xrpl-network-selector', NetworkSelectorElement);
  }
}

// Export the class (will be null on server, defined on client)
export { NetworkSelectorElement };
