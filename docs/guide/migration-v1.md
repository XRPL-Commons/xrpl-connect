---
description: Upgrade XRPL Connect applications from 0.8.2 to the v1 release line, and from 1.0.0 to 1.1.
---

# Migration Guide

XRPL Connect v1 keeps the `WalletManager` and adapter model from 0.8.2, while tightening signing results, wallet capabilities, persistence, UI lifecycle, and framework integration.

Already on 1.0.0? See [Upgrading from 1.0.0](#upgrading-from-1-0-0).

::: info Current release channel
This guide tracks the `1.1.0-rc.0` release candidate, published under npm's `rc` tag; the
commands below install it with `@rc`. The stable `1.0.0` packages remain on npm's default
channel.
:::

## Choose the packages you use

Do not install both framework bindings. Upgrade the umbrella package and only the binding used by the application:

```bash
# Vanilla JavaScript or a custom framework integration
pnpm add xrpl-connect@rc xrpl@^5

# React
pnpm add xrpl-connect@rc @xrpl-commons/xrpl-connect-react@rc xrpl@^5 react react-dom

# Vue 3 or Nuxt
pnpm add xrpl-connect@rc @xrpl-commons/xrpl-connect-vue@rc xrpl@^5 vue
```

The coordinated release contains these packages:

| Package                            | 0.8.2 line    | 1.0.0 (stable) | Current release              |
| ---------------------------------- | ------------- | -------------- | ---------------------------- |
| `xrpl-connect`                     | `0.8.2`       | `1.0.0`        | `1.1.0-rc.0`                 |
| `@xrpl-commons/xrpl-connect-react` | Not available | `1.0.0`        | `1.1.0-rc.0`                 |
| `@xrpl-commons/xrpl-connect-vue`   | Not available | `1.0.0`        | `1.1.0-rc.0`                 |
| `@xrpl-commons/xrpl-connect-privy` | Not available | Not available  | `1.1.0-rc.0` (new, optional) |

The `@xrpl-connect/core`, `@xrpl-connect/ui`, and individual `@xrpl-connect/adapter-*` packages are
internal workspace packages and are not published to npm. Import everything from the umbrella
package:

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

Do not assume every wallet returns the same signed representation. A `Signers`
array may be one multisign contribution or a fully combined transaction, and the
artifact alone does not prove that the account's signer quorum is satisfied:

```ts
import { decode, encode } from 'xrpl';

const signed = await manager.sign(transaction);
const signedBlob = signed.tx_blob ?? (signed.tx_json ? encode(signed.tx_json) : undefined);

if (!signedBlob) {
  throw new Error('The wallet did not return a signed transaction artifact');
}

const signedJson = signed.tx_json ?? decode(signedBlob);
if (Array.isArray(signedJson.Signers)) {
  throw new Error('Verify this multisigned artifact is complete before submitting');
}

await client.submit(signedBlob);
console.log(signed.signerAddress);
```

Follow the adapter's multisign contract before submitting an artifact with
`Signers`. For example, Ledger `sign()` returns one contribution that must be
combined with the other required contributions through `xrpl.multisign()`.

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
- WalletConnect verifies the wallet's signed result and returns the verified `tx_blob`, its `hash`, the `signature`, and `tx_json` decoded from the blob in canonical form. It never reports `TxnSignature` as `tx_blob`, and multi-signing requests reject with `UNSUPPORTED_METHOD`. See [WalletConnect result verification](/guide/transactions#walletconnect-result-verification).
- Crossmark, GHOSTSIG, Ledger, Privy, WalletConnect, and Xaman do not support arbitrary message signing. Check capabilities instead of displaying an action that will fail.

## Capabilities and fresh account data

Gate optional operations at runtime:

```ts
if (manager.supports('signMessage')) {
  await manager.signMessage(message);
}
```

Use `manager.fetchAccount()` to query account information through the adapter rather than merely reading cached `manager.account`. Freshness depends on the adapter: Xaman refreshes its OAuth subject and retains the session network context, not the mobile app's current selection. Successful refresh does not prove the wallet's current network. Adapters without a supported query reject with `UNSUPPORTED_METHOD`; `null` means the query found no active account and the manager cleared the session. Account and network events remain the preferred way to keep reactive UI synchronized. See [Xaman network evidence](/guide/production#xaman-session-refresh-and-network-evidence).

## Persistence and reconnection

1.0 continues to read the versioned connection envelope written by 0.8.2, including records without newer reconnect options. Unversioned pre-schema state, malformed data, and unsupported future schema versions are discarded safely.

The connection record now stores the network the session was requested on (schema version 2). A version 1 record is upgraded on load by treating its stored network as the requested network; standard networks are kept by id, so restores use their canonical endpoints. A restore requests the manager's configured `network` first and never replays the network or endpoint the wallet last reported. An older runtime discards a version 2 record, so downgrading signs the user out once.

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

Install `createXrplConnect()` once, then use `useWallet()`, `useSigner()`, and `useWalletModal()` below that plugin. In Nuxt, the plugin and every component that calls these composables must be client-only. A `<ClientOnly>` wrapper in a universal component does not prevent that component's setup function from running during SSR.

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

## Upgrading from 1.0.0

Releases after 1.0.0 keep the 1.0 API. These changes, mostly security fixes, can require action:

- **Xaman and CSP:** sign-in redeems an authorization code with PKCE at `https://oauth2.xumm.app/token`. Add `https://oauth2.xumm.app` to `connect-src`; under an enforced policy without it, sign-in fails. See [Xaman OAuth popups and security headers](/guide/production#xaman-oauth-popups-and-security-headers).
- **Legacy Xaman sessions:** sessions saved under the Xaman SDK's `XummPkceJwt` key are no longer restored, so those users sign in once more.
- **Stored connection record:** the record moves to schema version 2 and version 1 records are upgraded on load. A 1.0.0 runtime discards a version 2 record, so downgrading after the upgrade signs users out once.
- **Custom loggers:** a custom `LoggerInstance` receives only `warn` and `error` output unless it sets `level` (or `NODE_ENV` is `'development'`). Set `level: 'debug'` to keep receiving all output.
- **Network enforcement:** a requested network stays the session's network, including restores and logins that return through a redirect. When the wallet switches to another network, the manager emits `error` with `NETWORK_MISMATCH`, and signing rejects with `NETWORK_MISMATCH` until the wallet returns. Handle the event or check `manager.networkMismatch`; see [Network policy](/guide/api-reference#network-policy).
- **Message bytes:** `signMessage()` rejects a `Uint8Array` that is not valid UTF-8 with `INVALID_MESSAGE`.
- **WalletConnect results:** `tx_json` is decoded from the verified `tx_blob` in canonical form (a Payment's `DeliverMax` becomes `Amount`). Multi-signing requests reject with `UNSUPPORTED_METHOD`, and a `signAndSubmit()` that fails verification carries `transactionHash` for reconciliation.
- **MetaMask Snap:** the adapter no longer falls back to `window.ethereum`; MetaMask must announce itself through EIP-6963 (extension v11 or later). The default Snap is requested with the version range `^1.0.3`; set `snapVersion` to change it.
- **Otsu:** signing uses the provider approved at connect. If another script replaces `window.xrpl`, signing rejects with `CONNECTION_FAILED` until the user reconnects.
- **Privy social login** (new, optional package): guest login requires `allowGuestLogin: true`, and every signature needs a transaction review, which the wallet connector shows by default. Keep a connector mounted or set `transactionReview`. See [Social login](/guide/social-login).

The [changelog](https://github.com/XRPL-Commons/xrpl-connect/blob/develop/CHANGELOG.md) lists every change.
