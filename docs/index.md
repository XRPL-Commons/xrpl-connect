---
description: A framework-agnostic wallet connection toolkit for the XRP Ledger with support for multiple wallet adapters and comprehensive documentation.
---

# Introduction to XRPL-Connect

XRPL-Connect is a comprehensive, framework-agnostic wallet connection toolkit for the XRP Ledger. It provides developers with everything needed to add secure wallet connectivity to their applications through a modern, modular architecture.

## What is XRPL-Connect?

XRPL-Connect is a complete solution for integrating wallet functionality into web applications built on the XRP Ledger. It includes:

- **Web Component UI** - Beautiful, customizable `<xrpl-wallet-connector>` component for wallet selection and account management
- **Wallet Manager** - Central event-driven system for managing wallet connections and transactions
- **Multiple Wallet Support** - Built-in adapters for Xaman, Crossmark, GemWallet, and WalletConnect
- **Framework Agnostic** - Works seamlessly with Vanilla JS, React, Vue, Next.js, Nuxt, and any modern web framework
- **TypeScript Ready** - Full type definitions for a great developer experience
- **Production Ready** - Used in production applications across the XRPL ecosystem

## Why Use XRPL-Connect?

Building wallet connectivity from scratch is complex. XRPL-Connect abstracts away the complexity of:

- **Multi-wallet support** - Manage multiple wallet adapters with a single API
- **Connection state** - Automatic session persistence and reconnection
- **Event handling** - Reactive architecture for responding to wallet changes
- **Error handling** - Comprehensive error codes and recovery strategies
- **UX/UI** - Beautiful, accessible components out of the box
- **Transaction signing** - Unified API for signing and submitting transactions

## Key Features

### 🎨 Fully Customizable
Customize colors, fonts, and styling using CSS variables without touching HTML or JavaScript. Create themes that match your brand perfectly.

### 🔌 Multiple Wallets
Support for all major XRP Ledger wallets including Xaman, Crossmark, GemWallet, and WalletConnect. Give users choice without increasing complexity.

### ⚡ Framework Agnostic
Works with any JavaScript framework or vanilla JavaScript. Use the same wallet manager across your entire tech stack.

### 🔒 Secure by Design
- No private key handling - all signing happens in the wallet
- Automatic session management
- Built-in error recovery

### 📱 Mobile Ready
Support for mobile wallets through WalletConnect. Works seamlessly on desktop and mobile browsers.

### 🎯 Developer Friendly
- Simple, intuitive API
- Comprehensive documentation
- TypeScript support
- Extensive examples

## Architecture Overview

XRPL-Connect uses a modular, adapter-based architecture that separates concerns and makes it easy to extend:

```
Your Application
       ↓
┌─────────────────────────────┐
│   xrpl-connect/core        │
│   ┌───────────────────────┐ │
│   │  WalletManager        │ │
│   │  - Event system       │ │
│   │  - State management   │ │
│   │  - Storage layer      │ │
│   └───────────────────────┘ │
└──────────────┬──────────────┘
               ↓
    ┌──────────┴──────────┬───────────┬───────────┐
    ↓                     ↓           ↓           ↓
┌────────────┐  ┌──────────────┐  ┌────────┐  ┌────────────┐
│ Xaman      │  │ Crossmark    │  │GemWal  │  │WalletCon   │
│ Adapter    │  │ Adapter      │  │Adapter │  │Adapter     │
└────────────┘  └──────────────┘  └────────┘  └────────────┘
```

## How It Works

1. **Initialize WalletManager** - Create an instance with your desired wallet adapters
2. **Attach to Component** - Connect the WalletManager to the `<xrpl-wallet-connector>` web component
3. **Listen to Events** - Respond to connection, disconnection, and error events
4. **Sign Transactions** - Use the unified API to sign and submit transactions
5. **Handle State** - Access connection state and account information reactively

## Supported Networks

- **Mainnet** - XRP Ledger production network
- **Testnet** - XRP Ledger testing network
- **Devnet** - XRP Ledger development network

Choose the appropriate network when initializing the WalletManager.

## What's Included

The XRPL-Connect package includes:

- **Core Library** - WalletManager, event system, and state management
- **Web Component** - Beautiful UI component for wallet connection
- **Adapters** - Pre-built integrations for major wallets
- **TypeScript Definitions** - Full type safety and IDE support
- **Documentation** - Complete guides and API reference

## Next Steps

Ready to get started? Here's the recommended learning path:

1. **[Concepts](/concepts)** - Understand the key concepts (WalletManager, adapters, web components)
2. **[Try It Out](/try-it-out)** - See XRPL-Connect in action with the interactive demo
3. **[Getting Started](/guide/getting-started)** - Install and get your API keys
4. **Framework Guides** - Follow the guide for your specific framework:
   - [Vanilla JS](/guide/frameworks/vanilla-js)
   - [React](/guide/frameworks/react)
   - [Vue](/guide/frameworks/vue)
   - [Next.js](/guide/frameworks/next)
   - [Nuxt](/guide/frameworks/nuxt)
5. **[Customization](/guide/customization)** - Style the component to match your design
6. **[API Reference](/guide/api-reference)** - Deep dive into the complete API

## Community & Support

- **GitHub** - [XRPL-Commons/xrpl-connect](https://github.com/XRPL-Commons/xrpl-connect)
- **Issues** - Report bugs or request features on GitHub
- **Discussions** - Ask questions and share ideas
- **XRP Ledger Community** - Join the broader XRP Ledger community

## License

MIT License - See the [LICENSE](https://github.com/XRPL-Commons/xrpl-connect/blob/main/LICENSE) file for details.
