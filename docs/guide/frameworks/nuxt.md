---
description: Integrate XRPL-Connect into your Nuxt 3 application using the Composition API.
---

# Nuxt 3

Integrate XRPL-Connect into your Nuxt 3 application with the Composition API.

## Installation

```bash
npm install xrpl-connect xrpl
```

## Basic Setup

Create a composable for wallet management:

```typescript
// composables/useWallet.ts
import { ref, onMounted } from 'vue';
import { WalletManager,XamanAdapter;CrossmarkAdapter } from 'xrpl-connect';
import type { Account, WalletError, WalletAdapter } from 'xrpl-connect';

interface UseWalletOptions {
  adapters: WalletAdapter[];
  network?: 'mainnet' | 'testnet' | 'devnet';
}

export const useWallet = (options: UseWalletOptions) => {
  const { adapters, network = 'testnet' } = options;

  const walletManager = ref<WalletManager | null>(null);
  const account = ref<Account | null>(null);
  const connected = ref(false);
  const error = ref<WalletError | null>(null);
  const loading = ref(true);
  const connectorRef = ref<HTMLElement | null>(null);

  onMounted(() => {
    const manager = new WalletManager({
      adapters,
      network,
      autoConnect: true,
    });

    manager.on('connect', (acc: Account) => {
      account.value = acc;
      connected.value = true;
      error.value = null;
    });

    manager.on('disconnect', () => {
      account.value = null;
      connected.value = false;
    });

    manager.on('error', (err: WalletError) => {
      error.value = err;
    });

    walletManager.value = manager;
    loading.value = false;

    if (connectorRef.value) {
      connectorRef.value.setWalletManager(manager);
    }
  });

  const disconnect = async () => {
    if (walletManager.value) {
      await walletManager.value.disconnect();
    }
  };

  return {
    walletManager,
    account,
    connected,
    error,
    loading,
    connectorRef,
    disconnect,
  };
};
```

## Creating a Plugin

Create a Nuxt plugin to provide wallet globally:

```typescript
// plugins/wallet.client.ts
import { defineNuxtPlugin } from '#app';
import { WalletManager,XamanAdapter;CrossmarkAdapter } from 'xrpl-connect';
import type { Account, WalletError } from 'xrpl-connect';

declare module '#app' {
  interface NuxtApp {
    $wallet: {
      manager: WalletManager | null;
      account: any;
      connected: boolean;
      error: WalletError | null;
    };
  }
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();

  const manager = new WalletManager({
    adapters: [
      new XamanAdapter({
        apiKey: config.public.xamanApiKey || '',
      }),
      new CrossmarkAdapter(),
    ],
    network: 'testnet',
    autoConnect: true,
  });

  const state = reactive({
    manager,
    account: null as Account | null,
    connected: false,
    error: null as WalletError | null,
  });

  manager.on('connect', (account: Account) => {
    state.account = account;
    state.connected = true;
    state.error = null;
  });

  manager.on('disconnect', () => {
    state.account = null;
    state.connected = false;
  });

  manager.on('error', (error: WalletError) => {
    state.error = error;
  });

  return {
    provide: {
      wallet: state,
    },
  };
});
```

Add to your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      xamanApiKey: process.env.NUXT_PUBLIC_XAMAN_API_KEY,
    },
  },
});
```

## Using the Plugin

Access the wallet in any component:

```vue
<template>
  <div>
    <xrpl-wallet-connector ref="connectorRef" primary-wallet="xaman" />

    <div v-if="$wallet.error" style="color: red">Error: {{ $wallet.error.message }}</div>

    <div v-if="$wallet.account" style="margin-top: 20px">
      <h3>Connected Account</h3>
      <p><strong>Address:</strong> {{ $wallet.account.address }}</p>
      <p><strong>Network:</strong> {{ $wallet.account.network.name }}</p>
      <button @click="handleDisconnect">Disconnect</button>
    </div>
  </div>
</template>

<script setup lang="ts">
const connectorRef = ref<HTMLElement | null>(null);
const { $wallet } = useNuxtApp();

onMounted(() => {
  if (connectorRef.value && $wallet.manager) {
    connectorRef.value.setWalletManager($wallet.manager);
  }
});

const handleDisconnect = async () => {
  if ($wallet.manager) {
    await $wallet.manager.disconnect();
  }
};
</script>
```

## Composable with Plugin

Combine composable + plugin for maximum flexibility:

```typescript
// composables/useWalletManager.ts
export const useWalletManager = () => {
  const { $wallet } = useNuxtApp();
  const connectorRef = ref<HTMLElement | null>(null);

  onMounted(() => {
    if (connectorRef.value && $wallet.manager) {
      connectorRef.value.setWalletManager($wallet.manager);
    }
  });

  return {
    ...toRefs($wallet),
    connectorRef,
  };
};
```

Usage:

```vue
<script setup lang="ts">
const { account, connected, error, connectorRef, manager } = useWalletManager();

