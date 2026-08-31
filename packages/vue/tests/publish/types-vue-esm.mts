import type { Component, Plugin } from 'vue';
import {
  WalletConnector,
  createXrplConnect,
  isWalletError,
  useSigner,
  useWallet,
  useWalletModal,
  type XrplConnectConfig,
} from '@xrpl-commons/xrpl-connect-vue';
import type {
  ManagedSignedMessage,
  ManagedSignedTransaction,
  Transaction,
  WalletError,
} from 'xrpl-connect';

const mainnetConfig: XrplConnectConfig = { adapters: [], network: 'mainnet' };
const customNetworkConfig: XrplConnectConfig = {
  adapters: [],
  network: { id: 'sidechain', name: 'Sidechain', wss: 'wss://sidechain.example.com' },
};
const invalidNetworkConfig: XrplConnectConfig = {
  adapters: [],
  // @ts-expect-error Vue's published config must reject arbitrary string network IDs.
  network: 'sidechain',
};

const plugin: Plugin = createXrplConnect({ adapters: [] });
const connector: Component = WalletConnector;
const signer = null as unknown as ReturnType<typeof useSigner>;
const signedTransaction: Promise<ManagedSignedTransaction> = signer.sign({} as Transaction);
const signedMessage: Promise<ManagedSignedMessage> = signer.signMessage('message');
const errorGuard: (error: unknown) => error is WalletError = isWalletError;

void [
  plugin,
  connector,
  signedTransaction,
  signedMessage,
  errorGuard,
  useWallet,
  useWalletModal,
  mainnetConfig,
  customNetworkConfig,
  invalidNetworkConfig,
];
