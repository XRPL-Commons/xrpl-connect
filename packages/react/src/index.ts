/**
 * @xrpl-commons/xrpl-connect-react
 * React bindings for XRPL Connect: a provider that owns a single WalletManager,
 * hooks to use it, and a `<WalletConnector>` modal component. (#33)
 *
 * `src/jsx.d.ts` provides the ambient `<xrpl-wallet-connector>` JSX typing used
 * internally by `<WalletConnector>` and by direct custom-element consumers.
 */
export { XrplConnectProvider } from './provider';
export { useWallet, useSigner, useWalletModal } from './hooks';
export { WalletConnector } from './WalletConnector';

export type {
  XrplConnectConfig,
  XrplConnectProviderProps,
  XrplConnectContextValue,
  WalletConnectorProps,
  WalletConnectorTheme,
  WalletConnectorElement,
} from './types';
export type { WalletConnectorIntrinsicProps } from './jsx';

// Re-export the error primitives so consumers can branch on codes without a
// second import from `xrpl-connect`.
export {
  WalletError,
  WalletErrorCode,
  WalletErrorCategory,
  isWalletError,
} from '@xrpl-connect/core';
