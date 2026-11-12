---
description: Integrate XRPL Connect v1.0 with React and Next.js using the official provider, hooks, and connector.
---

# React and Next.js

Use the official React bindings instead of building a custom context around the web component.

## Install

These commands install the coordinated stable v1 packages. Keep the SDK and React binding on the
same release line.

```bash
pnpm add xrpl-connect @xrpl-commons/xrpl-connect-react xrpl@^4 react react-dom
```

## Configure the provider

Create the adapter configuration once, outside component render. The provider snapshots its initial configuration and owns one manager; changing the object does not rebuild it. Give the provider a new React `key` only when you intentionally want to replace that manager. This Vite example uses client-visible `VITE_*` variables:

```tsx
import { XrplConnectProvider, WalletConnector } from '@xrpl-commons/xrpl-connect-react';
import {
  CrossmarkAdapter,
  MetaMaskSnapAdapter,
  WalletConnectAdapter,
  XamanAdapter,
} from 'xrpl-connect';

const config = {
  adapters: [
    new XamanAdapter({ apiKey: import.meta.env.VITE_XAMAN_API_KEY }),
    new CrossmarkAdapter(),
    new WalletConnectAdapter({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
    }),
    new MetaMaskSnapAdapter(),
  ],
  network: 'testnet' as const,
  autoConnect: true,
};

export function App() {
  return (
    <XrplConnectProvider config={config}>
      <Header />
      <WalletConnector
        wallets={['xaman', 'crossmark', 'walletconnect', 'metamask-snap']}
        showUnavailable
        theme="dark"
        onError={(error) => console.error(error.code, error.message)}
      />
    </XrplConnectProvider>
  );
}
```

## Privy social login

