import { WalletConnectorElement, type WalletConnectorElementInstance } from '../dist/index';
import type { AccountInfo } from '@xrpl-connect/core';

const connector: WalletConnectorElementInstance = document.createElement('xrpl-wallet-connector');
const pendingAccount: Promise<AccountInfo> = connector.openAndWait();

if (WalletConnectorElement) {
  const constructed: WalletConnectorElementInstance = new WalletConnectorElement();
  void constructed;
}

void pendingAccount;
