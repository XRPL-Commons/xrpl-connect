---
description: Integrate XRPL-Connect into your Vue 3 application with first-party composables.
---

# Vue 3

`@xrpl-commons/xrpl-connect-vue` provides a Vue plugin, reactive composables, and a typed wrapper for the
wallet connector modal. Configure the wallet manager once and consume the same state anywhere
in the application.

## Installation

```bash
npm install @xrpl-commons/xrpl-connect-vue@rc xrpl-connect@rc xrpl vue
```

## Configure the plugin

Import adapters from `xrpl-connect` in the browser entry point. Evaluating that package entry
also registers the wallet connector custom element. Then install the Vue plugin before mounting
the application:

```ts
// main.ts
import { createApp } from 'vue';
import { CrossmarkAdapter, XamanAdapter } from 'xrpl-connect';
import { createXrplConnect } from '@xrpl-commons/xrpl-connect-vue';
import App from './App.vue';

const app = createApp(App);

app.use(
  createXrplConnect({
    adapters: [new XamanAdapter({ apiKey: 'YOUR_API_KEY' }), new CrossmarkAdapter()],
    network: 'testnet',
    autoConnect: true,
  })
);

app.mount('#app');
```

Each plugin installation owns one `WalletManager`. Its state and event listeners are isolated
from other Vue applications on the same page and are released when the app unmounts.

## Wallet state and modal

`useWallet()` returns readonly Vue refs, so use them directly in templates and through `.value`
in scripts. `useWalletModal()` returns a readonly `ready` ref, `open(): Promise<void>`,
`openAndWait(): Promise<AccountInfo>`, and `close(): void` for the active connector. Await
`open()` to observe availability-check failures, or await `openAndWait()` when the caller needs
the connected account; `openAndWait()` rejects if opening fails or the modal closes first.

All composables must run below an application that installed `createXrplConnect()`. `ready`
becomes `true` after a connector registers and returns to `false` after the last connector
unmounts. Calling `open()` or `openAndWait()` while it is `false` rejects with a namespaced setup
error. If several connectors are mounted, the most recently registered connector owns modal
calls; unmounting it falls back to the previous connector. Keep one mounted `<WalletConnector>`
when that ownership rule is unnecessary.

For a headless flow, connect directly by adapter ID:

```ts
const { connect } = useWallet();
await connect('crossmark');
```

With `autoConnect: true`, the plugin restores the persisted session on the client after its
reactive listeners are ready.

```vue
<script setup lang="ts">
import { WalletConnector, useWallet, useWalletModal } from '@xrpl-commons/xrpl-connect-vue';

const { connected, account, connecting, error, disconnect } = useWallet();
const { ready, open } = useWalletModal();
</script>

<template>
  <button v-if="!connected" :disabled="!ready || connecting" @click="open">
    {{ connecting ? 'Connecting…' : 'Connect wallet' }}
  </button>
  <button v-else @click="disconnect">Disconnect {{ account?.address }}</button>

  <p v-if="error">Error [{{ error.code }}]: {{ error.message }}</p>

  <WalletConnector
    primary-wallet="xaman"
    :wallets="['xaman', 'crossmark']"
    showUnavailable
    theme="dark"
    :css-vars="{ '--xc-primary-color': '#a78bfa' }"
    @connecting="(walletId) => console.log('Connecting', walletId)"
    @connect="(connectedAccount) => console.log('Connected', connectedAccount.address)"
    @error="(walletError) => console.error(walletError.code, walletError.message)"
  />
</template>
```

## Signing

Signing actions are bound to the injected manager and reject with typed `WalletError` values.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import {
  isWalletError,
  useSigner,
  useWallet,
  WalletErrorCode,
} from '@xrpl-commons/xrpl-connect-vue';

const { account, connected } = useWallet();
const { signAndSubmit } = useSigner();
const submitting = ref(false);
const result = ref<string | null>(null);

async function sendPayment() {
  if (!connected.value || !account.value) return;
  submitting.value = true;

  try {
    const submitted = await signAndSubmit({
      TransactionType: 'Payment',
      Account: account.value.address,
      Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
      Amount: '1000000',
    });
    result.value = submitted.hash;
  } catch (error) {
    if (isWalletError(error) && error.code === WalletErrorCode.SIGN_REJECTED) return;
    throw error;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <button :disabled="submitting || !connected" @click="sendPayment">Send payment</button>
  <p v-if="result">Submitted: {{ result }}</p>
</template>
```

## API summary

- `createXrplConnect(config)` installs an isolated wallet manager using core `WalletManagerOptions`.
- `useWallet()` returns `manager`, `connected`, `account`, `network`, `connecting`, `error`,
  `connect`, and `disconnect`.
- `useSigner()` returns `sign`, `signAndSubmit`, and `signMessage`.
- `useWalletModal()` returns readonly `ready`, awaitable `open` and `openAndWait`, and `close`.
- `<WalletConnector>` wraps the browser custom element with typed Vue props and events.

`WalletConnector` accepts `primaryWallet`, `wallets`, `showUnavailable`, `theme`, and `cssVars`,
and emits `connecting`, `connect`, and typed `error` events. Unavailable wallets are hidden by
default. Set the camelCase Vue prop `showUnavailable` to show an Install action when an adapter
provides a download URL, or a disabled Unavailable row when it does not. Removing the prop or
setting it to `false` removes the native `show-unavailable` attribute. Use
`manager.supports('signMessage')` before showing optional signing actions.

## SSR and Nuxt

The package itself is safe to import during server rendering. The connector is a browser custom
element, so evaluate `xrpl-connect`, install the plugin, and invoke the injected composables only
from client code. In Nuxt, a template `<ClientOnly>` does not prevent the same component's setup
function from running during SSR; use a `.client.vue` consumer or a child wholly below the
client-only boundary. See the [Nuxt guide](./nuxt) for the complete pattern.
