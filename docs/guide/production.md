---
description: Production, security, SSR, persistence, and browser guidance for XRPL Connect v1.0.
---

# Production and security

## Client boundaries and SSR

Wallet adapters interact with browser APIs. Create the manager and render the connector in client code. The `@xrpl-connect/react` package can be imported during SSR, but its provider and connector belong below a React/Next.js client boundary.

```tsx
'use client';

import { XrplConnectProvider, WalletConnector } from '@xrpl-connect/react';
```

For Vue/Nuxt, initialize in a client plugin or `onMounted`, retain named event handlers, and remove them with `manager.off()` during teardown.

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