const handlePayment = async () => {
  if (!manager?.connected) return;

  try {
    const result = await manager.signAndSubmit({
      TransactionType: 'Payment',
      Account: account.value.address,
      Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
      Amount: '1000000',
    });
    console.log('Payment sent:', result.hash);
  } catch (error) {
    console.error('Payment failed:', error);
  }
};
</script>
```

## Signing Transactions

Handle transactions in Nuxt:

```vue
<template>
  <form @submit.prevent="handleSubmit">
    <button type="submit" :disabled="loading || !$wallet.connected">
      {{ loading ? 'Sending...' : 'Send Payment' }}
    </button>
    <p v-if="errorMsg" style="color: red">{{ errorMsg }}</p>
    <p v-if="result" style="color: green">Success! Hash: {{ result.hash }}</p>
  </form>
</template>

<script setup lang="ts">
const { $wallet } = useNuxtApp();

const loading = ref(false);
const errorMsg = ref('');
const result = ref<any>(null);

const handleSubmit = async () => {
  if (!$wallet.manager?.connected) {
    errorMsg.value = 'Wallet not connected';
    return;
  }

  loading.value = true;
  errorMsg.value = '';

  try {
    const txResult = await $wallet.manager.signAndSubmit({
      TransactionType: 'Payment',
      Account: $wallet.account.address,
      Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
      Amount: '1000000',
    });

    result.value = txResult;
  } catch (error: any) {
    errorMsg.value = error.message;
  } finally {
    loading.value = false;
  }
};
</script>
```

## Middleware for Protected Routes

Protect routes that require wallet connection:

```typescript
// middleware/requireWallet.ts
export default defineRouteMiddleware((to, from) => {
  const { $wallet } = useNuxtApp();

  if (!$wallet.connected) {
    return navigateTo('/');
  }
});
```

Use in a page:

```vue
<!-- pages/transactions.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: 'requireWallet',
});
</script>

<template>
  <div>Protected content here</div>
</template>
```

## Pinia Store Integration

For larger apps, use Pinia with XRPL-Connect:

```typescript
// stores/wallet.ts
import { defineStore } from 'pinia';
import { WalletManager, XamanAdapter } from 'xrpl-connect';
import type { Account, WalletError } from 'xrpl-connect';

export const useWalletStore = defineStore('wallet', () => {
  const manager = ref<WalletManager | null>(null);
  const account = ref<Account | null>(null);
  const connected = ref(false);
  const error = ref<WalletError | null>(null);

  const initializeWallet = (adapters: any[]) => {
    const newManager = new WalletManager({
      adapters,
      network: 'testnet',
      autoConnect: true,
    });

    newManager.on('connect', (acc: Account) => {
      account.value = acc;
      connected.value = true;
      error.value = null;
    });

    newManager.on('disconnect', () => {
      account.value = null;
      connected.value = false;
    });

    newManager.on('error', (err: WalletError) => {
      error.value = err;
    });

    manager.value = newManager;
  };

  const disconnect = async () => {
    if (manager.value) {
      await manager.value.disconnect();
    }
  };

  const signAndSubmit = async (transaction: any) => {
    if (!manager.value?.connected) {
      throw new Error('Wallet not connected');
    }
    return manager.value.signAndSubmit(transaction);
  };

  return {
    manager,
    account,
    connected,
    error,
    initializeWallet,
    disconnect,
    signAndSubmit,
  };
});
```

Use in a page:

```vue
<script setup lang="ts">
import { useWalletStore } from '~/stores/wallet';
import { XamanAdapter } from 'xrpl-connect';

const wallet = useWalletStore();
const config = useRuntimeConfig();

onMounted(() => {
  if (!wallet.manager) {
    wallet.initializeWallet([new XamanAdapter({ apiKey: config.public.xamanApiKey })]);
  }
});

const handlePayment = async () => {
  try {
    const result = await wallet.signAndSubmit({
      TransactionType: 'Payment',
      Account: wallet.account.address,
      Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
      Amount: '1000000',
    });
    console.log('Payment sent:', result.hash);
  } catch (error) {
    console.error('Payment failed:', error);
  }
};
</script>
```

## Error Handling

Handle errors gracefully:

```vue
<template>
  <div>
    <xrpl-wallet-connector ref="connectorRef" />

    <ErrorAlert v-if="$wallet.error" :error="$wallet.error" />
  </div>
</template>

<script setup lang="ts">
const ErrorAlert = defineAsyncComponent(() => import('~/components/ErrorAlert.vue'));
</script>
```

Create the error component:

```vue
<!-- components/ErrorAlert.vue -->
<template>
  <div class="error-alert">
    {{ getErrorMessage(error) }}
  </div>
