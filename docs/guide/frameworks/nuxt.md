---
description: Integrate XRPL-Connect into Nuxt with the first-party Vue bindings.
---

# Nuxt

XRPL Connect's modal is a browser custom element. In Nuxt, register it and install the
`@xrpl-connect/vue` plugin from a client-only Nuxt plugin. Components that call the injected
Vue composables must also run only on the client.

## Installation

```bash
npm install @xrpl-connect/vue@^1.0.0 xrpl-connect@^1.0.0 xrpl vue
```

## Client plugin

Create `plugins/xrpl-connect.client.ts`:

```ts
import { CrossmarkAdapter, XamanAdapter } from 'xrpl-connect';
import { createXrplConnect } from '@xrpl-connect/vue';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(
    createXrplConnect({
      adapters: [
        new XamanAdapter({ apiKey: useRuntimeConfig().public.xamanApiKey }),
        new CrossmarkAdapter(),
      ],
      network: 'testnet',
      autoConnect: true,
    })
  );
});
```

Expose the public API key through runtime configuration:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      xamanApiKey: process.env.NUXT_PUBLIC_XAMAN_API_KEY,
    },
  },
});
```

The Xaman API key and WalletConnect project ID are public application identifiers. Restrict
them by origin in their provider dashboards, and never place seeds, signing material, or API
secrets in `runtimeConfig.public`.

The `.client.ts` suffix prevents wallet adapters, plugin installation, and custom-element
registration from running during server rendering. The named `xrpl-connect` import evaluates
the package entry and registers the custom element, so a separate side-effect import is not
needed. `@xrpl-connect/vue` itself remains safe to import in universal modules.

## Wallet component

Create `components/WalletControls.client.vue`. The `.client.vue` suffix keeps both its setup
function and template out of server rendering. The injected refs are automatically unwrapped in
the template.

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
  <WalletConnector theme="dark" primary-wallet="xaman" />
</template>
```

Use `<WalletControls />` normally from a universal page or layout. A template-level
`<ClientOnly>` only skips rendering its children on the server; it does not stop the containing
component's `<script setup>` from executing. Therefore, wrapping the markup above while leaving
the composable calls in a universal component still throws because the client-only plugin has
not provided its injection during SSR. If you prefer an explicit `<ClientOnly>` fallback, keep
the parent universal and move every wallet composable call into a child rendered inside that
boundary.

## Signing

Use `useSigner()` inside the same client-only wallet subtree. For a standalone signing
component, create `components/PaymentButton.client.vue`:

```vue
<script setup lang="ts">
import { isWalletError, useSigner, useWallet, WalletErrorCode } from '@xrpl-connect/vue';

const { account, connected } = useWallet();
const { signAndSubmit } = useSigner();

async function sendPayment() {
  if (!connected.value || !account.value) return;

  try {
    await signAndSubmit({
      TransactionType: 'Payment',
      Account: account.value.address,
      Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
      Amount: '1000000',
    });
  } catch (error) {
    if (isWalletError(error) && error.code === WalletErrorCode.SIGN_REJECTED) return;
    throw error;
  }
}
</script>
```

Signing rejects with typed `WalletError` values. Use `isWalletError()` to distinguish user
rejection from failures, and check `manager.supports(...)` before exposing optional operations
such as message signing. The [Vue guide](/guide/frameworks/vue) shows the complete pattern.

The plugin owns one manager for the Nuxt application and removes its listeners and active
connection when the Vue app unmounts. Do not create an additional `WalletManager` in a
component or Pinia store.

`autoConnect: true` restores the minimal persisted connection record on the client; it does
not reconnect during SSR or store private signing material. See the
[production guide](/guide/production) for deployment and storage guidance.
