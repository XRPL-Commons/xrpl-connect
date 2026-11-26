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

Before testing each deployment, check the following settings in your Privy dashboard.

- Add the **application origin** (scheme, host and port) to **Allowed origins**.
  Local development, preview tunnels and production each have their own origin.
- For OAuth, add the full **redirect URI**, including the callback path, to the
  OAuth redirect allowlist. The callback page must restore the same manager.
- Enable the login methods offered by the app and configure the embedded XRPL wallet.
- When enabling passkey transaction MFA, test both approval and cancellation on
  the origin where users sign.

Use the public app ID and supply a client ID when targeting a specific Privy
client. The adapter fetches the dashboard settings
every time **Sign in with socials** opens, bypassing cached browser responses.
There is no provider list to duplicate
in application code or environment variables.

The integration pins `@privy-io/js-sdk-core` to `0.79.4`. Privy describes this as a
low-level SDK and asks developers to discuss their use with its team. See the
[vanilla SDK guide](https://docs.privy.io/recipes/core-js) and
[extended-chain support](https://docs.privy.io/wallets/overview/chains).

```bash
npm install xrpl-connect@rc @xrpl-commons/xrpl-connect-privy@rc xrpl@^5
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
custom OAuth providers, passkeys, Farcaster, and, when the application opts in,
[guest login](#guest-login). It shows only enabled methods. Phone authentication follows the dashboard's SMS or WhatsApp setting;
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
provide that callback. Each entry accepts an optional `label` for its button;
without one the button uses the dashboard label of the method it overrides, then
the OAuth provider's name, then the `id`.

Set `allowedLoginMethods: ['email', 'google']` to offer just those configured
methods. The same list applies when calling `manager.connect('privy', { loginMethod })`
directly. Email, phone and passkey-only configurations can omit `redirectUri`.

Choosing a login method always authenticates with that method. If a previous
Privy session is still present, for example because an earlier logout could not
complete, it is ended first and is never handed to the next person who signs in.
Calling `manager.connect('privy')` without a `loginMethod` resumes the current
session instead.

### Guest login

Enabling guest login in the Privy dashboard is not enough to offer it. The
adapter shows and accepts the `guest` method only when the application opts in:

```js
const privy = new PrivyAdapter({
  appId: 'YOUR_PUBLIC_APP_ID',
  redirectUri: `${window.location.origin}/wallet/privy`,
  allowGuestLogin: true,
});
```

A guest receives a real XRPL wallet, but the guest account's only credential is a
random secret that Privy keeps in this browser's storage. The guest account and
its XRPL wallet, including any XRP or tokens sent to its address, are lost for
good when:

- the guest disconnects, because `manager.disconnect()` logs out of Privy and
  logout deletes the secret;
- anyone signs in with a login method in the same browser, including **Guest**
  again, because the previous session is ended first;
- a connection attempt fails, because the adapter then logs out of the session it
  started;
- the browser's site data is cleared, or the guest switches browser or device.

Neither the application nor Privy can recover the account. Offer guest login only
for disposable use, such as testnet demos, and warn users not to fund a guest
wallet they want to keep.

## Authenticate requests to your backend

Read a fresh access token from the connected adapter for each request.

```js
const token = await adapter.getAccessToken();
if (!token) throw new Error('Sign in to continue');
await fetch('/api/payments', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: manager.account.address }),
});
```

On the server, verify the token and resolve its subject to a linked XRPL wallet
before authorizing an operation for the address. The access token identifies a
Privy user who can have several wallets. The following server-side helper uses
`jose` and the app credentials from the server environment.

```js
import { createRemoteJWKSet, jwtVerify } from 'jose';