</template>

<script setup lang="ts">
interface Props {
  error: any;
}

const props = defineProps<Props>();

const getErrorMessage = (error: any) => {
  if (error.code === 'WALLET_NOT_FOUND') {
    return 'Please install a wallet to continue';
  } else if (error.code === 'CONNECTION_FAILED') {
    return 'Failed to connect. Please try again.';
  } else if (error.code === 'SIGN_FAILED') {
    return 'You rejected the transaction';
  }
  return error.message;
};
</script>

<style scoped>
.error-alert {
  padding: 10px;
  background: #fee;
  color: #c00;
  border-radius: 4px;
}
</style>
```

## Server Routes for Backend Operations

Use Nuxt server routes for secure operations:

```typescript
// server/api/transactions/sign.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  try {
    // Validate transaction on backend
    if (!body.transaction.Account || !body.transaction.Destination) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid transaction',
      });
    }

    // Process transaction
    // You could integrate server-side xrpl operations here

    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }
});
```

Use in your component:

```typescript
const submitTransaction = async () => {
  const result = await $fetch('/api/transactions/sign', {
    method: 'POST',
    body: {
      transaction: {
        TransactionType: 'Payment',
        Account: $wallet.account.address,
        Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
        Amount: '1000000',
      },
    },
  });
};
```

## Environment Variables

Set up your `.env` file:

```bash
NUXT_PUBLIC_XAMAN_API_KEY=your_api_key
NUXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

## Best Practices

1. **Use Plugins** - Initialize wallet in a plugin for app-wide access

2. **Composables** - Create composables for component-level wallet logic

3. **Error Handling** - Handle errors gracefully in all wallet operations

4. **Middleware** - Protect routes with middleware when needed

5. **Pinia for Complex State** - Use Pinia for larger applications

6. **Type Safety** - Use TypeScript for better type checking

7. **Environment Variables** - Keep secrets in `.env` files

8. **SSR Considerations** - Use `client-only` components for wallet UI

```vue
<!-- Prevent SSR for web components -->
<ClientOnly>
  <xrpl-wallet-connector ref="connectorRef" />
</ClientOnly>
```

## Full Example: Complete Nuxt Page

```vue
<!-- pages/wallet.vue -->
<template>
  <div class="wallet-container">
    <h1>XRPL-Connect Demo</h1>

    <ClientOnly>
      <xrpl-wallet-connector ref="connectorRef" primary-wallet="xaman" />
    </ClientOnly>

    <div v-if="$wallet.error" class="error">
      {{ getErrorMessage($wallet.error) }}
    </div>

    <div v-if="$wallet.account" class="account-info">
      <h2>Connected Account</h2>
      <p><strong>Address:</strong> {{ shortAddress }}</p>
      <p><strong>Network:</strong> {{ $wallet.account.network.name }}</p>
      <button @click="handleDisconnect">Disconnect</button>
    </div>

    <form v-if="$wallet.connected" @submit.prevent="handlePayment" class="payment-form">
      <h2>Send Payment</h2>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Sending...' : 'Send 1 XRP' }}
      </button>
      <p v-if="paymentResult" class="success">Success! Hash: {{ paymentResult.hash }}</p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const { $wallet } = useNuxtApp();
const connectorRef = ref<HTMLElement | null>(null);
const loading = ref(false);
const paymentResult = ref<any>(null);

onMounted(() => {
  if (connectorRef.value && $wallet.manager) {
    connectorRef.value.setWalletManager($wallet.manager);
  }
});

const shortAddress = computed(() => {
  if (!$wallet.account) return null;
  const addr = $wallet.account.address;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
});

const handleDisconnect = async () => {
  if ($wallet.manager) {
    await $wallet.manager.disconnect();
  }
};

const handlePayment = async () => {
  if (!$wallet.manager?.connected) return;

  loading.value = true;

  try {
    const result = await $wallet.manager.signAndSubmit({
      TransactionType: 'Payment',
      Account: $wallet.account.address,
      Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
      Amount: '1000000',
    });

    paymentResult.value = result;
  } catch (error) {
    console.error('Payment failed:', error);
  } finally {
    loading.value = false;
  }
};

const getErrorMessage = (error: any) => {
  if (error.code === 'WALLET_NOT_FOUND') {
    return 'Please install a wallet to continue';
  }
  return error.message;
};
</script>

<style scoped>
.wallet-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.error {
  padding: 10px;
  background: #fee;
  color: #c00;
  border-radius: 4px;
  margin: 20px 0;
}

.account-info {
  margin: 20px 0;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.payment-form {
  margin: 20px 0;
  padding: 15px;
  background: #e8f4f8;
  border-radius: 8px;
}

.success {
  color: green;
  word-break: break-all;
}
</style>
```
