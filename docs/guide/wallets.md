---
description: Choose and configure the wallet adapters included with XRPL Connect v1.
---

# Wallets and capabilities

XRPL Connect v1 ships nine adapters behind one `WalletManager` API. Register only the wallets your application intends to support; the connector checks availability before presenting them.

| Adapter ID      | Wallet        | Requirement                     | Sign | Submit | Messages | Live account refresh |
| --------------- | ------------- | ------------------------------- | :--: | :----: | :------: | :------------------: |
| `xaman`         | Xaman         | Browser API key                 | Yes  |  Yes   |    No    |  OAuth session only  |
| `crossmark`     | Crossmark     | Browser extension               | Yes  |  Yes   |    No    |         Yes          |
| `gemwallet`     | GemWallet     | Browser extension               | Yes  |  Yes   |   Yes    |         Yes          |
| `walletconnect` | WalletConnect | Project ID                      | Yes  |  Yes   |    No    |          No          |
| `ledger`        | Ledger        | XRP app and WebHID/WebUSB       | Yes  |  Yes   |    No    |         Yes          |
| `xyra`          | Xyra          | Browser wallet                  | Yes  |  Yes   |   Yes    |          No          |
| `ghostsig`      | GHOSTSIG      | Browser wallet (popup)          | Yes  |  Yes   |    No    |          No          |
| `otsu`          | Otsu          | Browser wallet                  | Yes  |  Yes   |   Yes    |         Yes          |
| `metamask-snap` | MetaMask Snap | MetaMask with XRPL Snap support | Yes  |  Yes   |   Yes    |          No          |
| `privy`         | Privy         | Optional package and Privy app  | Yes  |  Yes   |    No    |          No          |

The `privy` adapter is not part of `xrpl-connect`: install the optional
`@xrpl-commons/xrpl-connect-privy` package and see [Social login](/guide/social-login).

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

On a Xaman mobile OAuth return, `autoConnect: true` completes sign-in even if the
manager has not saved its first session yet. With auto-connect omitted or disabled,
call `manager.reconnect()` explicitly on the returned page. Mounting the connector
does not initiate recovery.

Only the return of a login started in the same browser profile completes: its OAuth
state must match a pending, unexpired attempt in local storage. Links that carry a
Xaman token or code without such an attempt are ignored, so a crafted link cannot sign
a user in to another account. Sessions that earlier versions adopted from the Xaman
SDK's `XummPkceJwt` storage are not restored; those users sign in once more.

When the return opens another tab on the same origin and browser profile, completing
that recovery also settles the original tab's pending connection. This requires
local storage. Each browser login has its own OAuth state; expired or cancelled
attempts cannot be adopted by a later login. Unanswered connections time out after
five minutes with `OPERATION_TIMEOUT`. A suspended tab checks its deadline when it
resumes. Other tabs that did not initiate a connection remain idle.

Disconnecting deletes the saved Xaman token from local storage, along with copies that
earlier versions left after logout. A session that another tab saved in the meantime is
kept.

Persist checkout/order state separately so the return page can resume the payment
step. Recovering a wallet session does not restore application state.

## Adapter options

- `XamanAdapter`: `apiKey`, QR callback, deep-link transformation, post-signing return URLs, and `maxLastLedgerSequenceExtension` (default 50, sign-only). See [expiry policy](/guide/transactions#xaman-expiry-policy).
- `WalletConnectAdapter`: `projectId`, metadata, QR/deep-link callbacks, modal mode, and theme.
- `LedgerAdapter`: derivation path, operation timeout, and WebHID preference. Ledger requires HTTPS outside localhost.
- `MetaMaskSnapAdapter`: optional `snapId` and `snapVersion`; use the default published Snap unless developing a local Snap. The default Snap is requested with the version range `^1.0.3`, so MetaMask refuses a different major release; a custom `snapId` has no range unless `snapVersion` is set. MetaMask is discovered only through EIP-6963 announcements (extension v11 or later), never through `window.ethereum`.
- `PrivyAdapter`: required `appId` and `redirectUri`, plus optional `clientId`, `loginMethods`, `allowGuestLogin`, `timeoutMs`, and `transactionReview`. See the [Privy adapter reference](/guide/api-reference#privy-adapter).
- Xyra, Otsu, Crossmark, GemWallet, and GHOSTSIG work without application credentials. GHOSTSIG accepts optional `url` and `timeoutMs`.

Xaman and WalletConnect need constructor credentials to appear in wallet discovery and to support automatic reconnection. Direct calls can defer a credential for one session with `manager.connect('xaman', { apiKey })` or `manager.connect('walletconnect', { projectId })`; these options are selected from the wallet ID at compile time and are not persisted. Missing credentials fail early with `CONFIGURATION_REQUIRED`. Other connect-time options can override supported adapter settings. Configure Xaman return URLs on the adapter constructor when connecting through `WalletManager`; direct `XamanAdapter.connect()` calls can override them for one session. Return navigation may open another browser tab, so restore application state and use the signing result—not navigation—as confirmation. Keep the Xaman API key stable for the lifetime of an adapter instance.

## Networks

A network requested through the manager's `network` option or `connect(id, { network })` stays
the session's network for its whole lifetime, including restores and logins that return through a
redirect. If the wallet later reports another network, the manager emits `error` with
`NETWORK_MISMATCH` and signing rejects with `NETWORK_MISMATCH` until the wallet returns;
`manager.networkMismatch` exposes that error meanwhile. See the
[network policy](/guide/api-reference#network-policy).

Xaman's network is OAuth session context, which may be restored from saved user information.
Neither reconnecting nor `fetchAccount()` guarantees the mobile app's current selection.
Signing forces the session target network and validates the resolved payload's network;
see [Xaman network evidence](/guide/production#xaman-session-refresh-and-network-evidence).

Pass `mainnet`, `testnet`, `devnet`, or a supported `NetworkConfig` to `WalletManager`. Adapters validate the selected network and reject contradictory wallet responses. In particular, WalletConnect accepts only a well-formed CAIP-10 account with a valid XRPL classic address on the requested chain; malformed responses or sessions without a matching chain are disconnected and rejected. Start development on testnet and display the active network beside every signing action.

## Availability and ordering

The web component hides unavailable wallets by default. Use its `wallets` attribute to restrict and order the list, and `show-unavailable` when you want installation links to remain visible:

```html
<xrpl-wallet-connector
  wallets="xaman,crossmark,gemwallet,walletconnect,metamask-snap"
  show-unavailable
></xrpl-wallet-connector>
```

Otsu is available only when its extension has injected a provider with
`window.xrpl?.isOtsu === true`. The adapter checks the current provider on every
`isAvailable()` call, so applications using `WalletManager` directly can call
`getAvailableWallets()` again after a late extension injection. The wallet
connector retries wallets that were unavailable or timed out whenever the modal
is opened again, so closing and reopening it refreshes late-injected providers.

See the [API reference](/guide/api-reference) for constructor and connect-option types.
