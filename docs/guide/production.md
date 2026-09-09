---
description: Production, security, SSR, persistence, and browser guidance for XRPL Connect v1.0.
---

# Production and security

## Client boundaries and SSR

Wallet adapters interact with browser APIs. Create the manager and render the connector in client
code. The official React and Vue packages can be imported during SSR, but importing a package is
different from executing provider/plugin setup or injected composables. Those operations and the
connector belong in client code.

```tsx
'use client';

import { XrplConnectProvider, WalletConnector } from '@xrpl-commons/xrpl-connect-react';
```

For Nuxt, install `createXrplConnect()` from a `.client.ts` plugin. Components that call
`useWallet()`, `useSigner()`, or `useWalletModal()` must be `.client.vue` components or children
that are wholly below a client-only boundary. A `<ClientOnly>` in a universal component's
template does not stop that component's setup function from running during SSR. See the
[Nuxt guide](/guide/frameworks/nuxt).

## Credentials

- Xaman API keys and WalletConnect project IDs are visible in browser bundles. Apply origin/domain allowlists in their dashboards.
- Never expose Xaman API secrets, wallet seeds, private keys, or backend credentials.
- Keep Xaman's API key stable for the page lifetime.
- Use environment variables intended for public client configuration (`VITE_*`, `NEXT_PUBLIC_*`, or equivalent).

## Persistence and reconnection

`autoConnect: true` stores a minimal, versioned connection record and asks the adapter to restore it. It never stores arbitrary connect options or private signing material. Register manager listeners immediately after construction because reconnection may finish before UI mount.

Supply a custom `StorageAdapter` when local storage is inappropriate, or `MemoryStorageAdapter` for non-persistent/test environments.

## xrpl.js compatibility

