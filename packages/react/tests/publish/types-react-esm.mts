import type { ComponentProps, ComponentType } from 'react';
import {
  WalletConnector,
  XrplConnectProvider,
  isWalletError,
  useSigner,
  useWallet,
  useWalletModal,
  type WalletConnectorProps,
  type XrplConnectConfig,
} from '@xrpl-commons/xrpl-connect-react';
import type {
  ManagedSignedMessage,
  ManagedSignedTransaction,
  Transaction,
  WalletError,
} from 'xrpl-connect';

interface TypedCustomWalletOptions {
  credential: string;
}

declare module 'xrpl-connect' {
  interface WalletConnectionOptionsById {
    'typed-custom-wallet': TypedCustomWalletOptions;
  }
}

const mainnetConfig: XrplConnectConfig = { adapters: [], network: 'mainnet' };
const customNetworkConfig: XrplConnectConfig = {
  adapters: [],
  network: { id: 'sidechain', name: 'Sidechain', wss: 'wss://sidechain.example.com' },
};
const invalidNetworkConfig: XrplConnectConfig = {
  adapters: [],
  // @ts-expect-error React's published config must reject arbitrary string network IDs.
  network: 'sidechain',
};

const provider: ComponentType<ComponentProps<typeof XrplConnectProvider>> = XrplConnectProvider;
const connector: ComponentType<WalletConnectorProps> = WalletConnector;
const cssVarsProps: WalletConnectorProps = { cssVars: { '--xc-primary-color': '#7c3aed' } };
const invalidCssVarsProps: WalletConnectorProps = {
  cssVars: {
    // @ts-expect-error Published React props reject unsupported CSS variables.
    '--xc-primary-colro': '#7c3aed',
  },
};
const signer = null as unknown as ReturnType<typeof useSigner>;
const wallet = null as unknown as ReturnType<typeof useWallet>;
void wallet.connect('xaman', { apiKey: 'api-key' });
void wallet.connect('walletconnect', { projectId: 'project-id' });
// @ts-expect-error Xaman deferred options do not accept a WalletConnect project ID.
void wallet.connect('xaman', { projectId: 'project-id' });
void wallet.connect('custom-wallet', { customCredential: 'credential' });
void wallet.connect('typed-custom-wallet', { credential: 'credential' });
// @ts-expect-error Augmented custom wallet mappings reject unrelated options.
void wallet.connect('typed-custom-wallet', { otherCredential: 'credential' });
const signedTransaction: Promise<ManagedSignedTransaction> = signer.sign({} as Transaction);
const signedMessage: Promise<ManagedSignedMessage> = signer.signMessage('message');
const errorGuard: (error: unknown) => error is WalletError = isWalletError;

void [
  provider,
  connector,
  cssVarsProps,
  invalidCssVarsProps,
  signedTransaction,
  signedMessage,
  errorGuard,
  useWallet,
  useWalletModal,
  mainnetConfig,
  customNetworkConfig,
  invalidNetworkConfig,
];
