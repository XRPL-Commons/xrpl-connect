/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID?: string;
  readonly VITE_PRIVY_CLIENT_ID?: string;
  readonly VITE_PRIVY_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

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
