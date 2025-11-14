/// <reference types="vite/client" />

// TypeScript declarations for XRPL Connect web components
declare namespace JSX {
  interface IntrinsicElements {
    'xrpl-wallet-connector': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        'primary-wallet'?: string;
        ref?: React.Ref<any>;
      },
      HTMLElement
    >;
  }
}
