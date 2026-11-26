import type { PrivyConnectOptions } from './privy-adapter';
import type { WalletConnectionOptionsById as _UmbrellaWalletConnectionOptionsById } from 'xrpl-connect';

export {
  PrivyAdapter,
  type PrivyAdapterOptions,
  type PrivyConnectOptions,
  type PrivyTransactionReviewOption,
} from './privy-adapter';
export type {
  PrivyMfaApi,
  PrivyMfaAnswer,
  PrivyMfaAssertion,
  PrivyMfaMode,
  PrivyMfaRequest,
  PrivyMfaStatus,
} from './mfa';
export type { PrivyLoginMethod, PrivyOAuthProvider } from './session-types';

declare module 'xrpl-connect' {
  interface WalletConnectionOptionsById {
    privy: PrivyConnectOptions;
  }
}

declare module 'xrpl-connect/core' {
  interface WalletConnectionOptionsById {
    privy: PrivyConnectOptions;
  }
}
