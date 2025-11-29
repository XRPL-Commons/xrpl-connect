# Privy Adapter Example

This example demonstrates how to use the Privy adapter with XRPL Connect for social login and embedded wallets.

## Setup

1. **Get Privy App ID**:
   - Sign up at [privy.io](https://privy.io)
   - Create a new app
   - Copy your App ID

2. **Set Environment Variable**:
   ```bash
   # Create .env file
   echo "VITE_PRIVY_APP_ID=your_app_id_here" > .env
   ```

3. **Install Dependencies**:
   ```bash
   pnpm install
   ```

4. **Run Example**:
   ```bash
   # For development
   pnpm dev

   # Or open index.html directly in browser
   open index.html
   ```

## Features Demonstrated

- ✅ Social login configuration
- ✅ Adapter setup and initialization
- ✅ Connection flow
- ✅ Account information display
- ✅ Disconnect handling

## Current Status

⚠️ This example requires full Privy SDK integration. The core architecture is in place, but the following needs to be completed:

1. Install `@privy-io/js-sdk-core`
2. Implement `PrivyClientWrapper` methods
3. Add authentication UI
4. Test with real Privy accounts

## Code Example

```typescript
import { WalletManager } from '@xrpl-connect/core';
import { PrivyAdapter } from '@xrpl-connect/adapter-privy';

// Initialize wallet manager
const manager = new WalletManager({
  adapters: [
    new PrivyAdapter({
      appId: import.meta.env.VITE_PRIVY_APP_ID,
      socialProviders: ['google', 'twitter', 'discord'],
      chainType: 'ethereum', // secp256k1 for XRPL
      appearance: {
        theme: 'dark',
        accentColor: '#3b99fc'
      }
    })
  ],
  network: 'testnet'
});

// Connect
await manager.connect('privy');

// Get account
const account = await manager.getAccount();
console.log('Connected:', account.address);

// Sign transaction
const result = await manager.signAndSubmit({
  TransactionType: 'Payment',
  Account: account.address,
  Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
  Amount: '1000000'
});

console.log('Transaction:', result.hash);
```

## Next Steps

1. Complete Privy SDK integration
2. Add real authentication flow
3. Test wallet creation
4. Test transaction signing
5. Add error handling and edge cases

## Resources

- [Privy Documentation](https://docs.privy.io)
- [XRPL Connect Docs](https://docs.xrpl-connect.dev)
- [XRPL Documentation](https://xrpl.org)
