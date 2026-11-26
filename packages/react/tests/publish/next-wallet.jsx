'use client';

import { WalletConnector, XrplConnectProvider } from '@xrpl-commons/xrpl-connect-react';
import { XamanAdapter } from 'xrpl-connect';

const config = { adapters: [new XamanAdapter({ apiKey: 'publish-smoke-test' })] };

export default function Wallet() {
  return (
    <XrplConnectProvider config={config}>
      <WalletConnector />
    </XrplConnectProvider>
  );
}
