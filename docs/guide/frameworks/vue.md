---
description: Integrate XRPL-Connect into your Vue 3 application using the Composition API.
---

# Vue 3

Integrate XRPL-Connect into your Vue 3 application with the Composition API.

## Installation

```bash
npm install xrpl-connect xrpl
```

## Basic Setup

Here's a minimal Vue component using XRPL-Connect:

```vue
<template>
  <div>
    <xrpl-wallet-connector ref="connectorRef" primary-wallet="xaman" />

    <div v-if="error" style="color: red; margin-top: 20px">Error: {{ error }}</div>

    <div
      v-if="account"
      style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px"
    >
      <h3>Connected Account</h3>
      <p><strong>Address:</strong> {{ account.address }}</p>
      <p><strong>Network:</strong> {{ account.network.name }}</p>
      <button @click="handleDisconnect">Disconnect</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { WalletManager, XamanAdapter, CrossmarkAdapter } from 'xrpl-connect';

const connectorRef = ref(null);
const walletManager = ref(null);
const account = ref(null);
const error = ref(null);

onMounted(() => {
  // Initialize WalletManager
  const manager = new WalletManager({
    adapters: [new XamanAdapter({ apiKey: 'YOUR_API_KEY' }), new CrossmarkAdapter()],
    network: 'testnet',
    autoConnect: true,
  });

  // Set up event listeners
  manager.on('connect', (acc) => {
    account.value = acc;
    error.value = null;
  });

  manager.on('disconnect', () => {
    account.value = null;
  });

  manager.on('error', (err) => {
    error.value = err.message;
  });

  walletManager.value = manager;

  // Connect component to manager
  if (connectorRef.value) {
    connectorRef.value.setWalletManager(manager);
  }
});

const handleDisconnect = async () => {
  if (walletManager.value) {
    await walletManager.value.disconnect();
  }
};
</script>
```

## Creating a Composable

For better reusability, create a composable:

```typescript
// composables/useWallet.ts
import { ref, onMounted } from 'vue';
import type { WalletManager, Account, WalletError } from 'xrpl-connect';

interface UseWalletOptions {
  adapters: any[];
  network?: 'mainnet' | 'testnet' | 'devnet';
}

export function useWallet(options: UseWalletOptions) {
  const { adapters, network = 'testnet' } = options;

  const walletManager = ref<WalletManager | null>(null);
  const account = ref<Account | null>(null);
  const connected = ref(false);
  const error = ref<WalletError | null>(null);
  const loading = ref(true);
  const connectorRef = ref<HTMLElement | null>(null);

  onMounted(() => {
    const { WalletManager } = require('xrpl-connect');

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
}
```

Usage:

```vue
<template>
  <div>
    <xrpl-wallet-connector ref="connectorRef" />
    <button v-if="connected" @click="disconnect">Disconnect</button>
  </div>
</template>

<script setup>
import { useWallet } from '@/composables/useWallet';
import { XamanAdapter } from 'xrpl-connect';

const { connectorRef, connected, disconnect } = useWallet({
  adapters: [new XamanAdapter({ apiKey: 'YOUR_API_KEY' })],
});
</script>
```

## Signing Transactions

Sign transactions in Vue:

```vue
<template>
  <form @submit.prevent="handleSubmit">
    <button type="submit" :disabled="loading || !connected">
      {{ loading ? 'Sending...' : 'Send Payment' }}
    </button>
    <p v-if="error" style="color: red">{{ error }}</p>
    <p v-if="result" style="color: green">Success! Hash: {{ result.hash }}</p>
  </form>
</template>

<script setup>
import { ref } from 'vue';
import { useWallet } from '@/composables/useWallet';

const { walletManager, connected } = useWallet({
  adapters: [
    /* your adapters */
  ],
});

const loading = ref(false);
const error = ref(null);
const result = ref(null);

const handleSubmit = async () => {
  if (!walletManager.value?.connected) {
    error.value = 'Wallet not connected';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const txResult = await walletManager.value.signAndSubmit({
      TransactionType: 'Payment',
      Account: walletManager.value.account.address,
      Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
      Amount: '1000000',
    });

    result.value = txResult;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};
</script>
```

## Provide/Inject Pattern

For larger apps, use Provide/Inject to share wallet state:

```typescript
// composables/useWalletState.ts
import { provide, inject, ref, onMounted } from 'vue';
import type { WalletManager, Account } from 'xrpl-connect';

const WalletSymbol = Symbol('wallet');

export function provideWallet(adapters: any[], network = 'testnet') {
  const { WalletManager } = require('xrpl-connect');

  const walletManager = ref<WalletManager | null>(null);
  const account = ref<Account | null>(null);
  const connected = ref(false);

  onMounted(() => {
    const manager = new WalletManager({
      adapters,
      network,
      autoConnect: true,
    });

    manager.on('connect', (acc: Account) => {
      account.value = acc;
      connected.value = true;
    });

    manager.on('disconnect', () => {
      account.value = null;
      connected.value = false;
    });

    walletManager.value = manager;
  });

  provide(WalletSymbol, {
    walletManager,
    account,
    connected,
  });

  return { walletManager, account, connected };
}

export function useProvidedWallet() {
  return inject<{
    walletManager: any;
    account: any;
    connected: any;
  }>(WalletSymbol)!;
}
```

