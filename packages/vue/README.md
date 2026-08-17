# @xrpl-connect/vue

Vue 3 bindings for XRPL Connect: an app plugin that owns a `WalletManager`, reactive
composables, and a typed `<WalletConnector>` modal component.

## Install

```bash
npm install @xrpl-connect/vue xrpl-connect xrpl vue
```

## Usage

```ts
// main.ts
import { createApp } from 'vue';
import { XamanAdapter, CrossmarkAdapter } from 'xrpl-connect';
import { createXrplConnect } from '@xrpl-connect/vue';
import App from './App.vue';

const app = createApp(App);
app.use(
  createXrplConnect({
    adapters: [new XamanAdapter({ apiKey: 'YOUR_KEY' }), new CrossmarkAdapter()],
    network: 'testnet',
    autoConnect: true,
  })
);
app.mount('#app');
```

```vue
<script setup lang="ts">
import { WalletConnector, useSigner, useWallet, useWalletModal } from '@xrpl-connect/vue';

const { connected, account, error, disconnect } = useWallet();
const { signAndSubmit } = useSigner();
const { open } = useWalletModal();
</script>

<template>
  <button v-if="!connected" @click="open">Connect wallet</button>
  <button v-else @click="disconnect">Disconnect {{ account?.address }}</button>
  <p v-if="error">Error [{{ error.code }}]: {{ error.message }}</p>
  <WalletConnector theme="dark" />
</template>
```

## API

- `createXrplConnect(config)` creates the app plugin and one isolated manager per installation.
- `useWallet()` exposes `manager`, readonly `connected`, `account`, `network`, `connecting`,
  and `error` refs, plus `connect` and `disconnect`.
- `useSigner()` exposes `sign`, `signAndSubmit`, and `signMessage`.
- `useWalletModal()` exposes `open` and `close` for the active connector.
- `<WalletConnector>` accepts `primaryWallet`, `wallets`, `theme`, and `cssVars`, and emits
  `connecting`, `connect`, and typed `error` events.

The named `xrpl-connect` import also registers the wallet connector custom element, so a separate
side-effect import is not needed. Importing `@xrpl-connect/vue` is SSR-safe, but plugin
installation, injected composable calls, and wallet UI rendering must stay on the client. In
Nuxt, put composable consumers in `.client.vue` components or wholly below a client-only child
boundary; wrapping only the template does not stop universal setup from running during SSR.
