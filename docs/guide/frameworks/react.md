---
description: Integrate XRPL Connect v1.0 with React and Next.js using the official provider, hooks, and connector.
---

# React and Next.js

Use the official React bindings instead of building a custom context around the web component.

## Install

```bash
pnpm add xrpl-connect@rc @xrpl-connect/react@rc xrpl react react-dom
```

## Configure the provider

Create the adapter configuration once, outside component render. The provider snapshots its initial configuration and owns one manager; changing the object does not rebuild it. Give the provider a new React `key` only when you intentionally want to replace that manager. This Vite example uses client-visible `VITE_*` variables:

```tsx
import { XrplConnectProvider, WalletConnector } from '@xrpl-connect/react';
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
        theme="dark"
        onError={(error) => console.error(error.code, error.message)}
      />
    </XrplConnectProvider>
  );
}
```

## Wallet state

`useWallet()` provides the stable manager, reactive state, and direct connect/disconnect actions.

```tsx
import { useWallet, useWalletModal } from '@xrpl-connect/react';

function Header() {
  const { connected, connecting, account, network, error, disconnect } = useWallet();
  const { open } = useWalletModal();

  if (!connected || !account) {
    return (
      <button onClick={open} disabled={connecting}>
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
import { useSigner, useWallet } from '@xrpl-connect/react';

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

`useWalletModal()` returns `open` and `close`. Render one or more `<WalletConnector>` components inside the provider; modal ownership follows the mounted connector. `WalletConnector` accepts:

- `primaryWallet` and ordered `wallets`
- `theme`: `dark`, `light`, or `purple`
- typed `--xc-*` values through `cssVars`
- `className`, `style`, `onConnecting`, `onConnect`, and `onError`

## Next.js App Router

The package is safe to import during server rendering. Provider and wallet UI usage still require a client boundary because they use browser wallet APIs:

```tsx
'use client';

import { XrplConnectProvider, WalletConnector } from '@xrpl-connect/react';
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
