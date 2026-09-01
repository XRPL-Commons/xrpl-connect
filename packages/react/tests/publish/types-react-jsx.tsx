import { createRef, type ComponentProps } from 'react';
import {
  WalletConnector,
  XrplConnectProvider,
  type WalletConnectorElement,
} from '@xrpl-commons/xrpl-connect-react';
import type { AccountInfo, WalletError, WalletIdentifier } from 'xrpl-connect';

const connectorRef = createRef<WalletConnectorElement>();
const connectorProps: ComponentProps<'xrpl-wallet-connector'> = {
  ref: connectorRef,
  'primary-wallet': 'xaman',
  wallets: 'xaman,crossmark',
  'show-unavailable': true,
  class: 'wallet-connector',
};
const customElement = <xrpl-wallet-connector {...connectorProps} />;
const invalidRef = (
  <xrpl-wallet-connector
    // @ts-expect-error The custom-element ref exposes WalletConnectorElement, not another host.
    ref={createRef<HTMLButtonElement>()}
  />
);
const provider = (
  <XrplConnectProvider config={{ adapters: [], network: 'testnet' }}>
    <WalletConnector
      primaryWallet="xaman"
      wallets={['xaman', 'crossmark']}
      onConnecting={(walletId) => {
        const typedWalletId: WalletIdentifier = walletId;
        void typedWalletId;
      }}
      onConnect={(account) => {
        const typedAccount: AccountInfo = account;
        void typedAccount;
      }}
      onError={(error) => {
        const typedError: WalletError = error;
        void typedError;
      }}
    />
  </XrplConnectProvider>
);

void [customElement, invalidRef, provider];
