---
description: Install XRPL-Connect, get your API keys, and set up basic wallet connections in minutes.
---

# Getting Started

Get up and running with XRPL-Connect in minutes.

## Installation

### Using npm

```bash
npm install xrpl-connect@rc xrpl
```

Add the official bindings for your framework:

```bash
# React
npm install @xrpl-commons/xrpl-connect-react@rc react react-dom

# Vue 3 or Nuxt
npm install @xrpl-commons/xrpl-connect-vue@rc vue
```

### Using pnpm

```bash
pnpm add xrpl-connect@rc xrpl
```

### Using yarn

```bash
yarn add xrpl-connect@rc xrpl
```

The `xrpl-connect` package includes:

- **Core** - WalletManager, event system, and state management
- **UI** - Beautiful web component for wallet connection
- **Adapters** - Built-in support for Xaman, Crossmark, GemWallet, WalletConnect, Ledger, Xyra, Otsu, and MetaMask Snap
- **Framework bindings** - Official packages for React and Vue 3 / Nuxt

> **Note:** The `xrpl` package is required for transaction types and utilities.

## Get Your API Keys

To use XRPL-Connect, you'll need API keys for the wallet adapters you plan to use.

### Xaman API Key

Xaman is the most popular XRPL wallet. Get your API key here:

1. Go to [https://apps.xumm.dev/](https://apps.xumm.dev/)
2. Sign in with your Xaman account
3. Create a new application
4. Copy your `API Key`
5. Use it when creating the XamanAdapter

```javascript
const adapter = new XamanAdapter({
  apiKey: 'YOUR_API_KEY',
});
```

### WalletConnect Project ID

If you want to support mobile wallets via WalletConnect:

1. Go to [https://cloud.walletconnect.com/](https://cloud.walletconnect.com/)
2. Create a new project
3. Copy your `Project ID`
4. Use it when creating the WalletConnectAdapter

```javascript
const adapter = new WalletConnectAdapter({
  projectId: 'YOUR_PROJECT_ID',
});
```

### Other Adapters

Crossmark, GemWallet, Xyra, Otsu, and Ledger don't require API keys - they work directly with browser extensions, wallets, or hardware devices:

```javascript
const crossmarkAdapter = new CrossmarkAdapter();
const gemWalletAdapter = new GemWalletAdapter();
const xyraAdapter = new XyraAdapter();
const otsuAdapter = new OtsuAdapter();
const metaMaskAdapter = new MetaMaskSnapAdapter();
```

### Ledger Hardware Wallet

For Ledger hardware wallet support, no API keys are required. The adapter communicates directly with the device:

```javascript
import { LedgerAdapter } from 'xrpl-connect';

const ledgerAdapter = new LedgerAdapter({
  // Optional: customize derivation path (default: "44'/144'/0'/0/0")
  derivationPath: "44'/144'/0'/0/0",

  // Optional: timeout for operations in ms (default: 60000)
  timeout: 60000,

  // Optional: prefer WebHID over WebUSB (default: true)
  preferWebHID: true,
});
```

**Requirements for Ledger:**

- Supported browsers: Chrome, Edge, or Opera (WebHID/WebUSB support required)
- HTTPS connection (localhost is OK for development)
- User must unlock device and open the XRP app
- Close Ledger Live if it's running (conflicts with WebHID/WebUSB)

For more details on Ledger integration, see the [Ledger adapter documentation](https://github.com/XRPL-Commons/xrpl-connect/tree/main/packages/adapters/ledger).

## Quick Start

A minimal, copy-pasteable example covering the patterns you almost always need: wiring the UI component, listening to `connect` / `disconnect` / `error`, and signing a transaction with proper user-rejection handling.

```html
<button id="connect-btn">Connect Wallet</button>
<xrpl-wallet-connector id="wallet-connector"></xrpl-wallet-connector>
```

```javascript
import {
  CrossmarkAdapter,
  WalletErrorCode,
  WalletManager,
  XamanAdapter,
  isWalletError,
} from 'xrpl-connect';

const walletManager = new WalletManager({
  adapters: [new XamanAdapter({ apiKey: 'YOUR_API_KEY' }), new CrossmarkAdapter()],
  network: 'testnet',
  autoConnect: true,
});

const connector = document.getElementById('wallet-connector');
connector.setWalletManager(walletManager);

document.getElementById('connect-btn').addEventListener('click', () => {
  connector.open();
});

walletManager.on('connect', (account) => {
  console.log('Connected:', account.address);
});

// Reset your UI when the user (or an autoConnect failure) disconnects.
walletManager.on('disconnect', () => {
  console.log('Disconnected');
});

// Surfaces adapter/connection errors (wallet missing, network issues, etc.).
walletManager.on('error', (error) => {
  console.error('Wallet error:', error.code, error.message);
});

// `sign` rejects when the user cancels in their wallet — always wrap it.
async function sendPayment() {
  try {
    const signed = await walletManager.sign({
      TransactionType: 'Payment',
      Account: walletManager.account.address,
      Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
      Amount: '1000000',
    });
    console.log('Signed:', signed);
  } catch (error) {
    if (isWalletError(error) && error.code === WalletErrorCode.SIGN_REJECTED) {
      // User rejected the prompt in their wallet — usually a no-op.
      console.log('User rejected the transaction');
    } else {
      console.error('Sign failed:', error);
    }
  }
}
```

### About `autoConnect`

`autoConnect: true` tells the WalletManager to silently restore the user's previous session from `localStorage` when the page loads. If the previous adapter is still available and the stored session is valid, you'll receive a `connect` event **before** any user interaction; otherwise the manager stays disconnected (and may emit `error` if the adapter explicitly fails).

Two practical consequences:

- **Register listeners first.** Add `on('connect')`, `on('disconnect')`, and `on('error')` immediately after constructing the manager, otherwise the initial reconnect event will fire before your UI is listening.
- **Set it to `false`** if your app needs the user to explicitly choose a wallet on every visit (e.g., shared kiosks, strict privacy requirements).

## Framework-Specific Guides

Once you've installed the package and have your API keys, follow the guide for your framework:

### Web Frameworks

- **[Vanilla JavaScript](/guide/frameworks/vanilla-js)** - Pure JavaScript, no framework
- **[React](/guide/frameworks/react)** - Complete React integration guide
- **[Vue 3](/guide/frameworks/vue)** - Vue 3 Composition API guide
- **[Nuxt](/guide/frameworks/nuxt)** - Nuxt 3 and Nitro integration

Each guide includes:

- Basic setup and initialization
- Connecting the wallet manager to the UI component
- Handling wallet events
- Signing transactions
- Best practices for your framework

## What's Next?

- **[Concepts](/concepts)** - Understand WalletManager, adapters, and web components
- **[Try It Out](/try-it-out)** - See the wallet connector in action
- **[Customization](/guide/customization)** - Style the component with CSS variables
- **[API Reference](/guide/api-reference)** - Complete API documentation
