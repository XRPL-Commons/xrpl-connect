---
description: Add Privy social login and user-owned embedded XRPL wallets to the XRPL Connect wallet picker.
---

# Social login with Privy

XRPL Connect can display social login alongside existing wallet choices. The
optional `@xrpl-commons/xrpl-connect-privy` package authenticates users and creates
or restores their user-owned embedded XRPL wallet. A successful login becomes a
wallet connection only when the real XRPL account and signer are ready.

The integration uses Privy's vanilla JavaScript SDK. Core and the web component
do not load React. No application backend or Privy app secret is needed for the
built-in OAuth flow. Applications using custom JWT authentication supply their
own existing authentication service.

Enable the desired authentication methods in the Privy dashboard. The integration
does not render Privy's “connect wallet” or “use your own wallet” options. External wallets
continue to connect through the other XRPL Connect adapters.

Guest login also needs `allowGuestLogin: true` on the `PrivyAdapter`; the
dashboard setting alone does not offer it. A guest's only credential is a random
secret in the browser's storage. The guest account and its XRPL wallet, with any
funds sent to it, are lost for good on disconnect, when anyone signs in with a
login method in the same browser, when a connection attempt fails, or when site
data is cleared. Offer it only for disposable use; see the
[guest login notes](https://github.com/XRPL-Commons/xrpl-connect/tree/develop/packages/privy#guest-login).

With a configured Privy adapter, the wallet picker shows one **Sign in with
socials** button alongside the XRPL wallet options. Opening it fetches the current
Privy dashboard settings and displays the enabled authentication methods. Changes
to those settings take effect the next time the chooser opens; no provider list
needs to be maintained in code or environment variables. Use the chooser's back
button to return to the normal wallet list.

## Run the demos

The main [vanilla JavaScript demo](https://github.com/XRPL-Commons/xrpl-connect/tree/develop/examples/vanilla-js)
and [React demo](https://github.com/XRPL-Commons/xrpl-connect/tree/develop/examples/react)
both support Privy alongside the existing wallet adapters. From a repository checkout:

```bash
pnpm install
cp examples/vanilla-js/.env.example examples/vanilla-js/.env.local
cp examples/react/.env.example examples/react/.env.local
```

Set `VITE_PRIVY_APP_ID` in each `.env.local` to your public Privy app ID. Set
`VITE_PRIVY_CLIENT_ID` only if your app uses a specific client. Enable your desired
login methods in the Privy dashboard; no provider list is needed in the demos.
Leaving the app ID empty keeps the demos usable with external wallets.

Allow both application origins and their callback URLs in the Privy dashboard:

| Demo               | Application origin      | OAuth callback                       |
| ------------------ | ----------------------- | ------------------------------------ |
| Vanilla JavaScript | `http://localhost:5170` | `http://localhost:5170/wallet/privy` |
| React              | `http://localhost:5173` | `http://localhost:5173/wallet/privy` |

Build the workspace dependencies, then start each demo in its own terminal:

```bash
pnpm --filter 'vanilla-js-example^...' --filter 'react-example^...' build
pnpm --filter vanilla-js-example dev
```

```bash
pnpm --filter react-example dev
```

The development servers keep these ports fixed so a busy port cannot silently
change the OAuth callback. Restart a server after changing its environment file.
`VITE_PRIVY_REDIRECT_URI` can override the callback; it must return to the same
application with access to its original browser storage. For deployed demos,
serve the application at `/wallet/privy` using an SPA fallback and allow the
deployed origin and callback in Privy. Public `VITE_*` values are included in the
browser bundle; never put an app secret there.

Once the Privy wallet is ready, both demos replace the callback URL with their home URL without
reloading or resetting the connected session. Failed or cancelled attempts stay on the callback
so the user can retry. The adapter removes OAuth parameters; navigation after login belongs to
the application. In an app with a router, replace the callback route after a successful connection.

### Manual test flow

1. Open a demo and choose **Sign in with socials** from the wallet picker. Confirm
   that the methods match your Privy dashboard, then complete a login.
2. After the callback finishes, check that the connected account and wallet appear.
   Reload the page to check session restoration.
3. Use the demo's testnet funding control for a new account and wait for funding
   to finish before signing. The demos use XRPL Testnet.
4. Try signing a transaction without submitting it, then explicitly submit a
   transaction. The connector opens a review of each transaction; approve one and
   reject another, then inspect the results and event log. Privy does not support
   arbitrary message signing or multisigning, so those actions are unavailable.
5. Disconnect and sign in again to check logout and wallet restoration. You can
   also cancel a pending login and retry from the chooser.

Funding, signing, and submission run only when you select those actions. Login
does not automatically send a transaction.

## Configure your application

Install the Privy package alongside `xrpl-connect`:

```bash
npm install xrpl-connect@rc @xrpl-commons/xrpl-connect-privy@rc xrpl@^4
```

Keep both packages on the same release: the Privy package requires the matching
`xrpl-connect` release as a peer dependency.

```js
import { WalletManager, CrossmarkAdapter } from 'xrpl-connect';
import { PrivyAdapter } from '@xrpl-commons/xrpl-connect-privy';

const manager = new WalletManager({
  adapters: [
    new CrossmarkAdapter(),
    new PrivyAdapter({
      appId: 'YOUR_PUBLIC_APP_ID',
      redirectUri: `${window.location.origin}/wallet/privy`,
    }),
  ],
  network: 'testnet',
  autoConnect: false,
});
const connector = document.querySelector('xrpl-wallet-connector');
connector.setWalletManager(manager);
await manager.reconnect();
```

Allow your application origin and callback URL in the Privy dashboard. Serve the
same application at `/wallet/privy`. Add the public client ID if your Privy app uses a specific client. Never expose an app secret.

For another authentication backend or explicit application entries, `socialLogins`
is a JavaScript property, not an HTML attribute. Privy does not require it. The
React wrapper accepts `socialLogins={entries}`, and Vue accepts `:social-logins="entries"`.
Descriptors can select any registered adapter, so custom OAuth backends can use
the same UI and manager lifecycle. Adapters can also provide `getLoginMethods()`
for dynamic discovery and `onAuthPrompt()` for interactive authentication input.
Dynamically discovered adapters follow the `wallets` attribute: when it is set,
only listed adapters are discovered, while explicit `socialLogins` entries always
show their adapter.
When social login is not configured, the existing wallet list behaves as before. Provider labels are used only in the
chooser; connection options stay internal to the component and are passed to the
selected adapter for retries.

After connection, use `manager.sign()` or `manager.signAndSubmit()` with normal
XRPL transactions. Fund a new account before submission. The Privy adapter
supports transaction signing and validated submission; multisigning and arbitrary
message signing are not supported. `manager.disconnect()` logs the user out of
the adapter-owned Privy session.

### Transaction review

The embedded wallet has no wallet app of its own to ask the user, so before every
signature the connector opens a **Review transaction** dialog. It lists every field
of the exact transaction to be signed: the type, amount, destination, and
destination tag first, then the transaction's other fields, then the fee, network,
and account, and last the sequencing and signing fields such as `Sequence`,
`LastLedgerSequence`, and `SigningPubKey`. XRP amounts appear in XRP, issued
currencies with their issuer, and MPT amounts with their issuance ID. The wallet signs only after the
user selects **Approve**. Rejecting or closing the dialog rejects the request with a
`SIGN_REJECTED` wallet error, and a disconnect during the review rejects it with
`NOT_CONNECTED`. Concurrent requests are reviewed one at a time, and **Approve**
stays disabled for a second after each review appears, so a double click cannot
approve the next one. The adapter also refuses any fee above 2 XRP, including one
the application supplied, except for transaction types priced at the owner reserve.

The review opens after autofill, so an autofilled `LastLedgerSequence` (about 20
ledgers, roughly a minute) keeps counting while the user reads. Approve a
`signAndSubmit()` request within about a minute, or the transaction expires
without being applied. A transaction that `sign()` autofilled must likewise be
approved and then submitted within that window; set `LastLedgerSequence` yourself
to choose it, or supply `Fee` and `Sequence` to sign without autofill.

Keep a connector on the page while users sign. Without one, signing fails with an
error until something subscribes with `adapter.onAuthPrompt()`. The
`transactionReview` option replaces the built-in review with your own (a function
that returns `true` to approve) or turns it off with `'none'`. With `'none'`, any
script running in your page can sign with the user's wallet; use it only when your
application confirms every transaction itself. See the
[Privy package documentation](https://github.com/XRPL-Commons/xrpl-connect/tree/develop/packages/privy#transaction-review)
for details.

See the [complete configuration, lifecycle, custom authentication, and framework examples](https://github.com/XRPL-Commons/xrpl-connect/tree/develop/packages/privy)
and the [smaller Privy integration example](https://github.com/XRPL-Commons/xrpl-connect/tree/develop/examples/privy-vanilla).
