---
description: Upgrade XRPL Connect applications from 0.8.2 to the 1.0 release line.
---

# Migrating from 0.8.2 to 1.0.0

XRPL Connect 1.0 keeps the `WalletManager` and adapter model from 0.8.2, while tightening signing results, wallet capabilities, persistence, UI lifecycle, and framework integration.

::: info Current release channel
The current candidate is `1.0.0-rc.0`. Install it with the `rc` tag. The npm `latest` tag remains on `0.8.2` until the stable release is approved.
:::

## Choose the packages you use

Do not install both framework bindings. Upgrade the umbrella package and only the binding used by the application:

```bash
# Vanilla JavaScript or a custom framework integration
pnpm add xrpl-connect@rc xrpl@^4

# React
pnpm add xrpl-connect@rc @xrpl-commons/xrpl-connect-react@rc xrpl@^4 react react-dom

# Vue 3 or Nuxt
pnpm add xrpl-connect@rc @xrpl-commons/xrpl-connect-vue@rc xrpl@^4 vue
```

The coordinated release candidate contains these three artifacts:

| Package                            | 0.8.2 line    | Current 1.0 candidate           |
| ---------------------------------- | ------------- | ------------------------------- |
| `xrpl-connect`                     | `0.8.2`       | `1.0.0-rc.0`                    |
| `@xrpl-commons/xrpl-connect-react` | Not available | `1.0.0-rc.0` (new)              |
| `@xrpl-commons/xrpl-connect-vue`   | Not available | `1.0.0-rc.0` (new)              |
| Standalone core/UI/adapters        | `0.8.2` line  | Not part of this coordinated RC |

If an application imports `@xrpl-connect/core`, `@xrpl-connect/ui`, or individual adapter packages directly, it can remain on the compatible 0.8.2 modular line. To adopt the complete 1.0 candidate, move those imports to the umbrella package:

```ts
// 0.8.2 modular imports
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import '@xrpl-connect/ui';

// 1.0 umbrella exports
import { WalletManager, XamanAdapter } from 'xrpl-connect';
```

## Signing and result handling

`sign()` and `signAndSubmit()` remain separate methods. Applications already using the 0.8.2 runtime API do not need to rename them. Some older package documentation showed a boolean overload for `signAndSubmit`; that overload was not part of the 0.8.2 implementation and must not be used.

Do not assume every wallet returns the same signed representation. Use the optional artifact that is present:

```ts
const signed = await manager.sign(transaction);

if (signed.tx_blob) {
  await client.submit(signed.tx_blob);
} else if (signed.tx_json) {
  // Submit or encode the signed JSON according to your xrpl.js flow.
  await client.submit(signed.tx_json);
} else {
  throw new Error('The wallet did not return a submit-ready transaction artifact');
}

console.log(signed.signerAddress);
```

`signAndSubmit()` returns a transaction hash after the wallet submits. A returned hash is not proof that the transaction reached a validated ledger; query a trusted XRPL client when confirmation matters.

User cancellation is `SIGN_REJECTED`. `SIGN_FAILED` is reserved for an actual signing failure:

```ts
import { isWalletError, WalletErrorCode } from 'xrpl-connect';

try {
  await manager.signAndSubmit(transaction);
} catch (error) {
  if (isWalletError(error) && error.code === WalletErrorCode.SIGN_REJECTED) return;
  throw error;
}
```

### Wallet-specific result changes

- Xaman now keeps `sign()` sign-only, verifies the returned blob and signer, and exposes `tx_blob`, `tx_json`, and `signature` when supplied. Use `signAndSubmit()` when Xaman should dispatch to the ledger.
- WalletConnect returns a signed `tx_json` and `signature`; it does not mislabel `TxnSignature` as a serialized `tx_blob`.
- WalletConnect and Xaman do not support arbitrary message signing. Check capabilities instead of displaying an action that will fail.

## Capabilities and fresh account data

Gate optional operations at runtime:

```ts
if (manager.supports('signMessage')) {
  await manager.signMessage(message);
}
```

Use `manager.fetchAccount()` when the application needs current wallet-owned account or network data rather than the cached `manager.account`. Adapters without a reliable live query reject with `UNSUPPORTED_METHOD`; `null` means a supported query found no active account and the manager cleared the session. Account and network events remain the preferred way to keep reactive UI synchronized.

## Persistence and reconnection

1.0 continues to read the versioned connection envelope written by 0.8.2, including records without newer reconnect options. Unversioned pre-schema state, malformed data, and unsupported future schema versions are discarded safely.

- Construct the manager and register listeners before starting application UI when `autoConnect` is enabled.
- Treat reconnect as an asynchronous attempt that can fail because an extension, session, device, or network is unavailable.
- Supply a custom storage adapter when browser `localStorage` is not appropriate; use `MemoryStorageAdapter` for tests or non-persistent environments.
- Never persist seeds, private keys, signing payloads, or unrestricted connect options.

## Connector UI changes

- `open()` opens the selector and resolves immediately; use `openAndWait()` when code must await either a connection or modal dismissal.
- Closing or unmounting the connector cancels its pending connection flow. Handle a rejected `openAndWait()` promise.
- Unavailable wallets are hidden by default. Add `show-unavailable` only when the product should show install links.
- Successful wallets are ordered by most recent use in `localStorage` under `xrpl-connect:mru-wallets`; `primary-wallet` still takes precedence.

```ts
try {
  const account = await connector.openAndWait();
  console.log(account.address);
} catch {
  // The user closed the modal before connecting.
}
```

## React

Use one provider above every hook and connector. The provider snapshots its initial configuration and owns one manager; changing the config object does not rebuild it. Give the provider a new React `key` only when intentionally replacing the manager.

```tsx
const walletConfig = {
  adapters: [new XamanAdapter({ apiKey: import.meta.env.VITE_XAMAN_API_KEY })],
  network: 'testnet' as const,
};

root.render(
  <XrplConnectProvider config={walletConfig}>
    <App />
  </XrplConnectProvider>
);
```

Use `useWallet()` for connection state, `useSigner()` for signing, and `useWalletModal()` for the most recently mounted connector. Provider and connector cleanup removes listeners and cancels UI-owned pending attempts.

## Vue 3 and Nuxt

Install `createXRPLConnect()` once, then use `useWallet()`, `useSigner()`, and `useWalletModal()` below that plugin. In Nuxt, the plugin and every component that calls these composables must be client-only. A `<ClientOnly>` wrapper in a universal component does not prevent that component's setup function from running during SSR.

```ts
// plugins/xrpl-connect.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(createXrplConnect({ adapters, network: 'testnet' }));
});
```

Name wallet UI consumers with a `.client.vue` suffix or otherwise ensure their setup executes only in the browser.

## Regression checklist

Before shipping the upgrade, verify:

- every package resolves to the intended channel and no framework binding has an incompatible `xrpl-connect` peer;
- connect, reject, disconnect, reconnect, account change, and network change flows for every supported wallet;
- sign-only and sign-and-submit behavior, including the actual artifact returned by each wallet;
- cancellation is handled as `SIGN_REJECTED` without showing a failure toast;
- optional message signing is hidden when `manager.supports('signMessage')` is false;
- a 0.8.2 stored session reconnects, while malformed or unsupported stored state fails closed;
- modal close/unmount cancels pending work and `openAndWait()` rejection is handled;
- React Strict Mode and Vue/Nuxt unmount paths do not leave duplicate listeners or pending connections;
- SSR imports and server rendering complete without browser globals; and
- production-origin restrictions are configured for Xaman and WalletConnect browser identifiers.
