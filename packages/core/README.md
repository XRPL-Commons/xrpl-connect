# @xrpl-connect/core

Framework-agnostic core SDK for connecting to and managing XRPL wallets.

## Installation

```bash
npm install @xrpl-connect/core xrpl
# or
pnpm add @xrpl-connect/core xrpl
# or
yarn add @xrpl-connect/core xrpl
```

## Usage

```typescript
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

const manager = new WalletManager({
  adapters: [new XamanAdapter()],
  network: 'testnet',
});

// Connect to wallet
const account = await manager.connect('xaman');

// Sign transaction
const signed = await manager.sign({
  TransactionType: 'Payment',
  Account: account.address,
  Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
  Amount: '1000000',
});

// Sign message
const signedMsg = await manager.signMessage('Hello XRPL!');

// Disconnect
await manager.disconnect();
```

## Features

- Framework-agnostic (works with React, Vue, Svelte, vanilla JS)
- Unified API for all XRPL wallets
- Event-driven architecture
- TypeScript support
- Persistent connection state
- Custom network support

## License

MIT
