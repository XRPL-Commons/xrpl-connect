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
