import type { Component, Plugin } from 'vue';
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
  WalletError,
} from 'xrpl-connect';

const plugin: Plugin = createXrplConnect({ adapters: [] });
const connector: Component = WalletConnector;
const signer = null as unknown as ReturnType<typeof useSigner>;
const signedTransaction: Promise<ManagedSignedTransaction> = signer.sign({} as Transaction);
const signedMessage: Promise<ManagedSignedMessage> = signer.signMessage('message');
const errorGuard: (error: unknown) => error is WalletError = isWalletError;

void [plugin, connector, signedTransaction, signedMessage, errorGuard, useWallet, useWalletModal];
