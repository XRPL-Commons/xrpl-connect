---
description: Install XRPL-Connect, get your API keys, and set up basic wallet connections in minutes.
---

# Getting Started

Get up and running with XRPL-Connect in minutes.

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

The `xrpl-connect` package includes:

- **Core** - WalletManager, event system, and state management
- **UI** - Beautiful web component for wallet connection
- **Adapters** - Built-in support for Xaman, Crossmark, GemWallet, and WalletConnect

> **Note:** The `xrpl` package is required for transaction types and utilities.

## Get Your API Keys

To use XRPL-Connect, you'll need API keys for the wallet adapters you plan to use.

### Xaman API Key

Xaman is the most popular XRPL wallet. Get your API key here:

1. Go to [https://apps.xumm.dev/](https://apps.xumm.dev/)
2. Sign in with your Xaman account
3. Create a new application
4. Copy your `API Key` and optionally your `API Secret`
5. Use these when creating the XamanAdapter

```javascript
const adapter = new XamanAdapter({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',  // optional
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

Crossmark and GemWallet don't require API keys - they work directly with browser extensions or wallets:

```javascript
const crossmarkAdapter = new CrossmarkAdapter();
const gemWalletAdapter = new GemWalletAdapter();
```

## Framework-Specific Guides

Once you've installed the package and have your API keys, follow the guide for your framework:

### Web Frameworks

- **[Vanilla JavaScript](/guide/frameworks/vanilla-js)** - Pure JavaScript, no framework
- **[React](/guide/frameworks/react)** - Complete React integration guide
- **[Vue 3](/guide/frameworks/vue)** - Vue 3 Composition API guide
- **[Next.js](/guide/frameworks/next)** - Next.js app router and SSR
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
