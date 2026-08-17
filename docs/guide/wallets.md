---
description: Choose and configure the wallet adapters included with XRPL Connect v1.0.
---

# Wallets and capabilities

XRPL Connect v1.0 ships eight adapters behind one `WalletManager` API. Register only the wallets your application intends to support; the connector checks availability before presenting them.

| Adapter ID      | Wallet        | Requirement                     | Sign | Submit | Messages | Live account refresh |
| --------------- | ------------- | ------------------------------- | :--: | :----: | :------: | :------------------: |
| `xaman`         | Xaman         | Browser API key                 | Yes  |  Yes   |    No    |         Yes          |
| `crossmark`     | Crossmark     | Browser extension               | Yes  |  Yes   |   Yes    |         Yes          |
| `gemwallet`     | GemWallet     | Browser extension               | Yes  |  Yes   |   Yes    |         Yes          |
| `walletconnect` | WalletConnect | Project ID                      | Yes  |  Yes   |    No    |          No          |
| `ledger`        | Ledger        | XRP app and WebHID/WebUSB       | Yes  |  Yes   |   Yes    |         Yes          |
| `xyra`          | Xyra          | Browser wallet                  | Yes  |  Yes   |   Yes    |          No          |
| `otsu`          | Otsu          | Browser wallet                  | Yes  |  Yes   |   Yes    |         Yes          |
| `metamask-snap` | MetaMask Snap | MetaMask with XRPL Snap support | Yes  |  Yes   |   Yes    |          No          |

Treat this table as the default feature set and check capabilities at runtime before displaying an action:

```ts
if (manager.supports('signMessage')) {
  const signed = await manager.signMessage('Sign in to Example');
}
```

## Recommended configuration

```ts
import {
  CrossmarkAdapter,
  GemWalletAdapter,
  MetaMaskSnapAdapter,
  WalletConnectAdapter,
  WalletManager,
  XamanAdapter,
} from 'xrpl-connect';

export const manager = new WalletManager({
  adapters: [
    new XamanAdapter({ apiKey: import.meta.env.VITE_XAMAN_API_KEY }),
    new CrossmarkAdapter(),
    new GemWalletAdapter(),
    new WalletConnectAdapter({ projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID }),
    new MetaMaskSnapAdapter(),
  ],
  network: 'testnet',
  autoConnect: true,
});
```

Xaman API keys and WalletConnect project IDs are browser identifiers, not server secrets. Restrict them to your production origins in the provider dashboard. Never place private keys, seeds, API secrets, or signing credentials in client code.

## Adapter options

- `XamanAdapter`: `apiKey`, QR callback, deep-link transformation, and post-signing return URLs.
- `WalletConnectAdapter`: `projectId`, metadata, QR/deep-link callbacks, modal mode, and theme.
- `LedgerAdapter`: derivation path, operation timeout, and WebHID preference. Ledger requires HTTPS outside localhost.
- `MetaMaskSnapAdapter`: optional `snapId`; use the default published Snap unless developing a local Snap.
- Xyra, Otsu, Crossmark, and GemWallet work without application credentials.

Connect-time options can override supported adapter settings. Configure Xaman return URLs on the adapter constructor when connecting through `WalletManager`; direct `XamanAdapter.connect()` calls can override them for one session. Return navigation may open another browser tab, so restore application state and use the signing result—not navigation—as confirmation. Keep the Xaman API key stable for the lifetime of the page because its browser SDK owns page-global OAuth state.

## Networks

Pass `mainnet`, `testnet`, `devnet`, or a supported `NetworkConfig` to `WalletManager`. Adapters validate the selected network and reject contradictory wallet responses. In particular, WalletConnect accepts only a well-formed CAIP-10 account with a valid XRPL classic address on the requested chain; malformed responses or sessions without a matching chain are disconnected and rejected. Start development on testnet and display the active network beside every signing action.

## Availability and ordering

The web component hides unavailable wallets by default. Use its `wallets` attribute to restrict and order the list, and `show-unavailable` when you want installation links to remain visible:

```html
<xrpl-wallet-connector
  wallets="xaman,crossmark,gemwallet,walletconnect,metamask-snap"
  show-unavailable
></xrpl-wallet-connector>
```

See the [API reference](/guide/api-reference) for constructor and connect-option types.
