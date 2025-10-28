# XRPL-Connect

A framework-agnostic wallet connection toolkit for the XRP Ledger

## Features

- **Framework Agnostic** - Works seamlessly with Vanilla JS, React, Vue, and any other framework
- **Multiple Wallets** - Support for Xaman, Crossmark, GemWallet, and WalletConnect
- **Modular Architecture** - Install only what you need
- **Type Safe** - Full TypeScript support with comprehensive type definitions
- **Event Driven** - Reactive architecture for connection state changes
- **Persistent Sessions** - Auto-reconnect with localStorage support
- **Developer Friendly** - Simple API, extensive documentation, great DX

## Quick Start

### Installation

```bash
npm install xrpl-connect xrpl
```

### Basic Usage

```html
<xrpl-wallet-connector id="wallet-connector"></xrpl-wallet-connector>
```

```javascript
import { WalletManager } from 'xrpl-connect';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

const walletManager = new WalletManager({
  adapters: [new XamanAdapter({ apiKey: 'YOUR_API_KEY' })],
  network: 'testnet',
  autoConnect: true,
});

const connector = document.getElementById('wallet-connector');
connector.setWalletManager(walletManager);

walletManager.on('connect', (account) => {
  console.log('Connected:', account.address);
});

const signed = await walletManager.signAndSubmit({
  TransactionType: 'Payment',
  Account: walletManager.account.address,
  Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
  Amount: '1000000',
});
```

## What's Included

The complete XRPL-Connect package includes:

- **Core** (`@xrpl-connect/core`) - Wallet management, event system, state persistence
- **UI** (`@xrpl-connect/ui`) - Beautiful web component with wallet selection and account modal
- **Adapters** - Built-in support for multiple wallets

## Documentation

- [Getting Started](/guide/getting-started) - Complete introduction to XRPL-Connect
- [API Reference](/guide/api-reference) - Full API documentation
- [Customization](/guide/customization) - CSS variables customization guide
- [Examples](/guide/examples) - Real-world examples and theme showcases

## Architecture

XRPL-Connect uses a modular, adapter-based architecture:

```
Your Application
        ↓
┌─────────────────────────────┐
│   @xrpl-connect/core        │
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

Each wallet is represented by an adapter that implements a standard interface, making it easy to add new wallets or create custom adapters.

## Contributing

Contributions are welcome! We're looking for help with:

- New wallet adapters
- Framework-specific integrations
- Documentation improvements
- Bug fixes and feature requests
- Testing and quality assurance

See our [Contributing Guide](https://github.com/XRPL-Commons/xrpl-connect/blob/main/CONTRIBUTING.md) for details.

## License

MIT License - see the [LICENSE](https://github.com/XRPL-Commons/xrpl-connect/blob/main/LICENSE) file for details.

## Acknowledgments

Inspired by:
- [RainbowKit](https://www.rainbowkit.com/) - Ethereum wallet connection
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter) - Solana wallet standard

Built for the XRPL community