const appId = process.env.PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;
const jwks = createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`));

async function verifyWallet(token, address) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: 'privy.io',
    audience: appId,
    algorithms: ['ES256'],
    requiredClaims: ['sub', 'exp'],
  });
  const response = await fetch(
    `https://auth.privy.io/api/v1/users/${encodeURIComponent(payload.sub)}`,
    {
      headers: {
        'privy-app-id': appId,
        Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
      },
      cache: 'no-store',
    }
  );
  if (!response.ok) throw new Error('Could not verify the Privy user');
  const user = await response.json();
  if (
    user.id !== payload.sub ||
    !user.linked_accounts?.some(
      (a) => a.type === 'wallet' && a.chain_type === 'xrpl' && a.address === address
    )
  )
    throw new Error('Address is not linked to this user');
  return user.id;
}
```

Keep the app secret on the server. If your API restricts access to particular
Privy app clients, also validate the `app_client_id` claim.
See [Privy's access token guide](https://docs.privy.io/authentication/user-authentication/access-tokens).

## Content Security Policy

Under an enforced CSP, allow the origins this integration uses in addition to
your application's policy:

- `connect-src https://auth.privy.io` for Privy's API, which the pinned SDK
  calls at that origin, and the WebSocket endpoint of the manager's network
  (for example `wss://s.altnet.rippletest.net:51233` on testnet) for autofill
  and submission.
- `frame-src https://auth.privy.io` for Privy's hidden embedded-wallet iframe.
- `img-src data:` for the built-in login-method icons, plus the origin of any
  custom OAuth provider icon configured in the dashboard.
- `script-src https://challenges.cloudflare.com` (Turnstile) or
  `https://js.hcaptcha.com` (hCaptcha) when the dashboard requires CAPTCHA. The
  connector loads the script only when a challenge is shown; the challenge
  widget also needs the frame and request origins listed in its provider's CSP
  documentation.

