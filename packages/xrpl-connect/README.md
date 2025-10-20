# XRPL Connect

> The easiest way to connect XRPL wallets to your app

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/xrpl-connect.svg)](https://www.npmjs.com/package/xrpl-connect)

## ✨ Features

- **🔌 Plug & Play** - Beautiful pre-built UI with zero configuration
- **🎨 Framework Agnostic** - Works with Vanilla JS, React, Vue, or any framework
- **💼 Multiple Wallets** - Xaman, Crossmark, GemWallet, and WalletConnect
- **📱 Mobile Ready** - QR codes for mobile wallet connections
- **🎯 Type Safe** - Full TypeScript support
- **⚡ Zero Config** - Sensible defaults that just work

## 🚀 Quick Start

### Installation

```bash
npm install xrpl-connect xrpl
```

### Usage

**1. Add the web component to your HTML:**

```html
<button id="connect-btn">Connect Wallet</button>

<xrpl-wallet-connector
  id="wallet-connector"
  background-color="#1a202c"
  primary-wallet="xaman">
</xrpl-wallet-connector>
```

**2. Initialize in JavaScript:**

```javascript
import { WalletManager, XamanAdapter, CrossmarkAdapter } from 'xrpl-connect';

// Create wallet manager with adapters
const walletManager = new WalletManager({
  adapters: [
    new XamanAdapter(),
    new CrossmarkAdapter(),
  ],
  network: 'testnet',
  autoConnect: true,
});

// Connect UI to wallet manager
const connector = document.getElementById('wallet-connector');
connector.setWalletManager(walletManager);

// Open modal on button click
document.getElementById('connect-btn').addEventListener('click', () => {
  connector.open();
});

// Listen to connection events
walletManager.on('connect', (account) => {
  console.log('Connected:', account.address);
});

// Sign transactions
const signed = await walletManager.sign({
  TransactionType: 'Payment',
  Account: walletManager.account.address,
  Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
  Amount: '1000000',
});
```

That's it! The web component provides everything: wallet selection, QR codes, loading states, and error handling.

## 📖 Alternative Usage Patterns

### Using the Adapters Object

```javascript
import { WalletManager, Adapters } from 'xrpl-connect';

const walletManager = new WalletManager({
  adapters: [
    new Adapters.Xaman(),
    new Adapters.Crossmark(),
    new Adapters.GemWallet(),
    new Adapters.WalletConnect({ projectId: 'your-project-id' }),
  ],
  network: 'mainnet',
});
```

### React Example

```tsx
import { useEffect, useRef } from 'react';
import { WalletManager, XamanAdapter } from 'xrpl-connect';

function App() {
  const connectorRef = useRef(null);
  const walletManager = new WalletManager({
    adapters: [new XamanAdapter()],
    network: 'testnet',
  });

  useEffect(() => {
    connectorRef.current?.setWalletManager(walletManager);
  }, []);

  return (
    <>
      <button onClick={() => connectorRef.current?.open()}>
        Connect Wallet
      </button>
      <xrpl-wallet-connector ref={connectorRef} />
    </>
  );
}
```

### Vue Example

```vue
<script setup>
import { ref, onMounted } from 'vue';
import { WalletManager, XamanAdapter } from 'xrpl-connect';

const connectorRef = ref(null);
const walletManager = new WalletManager({
  adapters: [new XamanAdapter()],
  network: 'testnet',
});

onMounted(() => {
  connectorRef.value?.setWalletManager(walletManager);
});
</script>

<template>
  <button @click="connectorRef?.open()">Connect Wallet</button>
  <xrpl-wallet-connector ref="connectorRef" />
</template>
```

## 🎨 Customization

Customize the UI with attributes:

```html
<xrpl-wallet-connector
  background-color="#1a202c"
  text-color="#F5F4E7"
  primary-color="#0ea5e9"
  primary-wallet="xaman"
  font-family="'Inter', sans-serif">
</xrpl-wallet-connector>
```

## 📚 What's Included?

This package includes everything you need:

- **Core**: `@xrpl-connect/core` - Wallet management and event system
- **UI**: `@xrpl-connect/ui` - Pre-built web component
- **Adapters**:
  - `@xrpl-connect/adapter-xaman` - Xaman (formerly Xumm) wallet
  - `@xrpl-connect/adapter-crossmark` - Crossmark browser extension
  - `@xrpl-connect/adapter-gemwallet` - GemWallet browser extension
  - `@xrpl-connect/adapter-walletconnect` - WalletConnect protocol

## 📦 Modular Packages

If you prefer to install only what you need for a smaller bundle size, individual packages are available:

```bash
npm install @xrpl-connect/ui @xrpl-connect/adapter-xaman
```

See the [documentation](https://github.com/your-org/xrpl-connect) for more details.

## 🔗 Links

- [Documentation](https://github.com/your-org/xrpl-connect)
- [GitHub](https://github.com/your-org/xrpl-connect)
- [Examples](https://github.com/your-org/xrpl-connect/tree/main/examples)

## 📄 License

MIT