Install `@xrpl-commons/xrpl-connect-privy` and add its `PrivyAdapter` to the stable
configuration above. For Vite, the optional configuration used by the
[React demo](https://github.com/XRPL-Commons/xrpl-connect/tree/develop/examples/react) is:

```tsx
import { PrivyAdapter } from '@xrpl-commons/xrpl-connect-privy';

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID?.trim();
const privyAdapters = privyAppId
  ? [
      new PrivyAdapter({
        appId: privyAppId,
        clientId: import.meta.env.VITE_PRIVY_CLIENT_ID?.trim() || undefined,
        redirectUri:
          import.meta.env.VITE_PRIVY_REDIRECT_URI?.trim() ||
          `${window.location.origin}/wallet/privy`,
      }),
    ]
  : [];
```

Spread `...privyAdapters` into `config.adapters`. If the connector has a `wallets`
filter, include `'privy'` in it or remove the filter to show every configured
adapter. The chooser discovers the enabled methods from Privy; no `socialLogins`
prop is required. Keep `autoConnect: true`: the provider attaches its listeners
before restoring a session or completing an OAuth callback, including under
React Strict Mode. Do not add a second reconnect effect.

Allow the origin and callback in Privy and serve the same application at the
callback path. See [local demo setup and manual testing](/guide/social-login#run-the-demos).
For Next.js, create these adapters inside the client-only boundary described below.

## Wallet state

`useWallet()` provides the stable manager, reactive state, and direct connect/disconnect actions.

```tsx
import { useWallet, useWalletModal } from '@xrpl-commons/xrpl-connect-react';

function Header() {
  const { connected, connecting, account, network, error, disconnect } = useWallet();
  const { ready, open } = useWalletModal();

  if (!connected || !account) {
    return (
      <button onClick={() => void open()} disabled={!ready || connecting}>
        Connect wallet
      </button>
    );
  }

  return (
    <div>
      <span>{account.address}</span>
      <span>{network?.name}</span>
      {error && <span role="alert">{error.message}</span>}
      <button onClick={() => void disconnect()}>Disconnect</button>
    </div>
  );
}
```

The hook returns `manager`, `connected`, `account`, `network`, `connecting`, `error`, `connect`, and `disconnect`.

## Signing

```tsx
import { WalletErrorCode, isWalletError } from 'xrpl-connect';
import { useSigner, useWallet } from '@xrpl-commons/xrpl-connect-react';

function PaymentButton({ destination }: { destination: string }) {
  const { account } = useWallet();
  const { signAndSubmit } = useSigner();

  const pay = async () => {
    if (!account) return;

    try {
      const result = await signAndSubmit({
        TransactionType: 'Payment',
        Account: account.address,
        Destination: destination,
        Amount: '1000000',
      });
      console.log(result.hash);
    } catch (error) {
      if (isWalletError(error) && error.code === WalletErrorCode.SIGN_REJECTED) return;
      throw error;
    }
  };

  return (
    <button onClick={() => void pay()} disabled={!account}>
      Pay 1 XRP
    </button>
  );
}
```

`useSigner()` exposes `sign`, `signAndSubmit`, and `signMessage`. Check `manager.supports('signMessage')` before offering arbitrary message signing.

## Modal control

`useWalletModal()` returns reactive `ready`, `open(): Promise<void>`,
`openAndWait(): Promise<AccountInfo>`, and `close(): void`. `open()` resolves when the modal opens;
wallet availability is discovered in the background with cached choices or a loading status.
Await `openAndWait()` when the caller needs the connected account; it rejects if the modal
closes before a connection completes.

`ready` becomes `true` after a connector registers and returns to `false` after the last connector
unmounts. Calling `open()` or `openAndWait()` while it is `false` rejects with a namespaced setup
error. With multiple connectors, the newest registration owns modal calls; unmounting it falls
back to the previous connector. `close()` is a safe no-op when none is registered.

`WalletConnector` accepts:

- `primaryWallet` and ordered `wallets`
- `showUnavailable` to include Install or disabled Unavailable wallet rows
- `theme`: `dark`, `light`, or `purple`
- typed `--xc-*` values through `cssVars`
- `className`, `style`, `onConnecting`, `onConnect`, and `onError`
- standard host attributes such as `id`, `title`, `data-*`, and `aria-*`
- a typed `WalletConnectorElement` ref exposing `open()`, `openAndWait()`, `close()`, and `toggle()`

```tsx
import { useRef } from 'react';
import { WalletConnector, type WalletConnectorElement } from '@xrpl-commons/xrpl-connect-react';

function WalletModal() {
  const connectorRef = useRef<WalletConnectorElement>(null);

  return (
    <WalletConnector
      ref={connectorRef}
      id="wallet-modal"
      aria-label="Choose a wallet"
      data-testid="wallet-connector"
    />
  );
}
```

Explicit `primaryWallet`, `wallets`, and `className` values take precedence over overlapping raw
host attributes. For each CSS property, `style` takes precedence over `cssVars`, which takes
precedence over the selected `theme`.

Unavailable wallets are hidden by default. The camelCase `showUnavailable` prop maps to the native
`show-unavailable` boolean attribute; setting the prop to `false` removes the attribute again.

## Next.js App Router

The package is safe to import during server rendering. Provider and wallet UI usage still require a client boundary because they use browser wallet APIs:

```tsx
'use client';

import { XrplConnectProvider, WalletConnector } from '@xrpl-commons/xrpl-connect-react';
import type { ReactNode } from 'react';
import { WalletConnectAdapter, XamanAdapter } from 'xrpl-connect';

const config = {
  adapters: [
    new XamanAdapter({ apiKey: process.env.NEXT_PUBLIC_XAMAN_API_KEY! }),
    new WalletConnectAdapter({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
    }),
  ],
  network: 'testnet' as const,
};

export function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <XrplConnectProvider config={config}>
      {children}
      <WalletConnector />
    </XrplConnectProvider>
  );
}
```

Expose browser identifiers with `NEXT_PUBLIC_*`; do not expose secrets. Dynamic import with `ssr: false` is optional for route-level code splitting, not required to make the package importable.

## Lifecycle guarantees

The provider owns one manager, subscribes before auto-connect can update state, and cancels owned pending connections on unmount. Do not add a second custom context or duplicate manager listeners around it.

See [transactions and signing](/guide/transactions), [production and security](/guide/production), and the runnable [`examples/react`](https://github.com/XRPL-Commons/xrpl-connect/tree/develop/examples/react) application.
