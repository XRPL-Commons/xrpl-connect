import type { ComponentProps, ComponentType } from 'react';
import {
  WalletConnector,
  XrplConnectProvider,
  isWalletError,
  useSigner,
  useWallet,
  useWalletModal,
  type WalletConnectorProps,
} from '@xrpl-commons/xrpl-connect-react';
import type {
  ManagedSignedMessage,
  ManagedSignedTransaction,
  Transaction,
  WalletError,
} from 'xrpl-connect';

const provider: ComponentType<ComponentProps<typeof XrplConnectProvider>> = XrplConnectProvider;
const connector: ComponentType<WalletConnectorProps> = WalletConnector;
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

void [provider, connector, signedTransaction, signedMessage, errorGuard, useWallet, useWalletModal];
