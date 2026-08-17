---
description: Integrate XRPL-Connect into Nuxt with the first-party Vue bindings.
---

# Nuxt

XRPL Connect's modal is a browser custom element. In Nuxt, register it and install the
`@xrpl-connect/vue` plugin from a client-only Nuxt plugin.

## Installation

```bash
npm install @xrpl-connect/vue@rc xrpl-connect@rc xrpl vue
```

## Client plugin

Create `plugins/xrpl-connect.client.ts`:

```ts
import 'xrpl-connect';
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

The `.client.ts` suffix prevents wallet adapters and custom-element registration from running
during server rendering. `@xrpl-connect/vue` itself remains safe to import in universal modules.

## Wallet component

Render the connector inside Nuxt's `ClientOnly` boundary. The injected refs are automatically
unwrapped in the template.

```vue
<script setup lang="ts">
import { WalletConnector, useWallet, useWalletModal } from '@xrpl-connect/vue';

const { connected, account, connecting, error, disconnect } = useWallet();
const { open } = useWalletModal();
</script>

<template>
  <ClientOnly>
    <button v-if="!connected" :disabled="connecting" @click="open">
      {{ connecting ? 'Connecting…' : 'Connect wallet' }}
    </button>
    <button v-else @click="disconnect">Disconnect {{ account?.address }}</button>

    <p v-if="error">Error [{{ error.code }}]: {{ error.message }}</p>
    <WalletConnector theme="dark" primary-wallet="xaman" />
  </ClientOnly>
</template>
```

## Signing

Use `useSigner()` in any descendant component:

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