See the
[strict CSP guide](https://github.com/XRPL-Commons/xrpl-connect/blob/develop/docs/guide/production.md#strict-content-security-policy)
for the connector's style nonce and the rest of the policy.

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
configured on the manager, autofills missing fee/sequence fields, asks the user to
review the transaction, hashes the XRPL signing serialization with SHA-512Half,
and requests a raw signature from the Privy user's signer. It converts the compact
signature to canonical DER, verifies it against the connected public key, and
returns the signed blob. Submission waits for validation and returns the hash with
`transactionResult`. A validated `tec` result is returned rather than thrown,
because it consumed the fee and sequence; check `transactionResult === 'tesSUCCESS'`
before treating it as applied.

Prepared transactions with `Fee` and `Sequence` can be signed without connecting
to an XRPL server. Include `LastLedgerSequence` to bound their lifetime. The
adapter rejects pre-signed transactions and transactions for another account.
Every fee, computed or supplied by the application, is limited to 2 XRP, the
xrpl.js autofill limit; like xrpl.js, the adapter exempts `AccountDelete`,
`AMMCreate`, and `VaultCreate`, whose fee is the ledger's owner reserve. A larger
fee fails with a `SIGN_FAILED` wallet error before any review or signature.
Multisigning and arbitrary message signing are not supported; `signMessage` is
declared unavailable through the standard capabilities contract.

### Transaction review

The embedded wallet signs without a wallet app of its own, so the adapter asks the
user before every signature (`sign` and `signAndSubmit`). With the default
`transactionReview: 'prompt'`, it sends the transaction through `onAuthPrompt()`
as a prompt whose `review` lists every field of the exact transaction that will
be signed: type, amount, destination and destination tag, fee, network, and
account first, then all other fields. XRP amounts are shown in XRP, issued
currencies as value, currency, and issuer, and MPT amounts as value and issuance
ID; other values appear as text or JSON.

The wallet connector shows this review in its dialog, opening it if it is closed
and closing it afterwards. **Approve** signs; **Reject**, closing the dialog, or
pressing Escape rejects with `SIGN_REJECTED`, and the Privy signer is never
called. A disconnect, logout, or lost session during a review rejects it with
`NOT_CONNECTED`. Reviews run one at a time: a second request waits until the
first is answered, an answer always applies to the transaction on screen, and
**Approve** stays disabled for a second after each review appears so a double
click cannot approve the next one.

The review runs after autofill, so an autofilled `LastLedgerSequence` (about 20
ledgers ahead, roughly a minute) keeps counting while the user reads. With
`signAndSubmit`, approve within about a minute: an expired transaction fails
without being applied. With `sign`, a transaction the adapter autofilled must be
approved and then submitted within the same window. Supply your own
`LastLedgerSequence` to choose the window, or `Fee` and `Sequence` to sign without
autofill.

The review fails closed. When nothing is subscribed with `onAuthPrompt()`,
signing fails with a `SIGN_FAILED` wallet error and reason `no_reviewer`, so keep a
connector on the page while users sign. To use your own interface, subscribe with
`adapter.onAuthPrompt()` and answer prompts that carry a `review` with
`prompt.submit({})` or `prompt.cancel()`, or pass a function:

```js
const privy = new PrivyAdapter({
  appId: 'YOUR_PUBLIC_APP_ID',
  redirectUri: `${window.location.origin}/wallet/privy`,
  // Called once per transaction, one at a time. `signal` aborts on disconnect.
  transactionReview: async (review, signal) => {
    // review.action: 'sign' | 'signAndSubmit'; review.network; review.transaction;
    // review.details: [{ name, label, value }] covering every field.
    return await myConfirmDialog(review.details, { signal }); // `true` approves
  },
});
```

Only an explicit `true` approves; any other answer rejects with `SIGN_REJECTED`,
and a thrown error fails the request with `SIGN_FAILED`.

If your app already has an approval sheet, the simplest integration is to open
that sheet from `transactionReview` using the supplied review. If the sheet
must come first, bind a single approval to the exact prepared transaction, the
network and the requested action. For example, keep this state in the component
that owns the connected manager, discard it on logout, and consume it once.

```js
import { encode } from 'xrpl';

let approved;
const adapter = new PrivyAdapter({
  appId,
  redirectUri,
  transactionReview(review) {
    const expected = approved;
    approved = undefined;
    return (
      expected !== undefined &&
      review.action === 'sign' &&
      review.network.id === expected.network &&
      encode(review.transaction) === expected.bytes
    );
  },
});

async function approveAndSign(prepared) {
  // Prepare Fee, Sequence, Account, SigningPubKey and LastLedgerSequence before showing the sheet.
  const transaction = structuredClone(prepared);
  const network = manager.account.network.id;
  const bytes = encode(transaction);
  if (!(await showPaymentSheet(transaction, network))) return;
  approved = { network, bytes };
  try {
    return await manager.sign(transaction);
  } finally {
    approved = undefined;
  }
}
```

Allow only one open approval sheet per manager in this example. The returned
`signed.hash` identifies the blob at this stage. If a backend attaches a
sponsor signature later, use the hash of the final submitted blob for tracking.
The adapter signs locally serialized, single-signer transactions using
`raw_sign`, including supported transaction types your installed `xrpl`
codec can encode. A dedicated multisign or BatchSigner signature uses a
different signing payload.

`transactionReview: 'none'` turns the review off: the adapter signs headlessly,
whenever any code calls `sign` or `signAndSubmit`. **Any script running in the
page, including a compromised dependency or injected code, can then sign and
submit transactions with the user's wallet without the user seeing them.** Use
it only when your application shows its own confirmation for every transaction.
An in-page review cannot stop code that already runs in your page, which can
click its buttons or answer its prompts; it protects users from transactions they
did not expect, such as ones built from untrusted input.

Privy's browser extended-chain API creates the native `xrpl` wallet with the
authenticated user as owner. The implementation uses the same vanilla `create`
and `rawSign` exports as Privy's extended-chain hooks. The official
[XRPL guide](https://docs.privy.io/wallets/using-wallets/xrpl/overview) describes the
XRPL encoding and signature format with server SDK examples; no server SDK is
included in this package. See also
[Privy's user-owned wallets](https://docs.privy.io/controls/authorization-keys/owners/configuration/user/overview).

## Session lifecycle

### Transaction MFA

Enable passkey MFA in Privy and keep a connector mounted wherever users sign.
When Privy requests a second factor for a signature, the default
`mfa: 'prompt'` flow asks the user to confirm with their passkey. The user
can cancel either the connector prompt or the browser passkey sheet.
Applications that render their own prompt can pass an MFA callback and invoke
`request.authenticate()` from their confirmation button. Its abort signal ends
the prompt when the session or challenge expires.

```js
const adapter = new PrivyAdapter({
  appId,
  redirectUri,
  mfa: 'prompt',
  requestTimeoutMs: 15_000,
  userActionTimeoutMs: 60_000,
  teardownTimeoutMs: 5_000,
});

// In a connected account's settings, start linking from the user's button.
const { credentialId } = await adapter.mfa.linkPasskey();
await adapter.mfa.enrollPasskey({ credentialIds: [credentialId] });
const { enrolled } = await adapter.mfa.status();
```

Signing in with a passkey and enrolling that passkey for transaction MFA are
separate actions. With `mfa: 'none'`, a required challenge fails with
`error.reason === 'mfa_required'`. Applications can distinguish cancellation
(`mfa_cancelled`) from timeout (`mfa_timeout`). A cold embedded iframe that
never responds reports `iframe_not_ready`.

### Restoration and teardown

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
- `manager.disconnect()` immediately clears the connection and stops session
  monitoring. SDK logout runs after any already-started SDK requests settle,
  preventing a late response from restoring authentication. The secure iframe
  stays available for pending requests and the SDK's logout acknowledgement,
  then is removed along with its listeners. Cleanup waits are bounded by
  `teardownTimeoutMs` (defaults to `timeoutMs`, then 15 seconds). A request that never settles is
  abandoned so it cannot block later logins, and if it completes afterwards
  the adapter logs out once more. Privy keeps one signed-in user per browser,
  so if such a late login replaces a newer connection's user, the adapter logs
  the late user out and ends the newer connection with a `disconnect` event
  rather than let it continue as someone else; that user signs in again.
  Provider discovery and a new login wait for the cleanup operation. A later
  login restores the same embedded wallet.
- A restore that times out, for example on a slow network, leaves both the
  saved connection and the Privy session in place, so the next
  `manager.reconnect()` can retry without a new login.
- Authentication failures, blocked storage, iframe readiness failures, and
  signing failures surface as wallet errors. The UI permits retry with the same
  selected social method.

### Browser and CI tests

Import `MockPrivyAdapter` from `@xrpl-commons/xrpl-connect-privy/testing` to
exercise manager restoration, email-code dialogs and the production transaction
review and signature checks offline. `connect('privy')` connects immediately.
Selecting the email method prompts for the test code `000000`. Use transactions
with `Fee` and `Sequence` so signing needs no ledger RPC. The fixture generates
an ephemeral test key. Supply the same test-only `Uint8Array` private key when
recreating the adapter across page loads. Use a real Privy test app for OAuth,
access token verification and passkey enrollment.

## Custom authentication and other OAuth integrations

Adapters can implement `getLoginMethods()` to supply fresh chooser entries and
`onAuthPrompt()` to request email, verification codes, or other interactive input.
The connector subscribes for you. When connecting without it, subscribe with
`adapter.onAuthPrompt()` before choosing email, phone, passkey, or Farcaster:
those logins fail immediately when nothing can show their prompt.
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
      label: 'Company account',
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

The main [vanilla JavaScript demo](https://github.com/XRPL-Commons/xrpl-connect/tree/develop/examples/vanilla-js) and
[React demo](https://github.com/XRPL-Commons/xrpl-connect/tree/develop/examples/react) include optional Privy configuration alongside
external wallets, OAuth callback routing, testnet funding, signing, submission,
restoration, and logout controls. Their READMEs document the public environment
variables and allowed localhost callback URLs.

The [smaller vanilla integration example](https://github.com/XRPL-Commons/xrpl-connect/tree/develop/examples/privy-vanilla) is also
available for applications focused on the Privy lifecycle.
