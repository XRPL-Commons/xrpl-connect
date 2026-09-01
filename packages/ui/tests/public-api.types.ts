import {
  WALLET_CONNECTOR_CSS_VARIABLES,
  WalletConnectorElement,
  type WalletConnectorCssVariable,
  type WalletConnectorCssVars,
  type WalletConnectorElementInstance,
} from '../dist/index';
import type { AccountInfo } from '@xrpl-connect/core';

const connector: WalletConnectorElementInstance = document.createElement('xrpl-wallet-connector');
const pendingAccount: Promise<AccountInfo> = connector.openAndWait();
const firstCssVariable: WalletConnectorCssVariable = WALLET_CONNECTOR_CSS_VARIABLES[0];
const cssVars: WalletConnectorCssVars = { '--xc-primary-color': '#7c3aed' };
const invalidCssVars: WalletConnectorCssVars = {
  // @ts-expect-error Unsupported or misspelled CSS variables are rejected.
  '--xc-primary-colro': '#7c3aed',
};

if (WalletConnectorElement) {
  const constructed: WalletConnectorElementInstance = new WalletConnectorElement();
  void constructed;
}

void pendingAccount;
void firstCssVariable;
void cssVars;
void invalidCssVars;
