# Getting Started with XRPL Connect

Learn how to integrate XRPL Connect into your application.

## Installation

### Using npm

```bash
npm install xrpl-connect xrpl
```

### Using pnpm

```bash
pnpm add xrpl-connect xrpl
```

### Using yarn

```bash
yarn add xrpl-connect xrpl
```

The `xrpl-connect` package includes everything you need:

- **Core** - WalletManager, event system, and state management
- **UI** - Beautiful web component for wallet connection
- **Adapters** - Built-in support for Xaman, Crossmark, GemWallet, and WalletConnect

> **Note:** The `xrpl` package is required for transaction types and utilities.

## Core Concepts

### WalletManager

The central component that manages wallet connections, handles events, and persists state.

### Adapters

Adapters are plugins that add support for specific wallets. Each adapter implements a standard interface and handles wallet-specific communication.

### Events

XRPL Connect uses an event-driven architecture. Listen to events like `connect`, `disconnect`, and `error` to respond to changes.

### Web Component

The `<xrpl-wallet-connector>` is a custom HTML element that provides a beautiful UI for wallet selection and account management.

## Vanilla JavaScript

### Basic Setup

```html
<!DOCTYPE html>
<html>
<head>
  <title>XRPL Connect Example</title>
</head>
<body>
  <xrpl-wallet-connector id="wallet-connector"></xrpl-wallet-connector>
  <script type="module">
    import { WalletManager } from 'xrpl-connect';
    import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

    const walletManager = new WalletManager({
      adapters: [new XamanAdapter({ apiKey: 'YOUR_API_KEY' })],
      network: 'testnet',
      autoConnect: true,
    });

    const connector = document.getElementById('wallet-connector');
    connector.setWalletManager(walletManager);
  </script>
</body>
</html>
```

### Handling Connection Events

```javascript
walletManager.on('connect', (account) => {
  console.log('Connected to:', account.address);
  console.log('Network:', account.network.name);
});

walletManager.on('disconnect', () => {
  console.log('Disconnected');
});

walletManager.on('error', (error) => {
  console.error('Connection error:', error.message);
});
```

### Signing Transactions

```javascript
try {
  const result = await walletManager.signAndSubmit({
    TransactionType: 'Payment',
    Account: walletManager.account.address,
    Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
    Amount: '1000000',
  });

  console.log('Transaction hash:', result.hash);
} catch (error) {
  console.error('Failed to sign transaction:', error.message);
}
```

## React Integration

### Setup

```jsx
import { useEffect, useRef, useState } from 'react';
import { WalletManager } from 'xrpl-connect';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

function WalletConnect() {
  const connectorRef = useRef(null);
  const [account, setAccount] = useState(null);
  const [walletManager, setWalletManager] = useState(null);

  useEffect(() => {
    const manager = new WalletManager({
      adapters: [new XamanAdapter({ apiKey: 'YOUR_API_KEY' })],
      network: 'testnet',
      autoConnect: true,
    });

    manager.on('connect', (acc) => setAccount(acc));
    manager.on('disconnect', () => setAccount(null));

    setWalletManager(manager);

    if (connectorRef.current) {
      connectorRef.current.setWalletManager(manager);
    }
  }, []);

  return (
    <>
      <xrpl-wallet-connector
        ref={connectorRef}
        primary-wallet="xaman"
      />
      {account && <p>Connected: {account.address}</p>}
    </>
  );
}

export default WalletConnect;
```

## Vue 3 Integration

### Composition API Setup

```vue
<script setup>
import { ref, onMounted } from 'vue';
import { WalletManager } from 'xrpl-connect';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

const connectorRef = ref(null);
const account = ref(null);
let walletManager;

onMounted(() => {
  walletManager = new WalletManager({
    adapters: [new XamanAdapter({ apiKey: 'YOUR_API_KEY' })],
    network: 'testnet',
    autoConnect: true,
  });

  walletManager.on('connect', (acc) => {
    account.value = acc;
  });

  walletManager.on('disconnect', () => {
    account.value = null;
  });

  connectorRef.value?.setWalletManager(walletManager);
});
</script>

<template>
  <div>
    <xrpl-wallet-connector
      ref="connectorRef"
      primary-wallet="xaman"
    />
    <p v-if="account">Connected: {{ account.address }}</p>
  </div>
</template>
```

## Wallet Operations

### Signing Transactions

```javascript
const result = await walletManager.signAndSubmit({
  TransactionType: 'Payment',
  Account: walletManager.account.address,
  Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
  Amount: '1000000',
});

console.log('Transaction submitted:', result.hash);
```

### Signing Messages

```javascript
const signed = await walletManager.signMessage('Hello XRPL');

console.log('Message signature:', signed.signature);
console.log('Signed message:', signed.message);
```

### Checking Connection Status

```javascript
if (walletManager.connected) {
  console.log('Wallet address:', walletManager.account.address);
  console.log('Network:', walletManager.account.network.name);
  console.log('Wallet:', walletManager.wallet.name);
} else {
  console.log('No wallet connected');
}
```

### Disconnecting

```javascript
await walletManager.disconnect();
```

## Error Handling

### Listening to Errors

```javascript
walletManager.on('error', (error) => {
  console.error('Error code:', error.code);
  console.error('Error message:', error.message);
  console.error('Error details:', error.details);
});
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `WALLET_NOT_FOUND` | Wallet is not installed or available |
| `CONNECTION_FAILED` | Failed to establish connection |
| `SIGN_FAILED` | Failed to sign transaction or message |
| `NETWORK_ERROR` | Network communication failed |

### Try-Catch Pattern

```javascript
try {
  const result = await walletManager.signAndSubmit(transaction);
  console.log('Success:', result);
} catch (error) {
  if (error.code === 'SIGN_FAILED') {
    console.error('User rejected the transaction');
  } else if (error.code === 'NETWORK_ERROR') {
    console.error('Network problem:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Best Practices

1. **Initialize Once** - Create the WalletManager instance once, typically in your application's root or initialization code.

2. **Use Event Listeners** - Listen to `connect`, `disconnect`, and `error` events to keep your UI in sync with the wallet state.

3. **Handle Errors Gracefully** - Always use try-catch blocks or error event listeners to handle failed transactions.

4. **Persist State** - XRPL Connect automatically persists wallet sessions in localStorage. Users will reconnect automatically on page reload.

5. **Use Multiple Adapters** - Include multiple wallet adapters to give users choice. Always include at least Xaman and Crossmark.

6. **Validate Transactions** - Before signing, ensure transaction parameters are correct.

7. **Use TypeScript** - XRPL Connect provides comprehensive type definitions.

8. **Test with Multiple Wallets** - Test your application with different wallet adapters.
