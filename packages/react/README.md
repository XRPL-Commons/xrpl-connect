# @xrpl-connect/react

React bindings for [XRPL Connect](https://github.com/XRPL-Commons/xrpl-connect): a
provider that owns a single `WalletManager`, hooks to use it, and a `<WalletConnector>`
modal component — so you configure your wallets once and never re-create objects.

## Install

```bash
npm install @xrpl-connect/react xrpl-connect xrpl
```

> `react` / `react-dom` are peer dependencies. The web component is registered by
> importing `xrpl-connect` once (see below).

## Usage

```tsx
// main.tsx — import once to register the <xrpl-wallet-connector> web component
import 'xrpl-connect';
import { XamanAdapter, CrossmarkAdapter } from 'xrpl-connect';
import { XrplConnectProvider } from '@xrpl-connect/react';

const config = {
  adapters: [new XamanAdapter({ apiKey: 'YOUR_KEY' }), new CrossmarkAdapter()],
  network: 'testnet',
  autoConnect: true,
};

createRoot(document.getElementById('root')!).render(
  <XrplConnectProvider config={config}>
    <App />
  </XrplConnectProvider>
);
```

```tsx
// App.tsx
import { useWallet, useSigner, useWalletModal, WalletConnector } from '@xrpl-connect/react';

export function App() {
  const { connected, account, disconnect, error } = useWallet();
  const { open } = useWalletModal();
  const { signAndSubmit } = useSigner();

  return (
    <>
      {connected ? (
        <>
          <p>Connected: {account?.address}</p>
          <button onClick={disconnect}>Disconnect</button>
        </>
      ) : (
        <button onClick={open}>Connect Wallet</button>
      )}

      {error && <p>Error [{error.code}]: {error.message}</p>}

      {/* The modal itself — themeable, with typed event props */}
      <WalletConnector
        theme="dark"
        cssVars={{ '--xc-primary-color': '#a78bfa' }}
        onConnect={(acct) => console.log('connected', acct.address)}
        onError={(e) => console.error(e.code, e.category, e.message)}
      />
    </>
  );
}
```

## API

### `<XrplConnectProvider config={...}>`
Builds **one** `WalletManager` from `config` (the core `WalletManagerOptions`:
`adapters`, `network`, `autoConnect`, `storage`, `logger`) and shares it with the
subtree. The manager is created once on mount; pass a React `key` to rebuild it.

### Hooks
- `useWallet()` → `{ manager, connected, account, network, connecting, error, connect, disconnect }`
- `useSigner()` → `{ sign, signAndSubmit, signMessage }` — each rejects with a typed
  `WalletError` (`error.code`, `error.category`), e.g. `SIGN_REJECTED` on user cancel.
- `useWalletModal()` → `{ open, close }` — drive the `<WalletConnector>` modal.

### `<WalletConnector />`
React wrapper around the web component. Props: `primaryWallet`, `wallets`, `theme`
(`'dark' | 'light' | 'purple'`), `cssVars` (`--xc-*` overrides), `style`, `className`,
and typed callbacks `onConnecting(walletId)`, `onConnect(account)`, `onError(WalletError)`.

### Errors
`WalletError`, `WalletErrorCode`, `WalletErrorCategory`, and `isWalletError` are
re-exported for convenience.

## Next.js / SSR

These components are client-only (they drive a browser web component). In the App
Router, use them from a client component:

```tsx
'use client';
import { XrplConnectProvider } from '@xrpl-connect/react';
```

## License

MIT
