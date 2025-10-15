# @xrpl-connect/adapter-xaman

Xaman (formerly Xumm) wallet adapter for xrpl-connect.

## Installation

```bash
npm install @xrpl-connect/core @xrpl-connect/adapter-xaman xrpl
# or
pnpm add @xrpl-connect/core @xrpl-connect/adapter-xaman xrpl
```

## Usage

```typescript
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

const manager = new WalletManager({
  adapters: [
    new XamanAdapter({
      apiKey: 'your-xaman-api-key', // Optional: can also provide in connect()
    }),
  ],
  network: 'testnet',
});

// Connect with API key
const account = await manager.connect('xaman', {
  apiKey: 'your-xaman-api-key', // If not provided in constructor
});

console.log('Connected:', account.address);

// Sign a transaction
const signed = await manager.sign({
  TransactionType: 'Payment',
  Account: account.address,
  Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
  Amount: '1000000',
});

console.log('Transaction hash:', signed.hash);
```

## Features

- OAuth2 PKCE authentication flow
- Popup-based transaction signing
- WebSocket status updates
- Auto-disconnect on logout
- Network detection from Xaman settings

## API Key

You need a Xaman API key to use this adapter. Get one from:
https://apps.xumm.dev/

## License

MIT
