import { WalletConnectorElement } from './wallet-connector';

/** Register the connector element when a browser custom-elements registry exists. */
export function registerWalletConnector(): void {
  if (
    WalletConnectorElement &&
    typeof customElements !== 'undefined' &&
    !customElements.get('xrpl-wallet-connector')
  ) {
    customElements.define('xrpl-wallet-connector', WalletConnectorElement);
  }
}

registerWalletConnector();
