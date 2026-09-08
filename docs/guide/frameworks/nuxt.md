---
description: Integrate XRPL-Connect into Nuxt with the first-party Vue bindings.
---

# Nuxt

XRPL Connect's modal is a browser custom element. In Nuxt, register it and install the
`@xrpl-commons/xrpl-connect-vue` plugin from a client-only Nuxt plugin. Components that call the injected
Vue composables must also run only on the client.

## Installation

```bash
npm install @xrpl-commons/xrpl-connect-vue@rc xrpl-connect@rc xrpl@^4 vue
```

## Client plugin

The install command selects the prerelease channel. See
[release-channel guidance](/guide/getting-started#release-channel) for switching both
packages to stable v1 after publication.

For Xaman OAuth, also check the served
[popup security headers](/guide/production#xaman-oauth-popups-and-security-headers).
`Cross-Origin-Opener-Policy: same-origin` prevents the popup from reporting back to this app.

Create `plugins/xrpl-connect.client.ts`:

```ts
import { CrossmarkAdapter, XamanAdapter } from 'xrpl-connect';
import { createXrplConnect } from '@xrpl-commons/xrpl-connect-vue';

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
needed. `@xrpl-commons/xrpl-connect-vue` itself remains safe to import in universal modules.

## Wallet component

Create `components/WalletControls.client.vue`. The `.client.vue` suffix keeps both its setup
function and template out of server rendering. The injected refs are automatically unwrapped in
the template.

```vue
<script setup lang="ts">
import { WalletConnector, useWallet, useWalletModal } from '@xrpl-commons/xrpl-connect-vue';

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

The connection modal is not a transaction-signing dialog. Xaman's default signing
presentation opens a popup after payload creation; browsers may block that asynchronous
popup. For explicit mobile and desktop actions, use the
[custom signing presentation](#xaman-signing-presentation) below.

Use `useSigner()` inside the same client-only wallet subtree. For a standalone signing
component, create `components/PaymentButton.client.vue`:

```vue
<script setup lang="ts">
import {
  isWalletError,
  useSigner,
  useWallet,
  WalletErrorCode,
} from '@xrpl-commons/xrpl-connect-vue';

const { account, connected } = useWallet();
const { signAndSubmit } = useSigner();
const signing = useState<{ url: string; deepLink: string } | null>('xaman-signing', () => null);

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
  } finally {
    signing.value = null;
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

## Xaman signing presentation

In the client plugin above, replace the inline Xaman adapter with a configured instance.
`onQRCode` receives an HTTPS signing-page URL, not QR image bytes; it replaces the default
signing popup, not the OAuth login popup. Use the same adapter instance in `adapters`:

```ts
// Inside plugins/xrpl-connect.client.ts, before createXrplConnect().
const signing = useState<{ url: string; deepLink: string } | null>('xaman-signing', () => null);
const xaman: XamanAdapter = new XamanAdapter({
  apiKey: useRuntimeConfig().public.xamanApiKey,
  onQRCode(url) {
    const parsed = new URL(url);
    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'xumm.app' ||
      !parsed.pathname.startsWith('/sign/') ||
      parsed.username ||
      parsed.password
    )
      throw new Error('Invalid Xaman signing URL');
    signing.value = { url, deepLink: xaman.getDeepLinkURI(url) };
  },
});
// In createXrplConnect: adapters: [xaman, new CrossmarkAdapter()]
```

Mount this client-only presentation once in the app. Both navigation actions are explicit
user clicks, so they do not depend on an asynchronous `window.open()`:

```vue
<!-- components/XamanSigning.client.vue -->
<script setup lang="ts">
const signing = useState<{ url: string; deepLink: string } | null>('xaman-signing', () => null);
</script>

<template>
  <section v-if="signing" aria-label="Approve in Xaman" aria-live="polite">
    <p>Approve or reject the pending request in Xaman.</p>
    <a :href="signing.deepLink">Open Xaman on this device</a>
    <a :href="signing.url" target="_blank" rel="noopener noreferrer">Open signing page / QR code</a>
  </section>
</template>
```

The payment component above obtains this same state in setup and clears it in `finally`,
on both success and failure. Apply that cleanup to every signing entry point in your app.

Also clear the presentation after disconnect. Keep signing actions disabled while an
operation is pending, and ensure no page loading overlay covers the presentation. If you
add a Cancel action, await the shared wallet's `disconnect()` and handle its error; hiding
the presentation alone does not cancel signing. Disconnect ends the wallet session and
cannot undo a transaction already approved or submitted. The adapter owns payload creation
and subscription—do not recreate them in the app.
