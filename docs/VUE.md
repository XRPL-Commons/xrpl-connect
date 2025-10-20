# Vue 3 Integration Guide

This guide shows how to integrate XRPL Connect into a Vue 3 application using the Composition API.

## Table of Contents

- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Composables](#composables)
- [Plugin Pattern](#plugin-pattern)
- [Component Examples](#component-examples)
- [TypeScript Support](#typescript-support)
- [Best Practices](#best-practices)

## Installation

```bash
# Install UI package and wallet adapters
npm install @xrpl-connect/ui @xrpl-connect/adapter-xaman @xrpl-connect/adapter-crossmark

# Or with pnpm
pnpm add @xrpl-connect/ui @xrpl-connect/adapter-xaman @xrpl-connect/adapter-crossmark
```

## Basic Setup

### Method 1: Web Component (Recommended)

The easiest way to use XRPL Connect in Vue is with the web component:

**1. Create Wallet Manager:**

```typescript
// lib/walletManager.ts
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';

export const walletManager = new WalletManager({
  adapters: [
    new XamanAdapter(),
    new CrossmarkAdapter(),
  ],
  network: 'testnet',
  autoConnect: true,
});
```

**2. Configure Vue to support custom elements:**

```typescript
// main.ts
import { createApp } from 'vue';
import App from './App.vue';

const app = createApp(App);

// Tell Vue to ignore the custom element
app.config.compilerOptions.isCustomElement = (tag) => tag === 'xrpl-wallet-connector';

app.mount('#app');
```

Or with Vite:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'xrpl-wallet-connector',
        },
      },
    }),
  ],
});
```

**3. Use Web Component in Vue:**

```vue
<!-- App.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import '@xrpl-connect/ui';
import { walletManager } from './lib/walletManager';

const connectorRef = ref<any>(null);

onMounted(() => {
  // Connect UI component to wallet manager
  if (connectorRef.value) {
    connectorRef.value.setWalletManager(walletManager);
  }
});

const openConnector = () => {
  connectorRef.value?.open();
};

const disconnect = async () => {
  await walletManager.disconnect();
};
</script>

<template>
  <div>
    <h1>XRPL Wallet Demo</h1>

    <div v-if="walletManager.connected">
      <p>Connected: {{ walletManager.account?.address }}</p>
      <button @click="disconnect">Disconnect</button>
    </div>
    <button v-else @click="openConnector">Connect Wallet</button>

    <!-- Web Component -->
    <xrpl-wallet-connector
      ref="connectorRef"
      background-color="#1a202c"
      primary-wallet="xaman"
    />
  </div>
</template>
```

The web component provides a complete UI for wallet selection, QR codes, and connection states - no need to build your own UI!

## Composables

The recommended approach is to create composables for wallet functionality:

### 1. useWallet Composable

```typescript
// composables/useWallet.ts
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { walletManager } from '../lib/walletManager';
import type { AccountInfo, SignedTransaction, SignedMessage } from '@xrpl-connect/core';

export function useWallet() {
  const account = ref<AccountInfo | null>(walletManager.account);
  const connecting = ref(false);

  const connected = computed(() => !!account.value);

  const handleConnect = (acc: AccountInfo) => {
    account.value = acc;
    connecting.value = false;
  };

  const handleDisconnect = () => {
    account.value = null;
    connecting.value = false;
  };

  const handleAccountChanged = (acc: AccountInfo) => {
    account.value = acc;
  };

  onMounted(() => {
    walletManager.on('connect', handleConnect);
    walletManager.on('disconnect', handleDisconnect);
    walletManager.on('accountChanged', handleAccountChanged);
  });

  onUnmounted(() => {
    walletManager.off('connect', handleConnect);
    walletManager.off('disconnect', handleDisconnect);
    walletManager.off('accountChanged', handleAccountChanged);
  });

  const connect = async (walletId: string) => {
    connecting.value = true;
    try {
      await walletManager.connect(walletId);
    } catch (error) {
      connecting.value = false;
      throw error;
    }
  };

  const disconnect = async () => {
    await walletManager.disconnect();
  };

  const sign = async (transaction: any): Promise<SignedTransaction> => {
    return await walletManager.sign(transaction);
  };

  const signMessage = async (message: string): Promise<SignedMessage> => {
    return await walletManager.signMessage(message);
  };

  return {
    account,
    connected,
    connecting,
    connect,
    disconnect,
    sign,
    signMessage,
  };
}
```

### 2. useWalletSign Composable

```typescript
// composables/useWalletSign.ts
import { ref } from 'vue';
import { walletManager } from '../lib/walletManager';
import type { SignedTransaction } from '@xrpl-connect/core';

