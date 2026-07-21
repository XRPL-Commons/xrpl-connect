import type {
  ManagedSignedMessage,
  ManagedSignedTransaction,
  SubmittedTransaction,
  Transaction,
} from '@xrpl-connect/core';
import { useXrplConnectContext } from './context';

export { createXrplConnect } from './context';
export { WalletConnector } from './WalletConnector';
export type { WalletConnectorElement, XrplConnectConfig, XrplConnectContextValue } from './context';
export type { WalletConnectorTheme } from './WalletConnector';

export {
  WalletError,
  WalletErrorCode,
  WalletErrorCategory,
  isWalletError,
} from '@xrpl-connect/core';

export function useWallet() {
  const { manager, connected, account, network, connecting, error, connect, disconnect } =
    useXrplConnectContext();
  return { manager, connected, account, network, connecting, error, connect, disconnect };
}

export function useSigner() {
  const { manager } = useXrplConnectContext();
  return {
    sign: (transaction: Transaction): Promise<ManagedSignedTransaction> =>
      manager.sign(transaction),
    signAndSubmit: (transaction: Transaction): Promise<SubmittedTransaction> =>
      manager.signAndSubmit(transaction),
    signMessage: (message: string | Uint8Array): Promise<ManagedSignedMessage> =>
      manager.signMessage(message),
  };
}

export function useWalletModal() {
  const { openModal, closeModal } = useXrplConnectContext();
  return { open: openModal, close: closeModal };
}