Usage in App.vue:

```vue
<script setup>
import { provideWallet } from '@/composables/useWalletState';
import { XamanAdapter } from 'xrpl-connect';

provideWallet([new XamanAdapter({ apiKey: 'YOUR_API_KEY' })]);
</script>

<template>
  <RouterView />
</template>
```

Then use in any child component:

```vue
<script setup>
import { useProvidedWallet } from '@/composables/useWalletState';

const { account, connected } = useProvidedWallet();
</script>

<template>
  <div v-if="connected">Connected: {{ account?.address }}</div>
</template>
```

## Signing Messages

Sign messages with Vue:

```vue
<template>
  <form @submit.prevent="handleSignMessage">
    <input v-model="message" placeholder="Message to sign" />
    <button type="submit">Sign Message</button>
    <p v-if="signature" style="word-break: break-all">Signature: {{ signature }}</p>
  </form>
</template>

<script setup>
import { ref } from 'vue';
import { useWallet } from '@/composables/useWallet';

const { walletManager, connected } = useWallet({
  adapters: [
    /* your adapters */
  ],
});

const message = ref('');
const signature = ref('');

const handleSignMessage = async () => {
  if (!walletManager.value?.connected) return;

  try {
    const result = await walletManager.value.signMessage(message.value);
    signature.value = result.signature;
  } catch (error) {
    console.error('Sign failed:', error);
  }
};
</script>
```

## Reactive Watchers

Monitor wallet state changes:

```vue
<script setup>
import { watch } from 'vue';
import { useWallet } from '@/composables/useWallet';

const { account, connected, error } = useWallet({
  adapters: [
    /* your adapters */
  ],
});

// Watch for connection changes
watch(connected, (newValue) => {
  if (newValue) {
    console.log('Wallet connected:', account.value?.address);
  } else {
    console.log('Wallet disconnected');
  }
});

// Watch for errors
watch(error, (newError) => {
  if (newError) {
    console.error('Wallet error:', newError.message);
  }
});
</script>
```

## Error Handling

Handle errors gracefully:

```vue
<template>
  <div v-if="error" class="error-alert">
    {{ getErrorMessage(error) }}
  </div>
</template>

<script setup>
import { useWallet } from '@/composables/useWallet';

const { error } = useWallet({
  adapters: [/* your adapters */],
});

const getErrorMessage = (err: any) => {
  if (err.code === 'WALLET_NOT_FOUND') {
    return 'Please install a wallet to continue';
  } else if (err.code === 'CONNECTION_FAILED') {
    return 'Failed to connect. Please try again.';
  } else if (err.code === 'SIGN_FAILED') {
    return 'You rejected the transaction';
  }
  return err.message;
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

## Computed Properties

Use computed for derived state:

```vue
<script setup>
import { computed } from 'vue';
import { useWallet } from '@/composables/useWallet';

const { account, walletManager } = useWallet({
  adapters: [
    /* your adapters */
  ],
});

const shortAddress = computed(() => {
  if (!account.value) return null;
  const addr = account.value.address;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
});

const networkColor = computed(() => {
  const network = account.value?.network.name;
  if (network === 'mainnet') return 'green';
  if (network === 'testnet') return 'orange';
  return 'gray';
});
</script>

<template>
  <div v-if="account">
    <p>{{ shortAddress }}</p>
    <p :style="{ color: networkColor }">{{ account.network.name }}</p>
  </div>
</template>
```

## Best Practices

1. **Use Composables** - Extract wallet logic into reusable composables

2. **Type Safety** - Use TypeScript for better type checking

3. **Lazy Loading** - Load adapters only when needed

4. **Error Boundaries** - Use error boundaries for wallet components

5. **Memory Management** - Clean up listeners on component unmount

6. **State Persistence** - Leverage XRPL-Connect's built-in persistence

7. **Computed for Derived State** - Use computed properties instead of methods

8. **Watch for Side Effects** - Use watch to react to state changes

## Testing

Example test using Vitest:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { useWallet } from '@/composables/useWallet';

describe('useWallet', () => {
  it('should initialize wallet manager', () => {
    const { walletManager, loading } = useWallet({
      adapters: [],
    });

    expect(walletManager.value).toBeDefined();
  });

  it('should handle connection events', async () => {
    const mockAdapter = {
      connect: vi.fn(),
    };

    const { account, connected } = useWallet({
      adapters: [mockAdapter],
    });

    // Test account updates...
    expect(account.value).toBeNull();
  });
});
```
