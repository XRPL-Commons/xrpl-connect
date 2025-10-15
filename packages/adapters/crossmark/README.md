# @xrpl-connect/adapter-crossmark

Crossmark adapter for xrpl-connect - enables browser extension-based wallet connections.

## Installation

```bash
npm install @xrpl-connect/core @xrpl-connect/adapter-crossmark xrpl
# or
pnpm add @xrpl-connect/core @xrpl-connect/adapter-crossmark xrpl
```

## Usage

```typescript
import { WalletManager } from '@xrpl-connect/core';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';

const manager = new WalletManager({
  adapters: [
    new CrossmarkAdapter(),
  ],
  network: 'mainnet',
});

// Connect
const account = await manager.connect('crossmark');
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
