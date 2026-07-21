---
description: Integrate XRPL-Connect into Nuxt with the first-party Vue bindings.
---

# Nuxt

XRPL Connect's modal is a browser custom element. In Nuxt, register it and install the
`@xrpl-connect/vue` plugin from a client-only Nuxt plugin.

## Installation

```bash
npm install @xrpl-connect/vue xrpl-connect xrpl vue
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
import { useSigner, useWallet } from '@xrpl-connect/vue';

const { account, connected } = useWallet();
const { signAndSubmit } = useSigner();

async function sendPayment() {
  if (!connected.value || !account.value) return;

  await signAndSubmit({
    TransactionType: 'Payment',
    Account: account.value.address,
    Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
    Amount: '1000000',
  });
}
</script>
```

The plugin owns one manager for the Nuxt application and removes its listeners and active
connection when the Vue app unmounts. Do not create an additional `WalletManager` in a
component or Pinia store.
