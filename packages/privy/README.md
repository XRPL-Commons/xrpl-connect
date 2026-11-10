# Privy social login and embedded XRPL wallets

`@xrpl-commons/xrpl-connect-privy` adds a Privy-backed XRPL adapter to XRPL Connect.
The integration uses the vanilla Privy SDK and runs in the browser. It does not
load React or require an application backend or Privy app secret.

Social authentication, wallet readiness, and external-wallet connection are
separate operations:

- A configured social method authenticates the user with Privy.
- The adapter creates or restores a **user-owned native XRPL embedded wallet**.
  It connects only after the wallet has a valid XRPL address and matching public
  key. This is not an Ethereum address presented as an XRPL account.
- Existing external wallets continue to use XRPL Connect's other adapters.
  Privy's external-wallet login options are excluded from the social chooser.

## Configuration

Enable the desired login methods in the Privy dashboard, configure the app's
allowed origin and callback URL, and obtain its public app ID. Supply a client ID
when using a specific Privy client. The adapter fetches the dashboard settings
every time **Sign in with socials** opens, bypassing cached browser responses.
There is no provider list to duplicate
in application code or environment variables.

The integration pins `@privy-io/js-sdk-core` to `0.79.4`. Privy describes this as a
low-level SDK and asks developers to discuss their use with its team. See the
[vanilla SDK guide](https://docs.privy.io/recipes/core-js) and
[extended-chain support](https://docs.privy.io/wallets/overview/chains).

```bash
npm install xrpl-connect @xrpl-commons/xrpl-connect-privy xrpl@^4
```

```js
import { WalletManager, CrossmarkAdapter, GemWalletAdapter } from 'xrpl-connect';
import { PrivyAdapter } from '@xrpl-commons/xrpl-connect-privy';

// Create one adapter per application. It owns its Privy client and login session.
const privy = new PrivyAdapter({
  appId: 'YOUR_PUBLIC_APP_ID',
  // clientId: 'YOUR_PUBLIC_CLIENT_ID',
  redirectUri: `${window.location.origin}/wallet/privy`,
});

const manager = new WalletManager({
  adapters: [privy, new CrossmarkAdapter(), new GemWalletAdapter()],
  network: 'testnet',
  autoConnect: false,
});
const connector = document.querySelector('xrpl-wallet-connector');
connector.setWalletManager(manager);
manager.on('connect', (account) => console.log(account.address));
await manager.reconnect();
```

Serve the same application at the callback route. `manager.reconnect()` completes
the first OAuth return even when no manager session has been saved yet. It also
restores an existing connection. Framework providers can do this automatically
with `autoConnect: true`.

The wallet picker retains the XRPL wallet options and shows one **Sign in with
socials** button with the Privy symbol. Its chooser displays the currently enabled
dashboard methods. Privy authentication screens include the official
“Protected by Privy” attribution.
Without a configured Privy adapter, the normal wallet list is unchanged. Do not
instantiate a second Privy SDK client alongside this adapter; its client, secure iframe, callback, and
logout lifecycle belong to the adapter.

## Dashboard methods

The chooser supports the dashboard's email and phone authentication, built-in and
custom OAuth providers, passkeys, Farcaster, and guest login. It shows only enabled
methods. Phone authentication follows the dashboard's SMS or WhatsApp setting;
WhatsApp must be enabled for the app. Native Telegram authentication requires the
signed launch context from a Telegram Mini App and seamless login enabled in the
dashboard. Telegram OAuth works through the normal redirect flow.

Email and phone login request a verification code inside the connector. The
confirmation screen shows the destination, six code cells with paste and autofill
support, and a resend link. Input stays in the active prompt during retries and is
cleared when the prompt changes or closes. Passkeys use the browser's credential
prompt, and Farcaster shows its authentication link and QR code. Closing or backing out of a prompt cancels the active connection.
When the dashboard requires CAPTCHA, the connector renders the configured
Turnstile or hCaptcha challenge before sending a verification code.

`loginMethods` is optional. Use it to add an application-specific method, such as
custom JWT authentication, or override a discovered method with the same ID. The
default dashboard flow needs no explicit entries. Custom JWT authentication needs
an application callback to obtain its token; a dashboard switch alone cannot
provide that callback.

## Signing and submission

```js
const signed = await manager.sign({
  TransactionType: 'AccountSet',
  Account: manager.account.address,
});
console.log(signed.tx_blob, signed.hash);

const submitted = await manager.signAndSubmit({
  TransactionType: 'AccountSet',
  Account: manager.account.address,
});
console.log(submitted.hash);
```

Fund the XRPL account before autofill or submission. The adapter uses the network
configured on the manager, autofills missing fee/sequence fields, hashes the XRPL
signing serialization with SHA-512Half, and requests a raw signature from the
Privy user's signer. It converts the compact signature to canonical DER, verifies
it against the connected public key, and returns the signed blob. Submission
waits for validation and rejects a non-`tesSUCCESS` ledger result.

Prepared transactions with `Fee` and `Sequence` can be signed without connecting
to an XRPL server. Include `LastLedgerSequence` to bound their lifetime. The
adapter rejects pre-signed transactions and transactions for another account.
Multisigning and arbitrary message signing are not supported; `signMessage` is
declared unavailable through the standard capabilities contract.

Privy's browser extended-chain API creates the native `xrpl` wallet with the
authenticated user as owner. The implementation uses the same vanilla `create`
and `rawSign` exports as Privy's extended-chain hooks. The official
[XRPL guide](https://docs.privy.io/wallets/using-wallets/xrpl/overview) describes the
XRPL encoding and signature format with server SDK examples; no server SDK is
included in this package. See also
[Privy's user-owned wallets](https://docs.privy.io/controls/authorization-keys/owners/configuration/user/overview).

## Session lifecycle

- Authentication does not emit a wallet connection. Account/public-key readiness
  must finish first, so applications can use the existing manager events.
- The adapter reuses the user's embedded XRPL wallet on returning login. Manager
  storage contains the selected wallet/user IDs and network, not authentication
  tokens. Privy manages its own token storage and refresh.
- Restoring a saved connection must match both the wallet and user. An expired
  session requires an explicit new login; restoration does not silently create a
  new wallet or start another OAuth redirect.
- Closing an active connection flow cancels it. A late wallet or signature result
  cannot reconnect the manager or trigger a transaction submission.
- Once a transaction has been submitted, logout cannot cancel it. Its pending
  operation still returns the validated result so the application can track it.
- `manager.disconnect()` immediately clears the connection and releases the
  secure iframe and session listeners. SDK logout runs after any already-started
  SDK requests settle, preventing a late response from restoring authentication.
  Cleanup waits are bounded by `timeoutMs` (15 seconds by default); a new login
  waits for the retained cleanup operation. A later login restores the same
  embedded wallet.
- Authentication failures, blocked storage, iframe readiness failures, and
  signing failures surface as wallet errors. The UI permits retry with the same
  selected social method.

## Custom authentication and other OAuth integrations

Adapters can implement `getLoginMethods()` to supply fresh chooser entries and
`onAuthPrompt()` to request email, verification codes, or other interactive input.
These optional contracts are backend-independent. Authentication input stays
inside the active flow and is never included in component events or saved manager
state.

Applications can also supply explicit `socialLogins` entries. The `SocialLogin`
contract is backend-independent: `id`, `label`, optional
`icon`, `adapterId`, and optional `connectOptions`. It calls the selected adapter
through the manager and never interprets authentication tokens. Use a custom
adapter for a different authentication backend.

For a Privy application configured with custom JWT authentication, provide a
method that obtains the token through your existing authentication flow:

```js
const privy = new PrivyAdapter({
  appId: 'YOUR_PUBLIC_APP_ID',
  redirectUri: `${window.location.origin}/wallet/privy`,
  loginMethods: [
    {
      id: 'company',
      getCustomToken: async (signal) => {
        const response = await fetch('/api/auth/privy-token', { signal });
        if (!response.ok) throw new Error('Company login failed');
        const { token } = await response.json();
        return token;
      },
    },
  ],
});
```

Your existing authentication service owns that endpoint and its authorization.
The adapter synchronizes the token with Privy and then follows the same embedded
wallet lifecycle. The UI entry uses `connectOptions: { loginMethod: 'company' }`.
Do not place tokens in `connectOptions`, attributes, or event details.

## Vue and React

Create the same `privy` adapter shown above once and include it in your provider
configuration. The connector discovers the dashboard methods automatically.

```vue
<script setup>
import { WalletConnector } from '@xrpl-commons/xrpl-connect-vue';
</script>

<template>
  <WalletConnector />
</template>
```

Install the Vue provider using `createXrplConnect({ adapters: [privy, ...externalAdapters],
network: 'testnet', autoConnect: true })`. For Nuxt, keep wallet creation and the
consumer component in the client-only boundary.

```jsx
import { XrplConnectProvider, WalletConnector } from '@xrpl-commons/xrpl-connect-react';
import { config } from './wallet-config';

export function App() {
  return (
    <XrplConnectProvider config={config}>
      <WalletConnector />
    </XrplConnectProvider>
  );
}
```

Keep `config` and its adapter instances stable across renders.
React is used only by the consuming React application; it is not a dependency of
this adapter or XRPL Connect's web component.

The [vanilla example](../../examples/privy-vanilla) includes OAuth callback routing,
testnet funding, signing, submission, restoration, and logout controls.