export function useWalletSign() {
  const isSigning = ref(false);
  const error = ref<Error | null>(null);

  const sign = async (transaction: any): Promise<SignedTransaction | null> => {
    isSigning.value = true;
    error.value = null;

    try {
      const signed = await walletManager.sign(transaction);
      return signed;
    } catch (err) {
      error.value = err as Error;
      return null;
    } finally {
      isSigning.value = false;
    }
  };

  return {
    sign,
    isSigning,
    error,
  };
}
```

### 3. useAvailableWallets Composable

```typescript
// composables/useAvailableWallets.ts
import { ref, onMounted } from 'vue';
import { walletManager } from '../lib/walletManager';
import type { WalletAdapter } from '@xrpl-connect/core';

export function useAvailableWallets() {
  const wallets = ref<WalletAdapter[]>([]);
  const loading = ref(true);

  onMounted(async () => {
    wallets.value = await walletManager.getAvailableWallets();
    loading.value = false;
  });

  return {
    wallets,
    loading,
  };
}
```

## Plugin Pattern

Create a Vue plugin for global wallet access:

### 1. Create Plugin

```typescript
// plugins/wallet.ts
import { App, inject } from 'vue';
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';

const walletManagerKey = Symbol('walletManager');

export const walletManager = new WalletManager({
  adapters: [new XamanAdapter(), new CrossmarkAdapter()],
  network: 'testnet',
  autoConnect: true,
});

export const walletPlugin = {
  install(app: App) {
    app.provide(walletManagerKey, walletManager);
    app.config.globalProperties.$wallet = walletManager;
  },
};

export function useWalletManager() {
  const manager = inject<WalletManager>(walletManagerKey);
  if (!manager) {
    throw new Error('Wallet manager not provided');
  }
  return manager;
}
```

### 2. Register Plugin

```typescript
// main.ts
import { createApp } from 'vue';
import App from './App.vue';
import { walletPlugin } from './plugins/wallet';

const app = createApp(App);

app.use(walletPlugin);

app.mount('#app');
```

### 3. Use in Components

```vue
<script setup lang="ts">
import { useWalletManager } from './plugins/wallet';

const walletManager = useWalletManager();

const connect = async () => {
  await walletManager.connect('xaman');
};
</script>
```

## Component Examples

### Wallet Selector Component

```vue
<!-- components/WalletSelector.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useWallet } from '../composables/useWallet';
import { useAvailableWallets } from '../composables/useAvailableWallets';

const { connect } = useWallet();
const { wallets, loading } = useAvailableWallets();
const selectedWallet = ref<string | null>(null);

const handleConnect = async (walletId: string) => {
  selectedWallet.value = walletId;
  try {
    await connect(walletId);
  } catch (error) {
    console.error('Connection failed:', error);
    selectedWallet.value = null;
  }
};
</script>

<template>
  <div class="wallet-selector">
    <h2>Select Wallet</h2>

    <div v-if="loading">Loading wallets...</div>

    <div v-else class="wallet-grid">
      <button
        v-for="wallet in wallets"
        :key="wallet.id"
        @click="handleConnect(wallet.id)"
        :disabled="selectedWallet === wallet.id"
        class="wallet-card"
      >
        <img v-if="wallet.icon" :src="wallet.icon" :alt="wallet.name" width="48" height="48" />
        <span>{{ wallet.name }}</span>
        <span v-if="selectedWallet === wallet.id">Connecting...</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.wallet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.wallet-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  cursor: pointer;
}

.wallet-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

### Payment Form Component

