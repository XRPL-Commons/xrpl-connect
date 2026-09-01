# @xrpl-commons/xrpl-connect-vue

Vue 3 bindings for XRPL Connect: an app plugin that owns a `WalletManager`, reactive
composables, and a typed `<WalletConnector>` modal component.

## Install

```bash
npm install @xrpl-commons/xrpl-connect-vue@rc xrpl-connect@rc xrpl@^4 vue
```

## Usage

```ts
// main.ts
import { createApp } from 'vue';
import { XamanAdapter, CrossmarkAdapter } from 'xrpl-connect';
import { createXrplConnect } from '@xrpl-commons/xrpl-connect-vue';
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
import {
  WalletConnector,
  useSigner,
  useWallet,
  useWalletModal,
} from '@xrpl-commons/xrpl-connect-vue';

const { connected, account, error, disconnect } = useWallet();
const { signAndSubmit } = useSigner();
const { ready, open } = useWalletModal();
</script>

<template>
  <button v-if="!connected" :disabled="!ready" @click="open">Connect wallet</button>
  <button v-else @click="disconnect">Disconnect {{ account?.address }}</button>
  <p v-if="error">Error [{{ error.code }}]: {{ error.message }}</p>
  <WalletConnector theme="dark" showUnavailable />
</template>
```

## API

- `createXrplConnect(config)` creates the app plugin and one isolated manager per installation.
- `useWallet()` exposes `manager`, readonly `connected`, `account`, `network`, `connecting`,
  and `error` refs, plus `connect` and `disconnect`.
- `useSigner()` exposes `sign`, `signAndSubmit`, and `signMessage`.
- `useWalletModal()` exposes a readonly `ready` ref, awaitable `open()` and `openAndWait()`
  methods, and `close()` for the active connector. `openAndWait()` resolves with the connected
  account and rejects if opening fails or the modal closes first.
- `<WalletConnector>` accepts `primaryWallet`, `wallets`, `showUnavailable`, `theme`, and
  `cssVars`, and emits `connecting`, `connect`, and typed `error` events. Unavailable wallets are
  hidden by default; set the camelCase Vue prop `showUnavailable` to show an Install action when
  the adapter provides a download URL, or a disabled Unavailable row otherwise.

`useWallet().connect` narrows deferred options from the wallet ID:

```ts
const { connect } = useWallet();
await connect('xaman', { apiKey: 'YOUR_KEY' });
await connect('walletconnect', { projectId: 'YOUR_PROJECT_ID' });
```

For modal discovery and `autoConnect`, configure these credentials on the
adapter constructor as shown above. Deferred credentials apply only to that
direct call and are not persisted for reconnection. Missing configuration is a
typed `CONFIGURATION_REQUIRED` error.

The named `xrpl-connect` import also registers the wallet connector custom element, so a separate
side-effect import is not needed. Importing `@xrpl-commons/xrpl-connect-vue` is SSR-safe, but plugin
installation, injected composable calls, and wallet UI rendering must stay on the client. In
Nuxt, put composable consumers in `.client.vue` components or wholly below a client-only child
boundary; wrapping only the template does not stop universal setup from running during SSR.

Modal ownership follows registration order: the most recently registered connector is active,
and unmounting it falls back to the previous connector. `ready` stays `true` while any connector
is registered. Calling `open()` or `openAndWait()` before registration rejects with a namespaced
setup error instead of silently doing nothing.
