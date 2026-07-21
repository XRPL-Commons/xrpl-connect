---
description: Integrate XRPL-Connect into your Vue 3 application with first-party composables.
---

# Vue 3

`@xrpl-connect/vue` provides a Vue plugin, reactive composables, and a typed wrapper for the
wallet connector modal. Configure the wallet manager once and consume the same state anywhere
in the application.

## Installation

```bash
npm install @xrpl-connect/vue xrpl-connect xrpl vue
```

## Configure the plugin

Import `xrpl-connect` once in the browser entry point to register the wallet connector custom
element, then install the Vue plugin before mounting the application:

```ts
// main.ts
import { createApp } from 'vue';
import 'xrpl-connect';
import { CrossmarkAdapter, XamanAdapter } from 'xrpl-connect';
import { createXrplConnect } from '@xrpl-connect/vue';
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
in scripts. `useWalletModal()` controls the most recently mounted connector.

```vue
<script setup lang="ts">
import { WalletConnector, useWallet, useWalletModal } from '@xrpl-connect/vue';

const { connected, account, connecting, error, disconnect } = useWallet();
const { open } = useWalletModal();
</script>

<template>
  <button v-if="!connected" :disabled="connecting" @click="open">
    {{ connecting ? 'Connecting…' : 'Connect wallet' }}
  </button>
  <button v-else @click="disconnect">Disconnect {{ account?.address }}</button>

  <p v-if="error">Error [{{ error.code }}]: {{ error.message }}</p>

  <WalletConnector
    primary-wallet="xaman"
    :wallets="['xaman', 'crossmark']"
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
import { isWalletError, useSigner, useWallet } from '@xrpl-connect/vue';

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
    if (isWalletError(error)) console.error(error.code, error.category, error.message);
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
- `useWalletModal()` returns `open` and `close`.
- `<WalletConnector>` wraps the browser custom element with typed Vue props and events.

## SSR and Nuxt

The package itself is safe to import during server rendering. The connector is a browser custom
element, so register `xrpl-connect`, install the plugin, and render the modal from client-only
code. See the [Nuxt guide](./nuxt) for the client-plugin pattern.