```vue
<!-- components/PaymentForm.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useWallet } from '../composables/useWallet';

const { account, sign } = useWallet();

const destination = ref('');
const amount = ref('');
const isSending = ref(false);
const txHash = ref<string | null>(null);
const error = ref<string | null>(null);

const handleSubmit = async () => {
  if (!account.value) return;

  isSending.value = true;
  txHash.value = null;
  error.value = null;

  try {
    const transaction = {
      TransactionType: 'Payment',
      Account: account.value.address,
      Destination: destination.value,
      Amount: String(parseFloat(amount.value) * 1_000_000),
    };

    const signed = await sign(transaction);
    txHash.value = signed.hash;
    destination.value = '';
    amount.value = '';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Transaction failed';
  } finally {
    isSending.value = false;
  }
};
</script>

<template>
  <form @submit.prevent="handleSubmit" class="payment-form">
    <h2>Send Payment</h2>

    <div class="form-group">
      <label for="destination">Destination Address</label>
      <input
        id="destination"
        v-model="destination"
        type="text"
        placeholder="rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT"
        required
      />
    </div>

    <div class="form-group">
      <label for="amount">Amount (XRP)</label>
      <input
        id="amount"
        v-model="amount"
        type="number"
        step="0.000001"
        placeholder="1.5"
        required
      />
    </div>

    <button type="submit" :disabled="isSending">
      {{ isSending ? 'Signing...' : 'Send Payment' }}
    </button>

    <div v-if="txHash" class="success">
      Transaction Hash: <code>{{ txHash }}</code>
    </div>

    <div v-if="error" class="error">
      {{ error }}
    </div>
  </form>
</template>

<style scoped>
.payment-form {
  max-width: 500px;
  margin: 0 auto;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.success {
  margin-top: 1rem;
  padding: 1rem;
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
}

.error {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
}
</style>
```

### Account Display Component

```vue
<!-- components/AccountDisplay.vue -->
<script setup lang="ts">
import { useWallet } from '../composables/useWallet';

const { account, connected, disconnect } = useWallet();
</script>

<template>
  <div v-if="connected && account" class="account-display">
    <div class="account-info">
      <div>
        <strong>Address:</strong>
        <code>{{ account.address }}</code>
      </div>
      <div>
        <strong>Network:</strong>
        <span>{{ account.network.name }}</span>
      </div>
    </div>
    <button @click="disconnect">Disconnect</button>
  </div>
</template>

<style scoped>
.account-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.account-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.account-info code {
  background: #e9ecef;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: monospace;
}
</style>
```

### Message Signer Component

```vue
<!-- components/MessageSigner.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useWallet } from '../composables/useWallet';

const { signMessage } = useWallet();

const message = ref('');
const signature = ref<string | null>(null);
const isSigning = ref(false);

const handleSign = async () => {
  if (!message.value) return;

  isSigning.value = true;
  try {
    const signed = await signMessage(message.value);
    signature.value = signed.signature;
  } catch (error) {
    console.error('Signing failed:', error);
  } finally {
    isSigning.value = false;
  }
};
</script>

<template>
  <div class="message-signer">
    <h2>Sign Message</h2>

    <textarea
      v-model="message"
      placeholder="Enter message to sign..."
      rows="4"
    ></textarea>

    <button @click="handleSign" :disabled="isSigning || !message">
      {{ isSigning ? 'Signing...' : 'Sign Message' }}
    </button>

    <div v-if="signature" class="signature-result">
      <strong>Signature:</strong>
      <code>{{ signature }}</code>
    </div>
  </div>
</template>

<style scoped>
.message-signer {
  max-width: 500px;
  margin: 0 auto;
}

textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.signature-result {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
  word-break: break-all;
}
</style>
```

### Wallet Button Component

```vue
<!-- components/WalletButton.vue -->
<script setup lang="ts">
import { useWallet } from '../composables/useWallet';

const { account, connected, connecting, connect, disconnect } = useWallet();

const truncateAddress = (address: string) => {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
};
</script>

<template>
  <div class="wallet-button">
    <button v-if="connected" @click="disconnect" class="disconnect-btn">
      Disconnect ({{ truncateAddress(account!.address) }})
    </button>

    <div v-else class="connect-buttons">
      <button @click="connect('xaman')" :disabled="connecting" class="connect-btn">
        {{ connecting ? 'Connecting...' : 'Connect Xaman' }}
      </button>
      <button @click="connect('crossmark')" :disabled="connecting" class="connect-btn">
        {{ connecting ? 'Connecting...' : 'Connect Crossmark' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.wallet-button {
  display: flex;
  gap: 0.5rem;
}

.connect-buttons {
  display: flex;
  gap: 0.5rem;
}

button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.connect-btn {
  background: #0ea5e9;
  color: white;
}

.connect-btn:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.disconnect-btn {
  background: #ef4444;
  color: white;
}
</style>
```

