import type { DetailedHTMLProps, HTMLAttributes } from 'react';

/**
 * Declare the `<xrpl-wallet-connector>` custom element for JSX/TSX so it can be
 * rendered with typed attributes. The element itself is registered at runtime by
 * importing `xrpl-connect` (or `@xrpl-connect/ui`).
 */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'xrpl-wallet-connector': DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          'primary-wallet'?: string;
          wallets?: string;
          'background-color'?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};
