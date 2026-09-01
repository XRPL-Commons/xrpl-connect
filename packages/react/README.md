# @xrpl-commons/xrpl-connect-react

React bindings for [XRPL Connect](https://github.com/XRPL-Commons/xrpl-connect): a
provider that owns a single `WalletManager`, hooks to use it, and a `<WalletConnector>`
modal component — so you configure your wallets once and never re-create objects.

## Install

```bash
npm install @xrpl-commons/xrpl-connect-react@rc xrpl-connect@rc xrpl@^4 react react-dom
```

> `react` / `react-dom` are peer dependencies. Importing any named export from
> `xrpl-connect` also registers the web component.

## Usage

```tsx
import { XamanAdapter, CrossmarkAdapter } from 'xrpl-connect';
import { XrplConnectProvider } from '@xrpl-commons/xrpl-connect-react';

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
import {
  useWallet,
  useSigner,
  useWalletModal,
  WalletConnector,
} from '@xrpl-commons/xrpl-connect-react';

export function App() {
  const { connected, account, disconnect, error } = useWallet();
  const { ready, open } = useWalletModal();
  const { signAndSubmit } = useSigner();

  return (
    <>
      {connected ? (
        <>
          <p>Connected: {account?.address}</p>
          <button onClick={disconnect}>Disconnect</button>
        </>
      ) : (
        <button disabled={!ready} onClick={() => void open()}>
          Connect Wallet
        </button>
      )}

      {error && (
        <p>
          Error [{error.code}]: {error.message}
        </p>
      )}

      {/* The modal itself — themeable, with typed event props */}
      <WalletConnector
        showUnavailable
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
- `useWalletModal()` → `{ ready, open, openAndWait, close }` — drive the active
  `<WalletConnector>` modal. `open()` is awaitable, and `openAndWait()` resolves with the
  connected account or rejects if opening fails or the modal closes first.

`ready` becomes `true` after a connector registers and returns to `false` after the last
connector unmounts. Calling `open()` or `openAndWait()` while it is `false` rejects with a
namespaced setup error. When multiple connectors are mounted, the newest registration owns modal
calls; unmounting it falls back to the previous connector.

`connect` narrows deferred options from the wallet ID:

```tsx
const { connect } = useWallet();
await connect('xaman', { apiKey: 'YOUR_KEY' });
await connect('walletconnect', { projectId: 'YOUR_PROJECT_ID' });
```

For modal discovery and `autoConnect`, configure these credentials on the
adapter constructor as shown above. Deferred credentials apply only to that
direct call and are not persisted for reconnection. Missing configuration is a
typed `CONFIGURATION_REQUIRED` error.

### `<WalletConnector />`

React wrapper around the web component. Props: `primaryWallet`, `wallets`, `showUnavailable`, `theme`
(`'dark' | 'light' | 'purple'`), `cssVars` (`--xc-*` overrides), `style`, `className`,
typed callbacks `onConnecting(walletId)`, `onConnect(account)`, `onError(WalletError)`, and
standard host attributes such as `id`, `title`, `data-*`, and `aria-*`.

The wrapper forwards a `WalletConnectorElement` ref for direct access to `open()`,
`openAndWait()`, `close()`, and `toggle()`:

```tsx
import { useRef } from 'react';
import { WalletConnector, type WalletConnectorElement } from '@xrpl-commons/xrpl-connect-react';

function WalletModal() {
  const connectorRef = useRef<WalletConnectorElement>(null);
  const connect = async () => {
    const account = await connectorRef.current?.openAndWait();
    if (account) console.log('connected', account.address);
  };

  return (
    <>
      <button onClick={() => void connect()}>Connect wallet</button>
      <WalletConnector
        ref={connectorRef}
        id="wallet-modal"
        aria-label="Choose a wallet"
        data-testid="wallet-connector"
      />
    </>
  );
}
```

Explicit connector props are authoritative when raw forwarded attributes overlap: `primaryWallet`,
`wallets`, and `className` set their native host attributes after passthrough. Per CSS property,
inline `style` overrides `cssVars`, which overrides the selected `theme`.

Unavailable wallets are hidden by default. Set `showUnavailable` to show an Install action when a
wallet provides a download URL, or a disabled Unavailable row otherwise. Setting it to `false`
removes the native `show-unavailable` boolean attribute.

### Errors

`WalletError`, `WalletErrorCode`, `WalletErrorCategory`, and `isWalletError` are
re-exported for convenience.

## Next.js / SSR

These components are client-only (they drive a browser web component). In the App
Router, use them from a client component:

```tsx
'use client';
import { XrplConnectProvider } from '@xrpl-commons/xrpl-connect-react';
```

## License

MIT