## TypeScript Support

Full TypeScript example with proper typing:

```typescript
// types/wallet.ts
import type { AccountInfo, SignedTransaction, SignedMessage } from '@xrpl-connect/core';

export interface WalletState {
  account: AccountInfo | null;
  connected: boolean;
  connecting: boolean;
}

export interface Transaction {
  TransactionType: string;
  Account: string;
  [key: string]: any;
}
```

Using with composables:

```typescript
// composables/useWallet.ts
import type { Ref, ComputedRef } from 'vue';
import type { AccountInfo, SignedTransaction, SignedMessage } from '@xrpl-connect/core';

interface UseWalletReturn {
  account: Ref<AccountInfo | null>;
  connected: ComputedRef<boolean>;
  connecting: Ref<boolean>;
  connect: (walletId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  sign: (transaction: any) => Promise<SignedTransaction>;
  signMessage: (message: string) => Promise<SignedMessage>;
}

export function useWallet(): UseWalletReturn {
  // Implementation...
}
```

## Best Practices

### 1. Use Composables for Reusability

Create composables for wallet functionality to avoid code duplication:

```typescript
// Good
const { account, connect, disconnect } = useWallet();

// Avoid
// Duplicating wallet logic in every component
```

### 2. Clean Up Event Listeners

Always use `onUnmounted` to clean up event listeners:

```typescript
onMounted(() => {
  walletManager.on('connect', handleConnect);
});

onUnmounted(() => {
  walletManager.off('connect', handleConnect);
});
```

### 3. Use Computed Properties

```typescript
const connected = computed(() => !!account.value);
const displayAddress = computed(() =>
  account.value ? truncateAddress(account.value.address) : null
);
```

### 4. Handle Loading States

```vue
<template>
  <button :disabled="isLoading">
    {{ isLoading ? 'Loading...' : 'Connect' }}
  </button>
</template>
```

### 5. Provide Type Safety

```typescript
import type { AccountInfo } from '@xrpl-connect/core';

const account = ref<AccountInfo | null>(null);
```

## Nuxt 3 Integration

For Nuxt 3 applications:

### 1. Create Plugin

```typescript
// plugins/wallet.client.ts
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';

export default defineNuxtPlugin(() => {
  const walletManager = new WalletManager({
    adapters: [new XamanAdapter(), new CrossmarkAdapter()],
    network: 'testnet',
    autoConnect: true,
  });

  return {
    provide: {
      wallet: walletManager,
    },
  };
});
```

### 2. Use in Components

```vue
<script setup lang="ts">
const { $wallet } = useNuxtApp();

const connect = async () => {
  await $wallet.connect('xaman');
};
</script>
```

## Complete Example App

```vue
<!-- App.vue -->
<script setup lang="ts">
import WalletSelector from './components/WalletSelector.vue';
import AccountDisplay from './components/AccountDisplay.vue';
import PaymentForm from './components/PaymentForm.vue';
import MessageSigner from './components/MessageSigner.vue';
import { useWallet } from './composables/useWallet';

const { connected } = useWallet();
</script>

<template>
  <div class="app">
    <header>
      <h1>XRPL Wallet Demo</h1>
      <AccountDisplay />
    </header>

    <main>
      <WalletSelector v-if="!connected" />

      <div v-else class="connected-content">
        <PaymentForm />
        <MessageSigner />
      </div>
    </main>
  </div>
</template>

<style>
.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.connected-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}
</style>
```

## Additional Resources

- [Getting Started Guide](./GETTING_STARTED.md)
- [Vanilla JS Guide](./VANILLA_JS.md)
- [React Guide](./REACT.md)
- [Vue 3 Documentation](https://vuejs.org/)
- [Composition API Guide](https://vuejs.org/guide/extras/composition-api-faq.html)
