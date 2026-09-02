import { useCallback } from 'react';
import type {
  Transaction,
  ManagedSignedTransaction,
  SubmittedTransaction,
  ManagedSignedMessage,
} from '@xrpl-connect/core';
import { useXrplConnectContext } from './provider';

/**
 * Reactive wallet state and connection actions. Re-renders when the connection
 * state changes. No need to create a `WalletManager` yourself — it comes from
 * the nearest {@link XrplConnectProvider}.
 *
 * @example
 * const { connected, account, connect, disconnect, error } = useWallet();
 */
export function useWallet() {
  const { manager, connected, account, network, connecting, error, connect, disconnect } =
    useXrplConnectContext();
  return { manager, connected, account, network, connecting, error, connect, disconnect };
}

/**
 * Signing actions bound to the current wallet. Each rejects with a typed
 * `WalletError` (`error.code` / `error.category`) — e.g. `SIGN_REJECTED` when the
 * user cancels.
 *
 * @example
 * const { signAndSubmit } = useSigner();
 * await signAndSubmit({ TransactionType: 'Payment', ... });
 */
export function useSigner() {
  const { manager } = useXrplConnectContext();

  const sign = useCallback(
    (transaction: Transaction): Promise<ManagedSignedTransaction> => manager.sign(transaction),
    [manager]
  );
  const signAndSubmit = useCallback(
    (transaction: Transaction): Promise<SubmittedTransaction> => manager.signAndSubmit(transaction),
    [manager]
  );
  const signMessage = useCallback(
    (message: string | Uint8Array): Promise<ManagedSignedMessage> => manager.signMessage(message),
    [manager]
  );

  return { sign, signAndSubmit, signMessage };
}

/**
 * Imperatively control the `<WalletConnector>` modal.
 *
 * @example
 * const { ready, open } = useWalletModal();
 * <button disabled={!ready} onClick={() => void open()}>Connect Wallet</button>
 */
export function useWalletModal() {
  const { ready, openModal, openAndWaitModal, closeModal } = useXrplConnectContext();
  return { ready, open: openModal, openAndWait: openAndWaitModal, close: closeModal };
}
