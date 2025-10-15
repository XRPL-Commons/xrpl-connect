# @xrpl-connect/adapter-gemwallet

GemWallet adapter for xrpl-connect - enables browser extension-based wallet connections.

## Installation

```bash
npm install @xrpl-connect/core @xrpl-connect/adapter-gemwallet xrpl
# or
pnpm add @xrpl-connect/core @xrpl-connect/adapter-gemwallet xrpl
```

## Usage

```typescript
import { WalletManager } from '@xrpl-connect/core';
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';

const manager = new WalletManager({
  adapters: [
    new GemWalletAdapter(),
  ],
  network: 'mainnet',
});

// Connect
const account = await manager.connect('gemwallet');
console.log('Connected:', account.address);

// Sign a transaction
const signed = await manager.sign({
  TransactionType: 'Payment',
  Account: account.address,
  Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
  Amount: '1000000',
});

// Sign a message
const signedMsg = await manager.signMessage('Hello from XRPL!');
```

## Features

- Browser extension-based connection
- Transaction signing
- Message signing
- Simple, clean API
- Full TypeScript support

## Requirements

Users need to have the GemWallet browser extension installed. Download from:
https://gemwallet.app

## License

MIT
