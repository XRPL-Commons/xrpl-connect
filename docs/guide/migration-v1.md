---
description: Upgrade applications from pre-1.0 XRPL Connect releases to v1.0.
---

# Migrating to v1.0

v1.0 stabilizes the manager, adapter, UI, React, and Vue surfaces. Upgrade all XRPL Connect packages together and retest wallet-specific flows.

```bash
pnpm up xrpl-connect@rc @xrpl-connect/react@rc @xrpl-connect/vue@rc
```

## Required checks

1. Use separate `sign(transaction)` and `signAndSubmit(transaction)` calls. The old boolean submit argument is not supported.
2. Handle signing cancellation as `WalletErrorCode.SIGN_REJECTED`, not `SIGN_FAILED`.
3. Check optional operations with `manager.supports(...)`; Xaman and WalletConnect do not support arbitrary message signing.
4. Read signed artifacts from `tx_blob`, `tx_json`, and `signature`. Wallets do not all return the same representation.
5. Treat `signAndSubmit()` as submission, not validated-ledger confirmation.
6. Keep one stable Xaman API key per page lifetime.
7. Use `openAndWait()` when application code needs a modal promise, and handle rejection when the modal closes.
8. Clean up pending connections when UI ownership ends; the official React and Vue integrations do this automatically.

## New in v1.0

- Official `@xrpl-connect/react` provider, hooks, and connector component.
- Official `@xrpl-connect/vue` plugin, composables, and connector component for Vue 3 and Nuxt.
- MetaMask Snap adapter and complete adapter exports from `xrpl-connect`.
- Capability discovery with `manager.supports()`.
- Typed error categories and stable error codes.
- Versioned, adapter-owned reconnect state and configurable storage.
- Typed signed transaction artifacts and signer addresses.
- Safer availability timeouts, connection cancellation, and account/network refresh behavior.

## React migration

Replace custom contexts and custom-element refs with `XrplConnectProvider`, `WalletConnector`, `useWallet`, `useSigner`, and `useWalletModal`. Keep the provider config stable outside render or memoize it.

## Vue migration

Replace hand-written `provide` / `inject` state and direct custom-element refs with
`createXrplConnect()`, `useWallet()`, `useSigner()`, `useWalletModal()`, and the typed
`<WalletConnector>`. In Nuxt, install the plugin from `plugins/xrpl-connect.client.ts` and keep
the connector inside `<ClientOnly>`.

## Need help?

Review the [wallet capability table](/guide/wallets), [production guide](/guide/production), and [GitHub releases](https://github.com/XRPL-Commons/xrpl-connect/releases). Report upgrade problems with the wallet, browser, network, and exact `WalletError` code.
