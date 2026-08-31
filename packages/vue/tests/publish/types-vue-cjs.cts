import type { Component, Plugin, Ref } from 'vue';
import {
  WalletConnector,
  createXrplConnect,
  isWalletError,
  useSigner,
  useWallet,
  useWalletModal,
} from '@xrpl-commons/xrpl-connect-vue';
import type {
  ManagedSignedMessage,
  ManagedSignedTransaction,
  Transaction,
  AccountInfo,
  WalletError,
} from 'xrpl-connect';

const plugin: Plugin = createXrplConnect({ adapters: [] });
const connector: Component = WalletConnector;
const modal = null as unknown as ReturnType<typeof useWalletModal>;
const modalReady: Readonly<Ref<boolean>> = modal.ready;
// @ts-expect-error Connector readiness is exposed as a readonly ref.
modal.ready.value = true;
const modalOpen: Promise<void> = modal.open();
const modalAccount: Promise<AccountInfo> = modal.openAndWait();
const signer = null as unknown as ReturnType<typeof useSigner>;
const signedTransaction: Promise<ManagedSignedTransaction> = signer.sign({} as Transaction);
const signedMessage: Promise<ManagedSignedMessage> = signer.signMessage('message');
const errorGuard: (error: unknown) => error is WalletError = isWalletError;

void [
  plugin,
  connector,
  modalReady,
  modalOpen,
  modalAccount,
  signedTransaction,
  signedMessage,
  errorGuard,
  useWallet,
  useWalletModal,
];
