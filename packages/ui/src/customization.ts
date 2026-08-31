/** CSS custom properties supported by the wallet connector and its portals. */
export const WALLET_CONNECTOR_CSS_VARIABLES = [
  '--xc-font-family',
  '--xc-border-radius',
  '--xc-overlay-background',
  '--xc-overlay-backdrop-filter',
  '--xc-primary-color',
  '--xc-background-color',
  '--xc-text-color',
  '--xc-text-muted-color',
  '--xc-background-secondary',
  '--xc-background-tertiary',
  '--xc-loading-border-color',
  '--xc-connect-button-font-size',
  '--xc-connect-button-border-radius',
  '--xc-connect-button-color',
  '--xc-connect-button-background',
  '--xc-connect-button-border',
  '--xc-connect-button-hover-background',
  '--xc-connect-button-font-weight',
  '--xc-primary-button-color',
  '--xc-primary-button-background',
  '--xc-primary-button-border-radius',
  '--xc-primary-button-font-weight',
  '--xc-primary-button-hover-background',
  '--xc-secondary-button-color',
  '--xc-secondary-button-background',
  '--xc-secondary-button-border-radius',
  '--xc-secondary-button-font-weight',
  '--xc-secondary-button-hover-background',
  '--xc-account-address-button-hover-color',
  '--xc-modal-background',
  '--xc-modal-border-radius',
  '--xc-modal-box-shadow',
  '--xc-focus-color',
  '--xc-danger-color',
  '--xc-success-color',
  '--xc-warning-color',
] as const;

/** A CSS custom property supported by {@link WALLET_CONNECTOR_CSS_VARIABLES}. */
export type WalletConnectorCssVariable = (typeof WALLET_CONNECTOR_CSS_VARIABLES)[number];

/** Exact wallet connector CSS-variable overrides. */
export type WalletConnectorCssVars = Partial<Record<WalletConnectorCssVariable, string>>;

/** Stable attributes used by the body-level modal portal hosts. */
export const WALLET_CONNECTOR_PORTAL_ATTRIBUTES = {
  wallet: 'data-xrpl-overlay-portal',
  account: 'data-xrpl-account-modal-portal',
} as const;

/** Stable selectors for the body-level modal portal hosts. */
export const WALLET_CONNECTOR_PORTAL_SELECTORS = {
  wallet: `[${WALLET_CONNECTOR_PORTAL_ATTRIBUTES.wallet}]`,
  account: `[${WALLET_CONNECTOR_PORTAL_ATTRIBUTES.account}]`,
} as const;

/** Stable shadow parts grouped by the shadow host that exposes them. */
export const WALLET_CONNECTOR_PARTS = {
  connector: {
    connectButton: 'connect-button',
  },
  walletModal: {
    overlay: 'overlay',
    modal: 'modal',
    closeButton: 'close-button',
  },
  accountModal: {
    overlay: 'overlay',
    modal: 'modal',
    closeButton: 'close-button',
    addressButton: 'account-address-button',
    disconnectButton: 'disconnect-button',
  },
} as const;
