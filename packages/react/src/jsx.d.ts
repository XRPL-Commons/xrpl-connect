import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type { WalletConnectorElement } from './types';

/** Attributes supported by the `<xrpl-wallet-connector>` custom element in React JSX. */
export type WalletConnectorIntrinsicProps = DetailedHTMLProps<
  HTMLAttributes<WalletConnectorElement> & {
    'primary-wallet'?: string;
    wallets?: string;
    'show-unavailable'?: true | '';
    class?: string;
  },
  WalletConnectorElement
>;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'xrpl-wallet-connector': WalletConnectorIntrinsicProps;
    }
  }
}

/**
 * Declare the `<xrpl-wallet-connector>` custom element for JSX/TSX so it can be
 * rendered with typed attributes. The element itself is registered at runtime by
 * importing `xrpl-connect` (or `@xrpl-connect/ui`).
 */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'xrpl-wallet-connector': WalletConnectorIntrinsicProps;
    }
  }
}