The upcoming SDK release accepts `xrpl` v3, v4, and v5; RC2 published before this
change accepts v3/v4. V5 requires Node.js 20.19 or newer, consistent with this
repository's supported Node release lines. The supported peer range does not make
the upstream major versions interchangeable for application-owned code: v5 changes
seed/mnemonic key derivation defaults and client network discovery error handling.
Review the [upstream v5 release notes](https://github.com/XRPLF/xrpl.js/releases/tag/xrpl%405.0.0)
when upgrading an existing application. XRPL Connect does not derive users' wallets
from seeds or mnemonics.

Packed-consumer verification covers the documented v4 dependency, the v5.0.0
minimum, and the current v5 release with strict peers, transaction types,
ESM/CommonJS, React/Vue, SSR, offline signing/codec checks, and a Nuxt build.
This does not replace live-wallet acceptance tests. Upgrading the upstream
dependency can also change browser assets: the tested v5.1.0 Nuxt build emits an
additional WebAssembly asset, so review your application's bundle and deployment
policies when upgrading.

## Browser support

- Serve production applications over HTTPS.
- Ledger requires WebHID or WebUSB and an unlocked device with the XRP app open.
- Extension adapters depend on the wallet's supported browser and injection mechanism.
- WalletConnect and Xaman provide QR/deep-link flows for mobile use.
- Test popup and deep-link behavior without inserting delays between a user click and wallet authorization.

## Xaman OAuth popups and security headers

Xaman browser sign-in uses an OAuth popup that communicates with its opener. If your
application sends `Cross-Origin-Opener-Policy: same-origin`, that relationship is severed:
authorization can finish in the popup while the original page remains disconnected.
For pages using this flow, configure the server or proxy to send:

```http
Cross-Origin-Opener-Policy: same-origin-allow-popups
```

This is a deliberate security tradeoff: it permits opener relationships with cross-origin
popups and does not provide the cross-origin isolation required by features such as
`SharedArrayBuffer`. Do not replace an application's isolation policy blindly. If strict
isolation is required, design a separately scoped authentication flow instead. See
[MDN's COOP reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy).

With `nuxt-security`, set `security.headers.crossOriginOpenerPolicy` to
`'same-origin-allow-popups'`. This option belongs to that module, not Nuxt core. With other
deployments, configure the equivalent response header in your server/proxy. Verify the
actual HTML response, including production proxy headers; changing client code is insufficient.
Close old OAuth popups and fully reload the original page before retrying.

Keep CSP enabled. Permit the wallet services your deployment uses in the appropriate
directives. WalletConnect's built-in inline QR logo does not require adding `data:` to
`connect-src`; displaying inline images still requires `data:` in `img-src`. A report-only
CSP warning does not block a request, but a separate enforced policy can. Never log or share
WalletConnect pairing URIs: they contain a pairing secret.

## Strict Content Security Policy

::: warning Release availability
Nonce support is an unreleased change after `1.0.0-rc.2`. RC2's official UI does not
support this setup; use the headless API there or test a build containing this change.
:::

The official connector supports nonce-authorized styles without `unsafe-inline` or
Google Fonts. It uses the system font stack by default and makes no font requests.
Pass the **server-generated style nonce for the current HTML response** to the connector
before it mounts. The same value authorizes its shadow-root stylesheet and both body-level
modal portal stylesheets, including subsequent renders and reopenings.

### Server policy and client setup

Generate an unpredictable nonce for each HTML response (for example,
`randomBytes(16).toString('base64')` with Node's `node:crypto`). Use the same value in
the response policy and the rendered component. Do not hard-code a production nonce,
generate an unrelated one in the browser, or reuse a cached HTML nonce across responses.
Your server/framework must safely serialize the value into the page's client props.

These are the **style directives**, not a complete wallet/application policy:

```http
Content-Security-Policy: style-src 'self' 'nonce-RESPONSE_NONCE'; style-src-attr 'none'
```

Replace `RESPONSE_NONCE` on the server. If you separately set `style-src-elem`, include
the nonce there too: that directive overrides `style-src` for style elements. Keep your
application's other directives, including its script policy. A nonce on the connector
does not authorize scripts, style attributes, or third-party network requests.

Vanilla (server-rendered markup, before importing/registering the component):

```html
<xrpl-wallet-connector nonce="RESPONSE_NONCE" class="wallet-theme"></xrpl-wallet-connector>
```

For programmatic creation, set `connector.nonce = responseNonce` **before** appending
the element or binding its manager. Read an existing nonce through the `.nonce` property,
not `getAttribute('nonce')`: browsers hide the attribute value.

React, inside the existing client provider:

```tsx
<WalletConnector nonce={responseNonce} className="wallet-theme" />
```

Vue, inside the existing client app/plugin boundary:

```vue
<WalletConnector :nonce="responseNonce" class="wallet-theme" />
```

The wrappers forward the native `nonce` attribute; no global configuration or separate
framework CSP API is needed. Keep it stable for the document lifetime. In Nuxt, pass the
response's style nonce from your security middleware through to the client-only connector;
the SDK does not generate nonces or configure response headers.

### Theming and scope

Put static overrides in a stylesheet allowed by your policy, targeting the connector
directly. It forwards supported CSS variables into its modal portals:

```css
/* In your application's allowed external CSS file */
xrpl-wallet-connector.wallet-theme {
  --xc-primary-color: #2563eb;
  --xc-font-family: system-ui, sans-serif;
}
```

Client-side `theme` and object-valued `cssVars`/`style` props use CSSOM property updates,
which `style-src-attr 'none'` permits. The connector also uses these updates for layout,
avatar colors, and portal variables. Style attributes may therefore appear in DevTools;
this is different from injecting literal `style="..."` markup. Avoid literal style
attributes and server-rendered inline theme/style props under this policy; a nonce does
not authorize those. External CSS is the simplest consistent option. See
[MDN's style-src-attr reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src-attr)
and [nonce guidance](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/nonce).

Self-host any custom font and permit its origin in `font-src`; otherwise no font allowance
is needed for the connector. Wallet icons and inline QR logos may need `img-src 'self' data:`
plus any explicitly configured image origins. Add wallet/RPC HTTPS and WebSocket endpoints
to `connect-src` according to the adapters you enable; external wallet pages have their own
policies. This style support is not a blanket guarantee for every wallet SDK or for
`require-trusted-types-for 'script'` (Trusted Types is not supported by the UI).

If your policy forbids all generated style elements, including nonced ones, use the
headless manager/hooks/composables with your own UI. The built-in shadow styles do not have
an external-stylesheet mode. Verify the production HTML response with an **enforced** CSP,
and exercise the wallet picker, QR/loading/error views, account dialog, and real wallets;
a report-only policy cannot prove compatibility.

## Xaman session refresh and network evidence

`XamanAdapter.fetchAccount()` checks the OAuth session with `ping()` and refreshes its
authenticated subject. It is not a live query of the mobile app's selected account/network.
The returned `account.network` and `getNetwork()` retain the network context established
from OAuth user information at connection or restoration. That information may itself
come from a saved session. Reconnecting is therefore not proof of the current selection.

The OAuth ping schema does not declare `network_endpoint` or `network_id`. The adapter
ignores these extensions rather than changing its signing target or failing on partial
metadata. **This behavior is unreleased after RC2**: RC2 attempted to parse those fields,
which could cause spurious refresh failures or misleading network updates.

- A valid session subject refreshes the account while retaining the session network.
- No authenticated subject returns `null`; the manager clears the session.
- A transport failure rejects and keeps the cached state. It is not a successful refresh.
- Late responses cannot overwrite a disconnected or replaced session.

Do not treat `fetchAccount()` success, the application's profile, or an RPC query as proof
of the mobile wallet's current network. Application/RPC checks establish the **target**
network. For Xaman signing, XRPL Connect sends `force_network` and validates the resolved
payload's `environment_networkid` and node type against that target. Missing IDs or
contradictory signing network information remain errors, even after successful refresh.
These are transaction-specific checks, not a general network-verification flag.

Display the session/target network accurately, handle signing-network mismatches, and verify
the actual signed transaction before application submission. Do not disable signing checks
to work around refresh metadata. Test with a real Xaman session as well as mocked responses.

## Error UX

Branch on `WalletError.category` for broad UX and `WalletError.code` for specific recovery. Render wallet/provider messages as text, never unsanitized HTML.

```ts
if (isWalletError(error)) {
  if (error.category === WalletErrorCategory.USER_ACTION) return;
  if (error.category === WalletErrorCategory.WALLET_UNAVAILABLE) showInstallOrUnlockHelp();
  else reportError(error);
}
```

## Release checklist

- Exercise every enabled wallet on testnet and the production origin.
- Verify network mismatch handling and account/network change events.
- Test reconnect, disconnect, modal close, route unmount, and late wallet approval.
- Confirm CSP, popup, deep-link, WebHID, and iframe policies.
- Monitor failures without logging addresses, tokens, payload URLs, or credentials.
