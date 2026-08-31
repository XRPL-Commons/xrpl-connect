import type { Component, Plugin, Ref } from 'vue';
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
  AccountInfo,
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
type WalletConnectorProps = InstanceType<typeof WalletConnector>['$props'];
const omittedShowUnavailableProps: WalletConnectorProps = {};
const showUnavailableProps: WalletConnectorProps = { showUnavailable: true };
const invalidShowUnavailableProps: WalletConnectorProps = {
  // @ts-expect-error Misspelled Vue props must not be accepted by the published component type.
  showUnavilable: true,
};
const modal = null as unknown as ReturnType<typeof useWalletModal>;
const modalReady: Readonly<Ref<boolean>> = modal.ready;
// @ts-expect-error Connector readiness is exposed as a readonly ref.
modal.ready.value = true;
const modalOpen: Promise<void> = modal.open();
const modalAccount: Promise<AccountInfo> = modal.openAndWait();
const signer = null as unknown as ReturnType<typeof useSigner>;
const wallet = null as unknown as ReturnType<typeof useWallet>;
void wallet.connect('xaman', { apiKey: 'api-key' });
void wallet.connect('walletconnect', { projectId: 'project-id' });
// @ts-expect-error Xaman deferred options do not accept a WalletConnect project ID.
void wallet.connect('xaman', { projectId: 'project-id' });
void wallet.connect('custom-wallet', { customCredential: 'credential' });
const signedTransaction: Promise<ManagedSignedTransaction> = signer.sign({} as Transaction);
const signedMessage: Promise<ManagedSignedMessage> = signer.signMessage('message');
const errorGuard: (error: unknown) => error is WalletError = isWalletError;

void [
  plugin,
  connector,
  omittedShowUnavailableProps,
  showUnavailableProps,
  invalidShowUnavailableProps,
  modalReady,
  modalOpen,
  modalAccount,
  signedTransaction,
  signedMessage,
  errorGuard,
  useWallet,
  useWalletModal,
  mainnetConfig,
  customNetworkConfig,
  invalidNetworkConfig,
];
