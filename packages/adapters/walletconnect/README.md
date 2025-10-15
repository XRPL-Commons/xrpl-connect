# @xrpl-connect/adapter-walletconnect

WalletConnect adapter for xrpl-connect - enables QR code-based wallet connections using Reown AppKit.

## Installation

```bash
npm install @xrpl-connect/core @xrpl-connect/adapter-walletconnect xrpl
# or
pnpm add @xrpl-connect/core @xrpl-connect/adapter-walletconnect xrpl
```

## Usage

```typescript
import { WalletManager } from '@xrpl-connect/core';
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';

const manager = new WalletManager({
  adapters: [
    new WalletConnectAdapter({
      projectId: 'your-reown-project-id',
      metadata: {
        name: 'My XRPL App',
        description: 'XRPL application using WalletConnect',
        url: 'https://myapp.com',
        icons: ['https://myapp.com/icon.png'],
      },
    }),
  ],
  network: 'mainnet',
});

// Connect with project ID
const account = await manager.connect('walletconnect', {
  projectId: 'your-project-id', // If not provided in constructor
});

console.log('Connected:', account.address);

// Sign a transaction
const signed = await manager.sign({
  TransactionType: 'Payment',
  Account: account.address,
  Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
  Amount: '1000000',
});
```

## Features

- QR code-based connection (no extension required)
- Works with any WalletConnect-compatible XRPL wallet
- Built on Reown AppKit for modern WalletConnect integration
- Session management and persistence
- Multi-sig support (`xrpl_signTransactionFor`)
- XRPL-specific RPC methods
- Event-driven session lifecycle

## Project ID

You need a Reown project ID. Get one for free at:
https://dashboard.reown.com

## Supported Methods

- `xrpl_signTransaction` - Sign XRPL transactions with autofill and submit options
- `xrpl_signTransactionFor` - Sign for multi-signature accounts
- `xrpl_signMessage` - Sign arbitrary messages

## XRPL Transaction Format

This adapter uses the official XRPL RPC format for transaction signing:

```typescript
// Request format
{
  tx_json: {
    TransactionType: 'Payment',
    Account: 'rAddress...',
    Destination: 'rAddress...',
    Amount: '1000000'
  },
  autofill: true,  // Auto-fill fee, sequence, etc.
  submit: false     // Set to true to submit automatically
}

// Response format
{
  tx_json: {
    ...transaction,
    hash: '0x...',
    TxnSignature: '...',
    SigningPubKey: '...'
  }
}
```

## Migration from Old WalletConnect

This adapter has been updated to use Reown AppKit (formerly WalletConnect v2). The interface remains the same, but internally uses the new SDK for better performance and compatibility.

## License

MIT
