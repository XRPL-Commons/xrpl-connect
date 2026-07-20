# XRPL Connect

> A framework-agnostic wallet connection toolkit for the XRP Ledger

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/xrpl-connect.svg)](https://www.npmjs.com/package/xrpl-connect)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)

## ✨ Features

- **Framework Agnostic** - Works with Vanilla JS, React, Vue, and any other framework
- **Multiple Wallets** - Support for Xaman, Crossmark, GemWallet, and WalletConnect
- **Modular Architecture** - Install only what you need
- **Type Safe** - Full TypeScript support with comprehensive type definitions
- **Event Driven** - Reactive architecture for connection state changes
- **Persistent Sessions** - Auto-reconnect with localStorage support
- **Developer Friendly** - Simple API, extensive documentation, great DX

## 📦 What's Included

The `xrpl-connect` package includes everything you need:

- **Core**: Wallet management, event system, and state persistence
- **UI**: Beautiful pre-built web component with QR codes and wallet selection
- **Adapters**: All XRPL wallet adapters (Xaman, Crossmark, GemWallet, WalletConnect)

## Documentation

Please read the documentation here [DOCS](https://xrpl-commons.github.io/xrpl-connect/) as it is way more detailed than the README.

## 🚀 Quick Start

### Installation

```bash
npm install xrpl-connect xrpl
```

That's it! Everything you need in one package.

### Basic Usage

The easiest way to use XRPL Connect is with the plug-and-play web component:

**HTML:**

```html
<!-- Add the web component to your HTML -->
<button id="connect-btn">Connect Wallet</button>

<xrpl-wallet-connector id="wallet-connector" background-color="#1a202c" primary-wallet="xaman">
</xrpl-wallet-connector>
```

**JavaScript:**

```javascript
import { WalletManager, XamanAdapter, CrossmarkAdapter } from 'xrpl-connect';

// Initialize wallet manager
const walletManager = new WalletManager({
  adapters: [new XamanAdapter(), new CrossmarkAdapter()],
  network: 'testnet',
  // When true, the WalletManager attempts to restore the previous session
  // from localStorage on page load (the user is not prompted again). Set to
  // false if you want users to explicitly reconnect every time.
  autoConnect: true,
});

// Connect the UI component to the wallet manager
const connector = document.getElementById('wallet-connector');
connector.setWalletManager(walletManager);

// Open the modal when button is clicked
document.getElementById('connect-btn').addEventListener('click', () => {
  connector.open();
});

// Listen to connection events
walletManager.on('connect', (account) => {
  console.log('Connected:', account.address);
});

// Always handle disconnects so your UI can reset
walletManager.on('disconnect', () => {
  console.log('Disconnected');
});

// Surface connection/adapter errors (wallet not installed, network issues, etc.)
walletManager.on('error', (error) => {
  console.error('Wallet error:', error.code, error.message);
});

// Sign transactions after connection. Always wrap in try/catch — the promise
// rejects when the user cancels the request in their wallet (SIGN_FAILED).
try {
  const signed = await walletManager.sign({
    TransactionType: 'Payment',
    Account: walletManager.account.address,
    Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
    Amount: '1000000',
  });
} catch (error) {
  if (error.code === 'SIGN_FAILED') {
    console.log('User rejected the transaction');
  } else {
    console.error('Sign failed:', error);
  }
}
```

That's it! The web component provides a beautiful, pre-built UI for wallet selection, QR codes, and connection states.

> **Heads up on `autoConnect`:** with `autoConnect: true`, the WalletManager silently restores the previous session from `localStorage` when your page loads and emits a `connect` event before any user interaction. Register your `connect` / `disconnect` / `error` listeners **immediately** after constructing the manager so you don't miss that initial event.

### Direct wallet SDK access

The meta-package also exposes the complete upstream wallet APIs under namespaces,
so applications do not need to add the transitive SDKs as direct dependencies:

```typescript
import { CrossmarkSDK, GemWalletAPI, XamanOAuth2, XamanSDK } from 'xrpl-connect';

const xaman = new XamanSDK.Xumm('YOUR_API_KEY');
const oauth = new XamanOAuth2.XummPkce('YOUR_API_KEY');
const installed = CrossmarkSDK.default.sync.isInstalled();
const address = await GemWalletAPI.getAddress();
```

## 📚 Documentation

- **[Getting Started Guide](./docs/GETTING_STARTED.md)** - Complete introduction to XRPL Connect
- **[Vanilla JS Integration](./docs/VANILLA_JS.md)** - Using XRPL Connect with vanilla JavaScript
- **[React Integration](./docs/REACT.md)** - React integration patterns and best practices
- **[Vue Integration](./docs/VUE.md)** - Vue 3 integration guide

## 🏗️ Architecture

XRPL Connect is built with a modular, adapter-based architecture:

```
┌─────────────────────────────────────────┐
│         Your Application                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      @xrpl-connect/core                 │
│  ┌─────────────────────────────────┐   │
│  │     WalletManager               │   │
│  │  - Event system                 │   │
│  │  - State management             │   │
│  │  - Storage layer                │   │
│  └─────────────────────────────────┘   │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┬─────────┬─────────┐
        │                   │         │         │
┌───────▼────────┐  ┌──────▼──────┐  │         │
│ Xaman Adapter  │  │  Crossmark  │  │   ...   │
└────────────────┘  └─────────────┘  │         │
                                     │         │
                              ┌──────▼──────┐  │
                              │ GemWallet   │  │
                              └─────────────┘  │
                                               │
                                        ┌──────▼──────┐
                                        │WalletConnect│
                                        └─────────────┘
```

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint

# Format
pnpm format

# Development mode (watch)
pnpm dev
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for development setup, branch/PR conventions, and the release process. To author a new wallet adapter specifically, see the [Adapter Integration Guide](./docs/guide/adapter-integration.md).

A summary of notable changes in each release lives in [`CHANGELOG.md`](./CHANGELOG.md).

## 📄 License

MIT License - see the [LICENSE](./LICENSE) file for details

## 🙏 Acknowledgments

Inspired by:

- [RainbowKit](https://www.rainbowkit.com/) - Ethereum wallet connection
- [ConnectKit](https://github.com/family/connectkit) - Ethereum wallet connection kit
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter) - Solana wallet standard

Built for the XRPL community with ❤️
