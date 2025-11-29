# @xrpl-connect/adapter-privy

Privy wallet adapter for XRPL Connect. Enable social login (Google, Twitter, Discord, etc.) with automatic embedded wallet creation for XRPL applications.

## Features

- 🔐 **Social Login**: Google, Twitter, Discord, GitHub, Apple, LinkedIn, TikTok, Farcaster
- 📧 **Email & SMS**: Traditional authentication methods
- 🔑 **Embedded Wallets**: Automatic XRPL wallet creation using Privy's secure infrastructure
- 🎨 **Customizable UI**: Match your app's branding
- 🔄 **Seamless Integration**: Works with existing xrpl-connect setup
- 🌐 **Framework Agnostic**: Works with vanilla JS, React, Vue, and more

## Installation

```bash
npm install @xrpl-connect/adapter-privy
# or
pnpm add @xrpl-connect/adapter-privy
# or
yarn add @xrpl-connect/adapter-privy
```

## Prerequisites

1. **Privy Account**: Sign up at [privy.io](https://privy.io)
2. **App ID**: Create an app in the Privy dashboard to get your App ID
3. **Environment Variable**: Set `VITE_PRIVY_APP_ID` (or your preferred env var name)

## Quick Start

### Basic Setup (Vanilla JS)

```typescript
import { WalletManager } from '@xrpl-connect/core';
import { PrivyAdapter } from '@xrpl-connect/adapter-privy';

const walletManager = new WalletManager({
  adapters: [
    new PrivyAdapter({
      appId: import.meta.env.VITE_PRIVY_APP_ID, // Your Privy App ID
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
await walletManager.connect('privy');

// Sign transaction
const result = await walletManager.signAndSubmit({
  TransactionType: 'Payment',
  Account: walletManager.account.address,
  Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
  Amount: '1000000'
});
```

### With Web Component

```html
<xrpl-wallet-connector
  id="connector"
  wallets="privy,xaman,crossmark"
  primary-wallet="privy"
></xrpl-wallet-connector>

<script type="module">
  import { WalletManager } from '@xrpl-connect/core';
  import { PrivyAdapter } from '@xrpl-connect/adapter-privy';

  const walletManager = new WalletManager({
    adapters: [
      new PrivyAdapter({
        appId: import.meta.env.VITE_PRIVY_APP_ID,
        socialProviders: ['google', 'twitter'],
      })
    ]
  });

  const connector = document.getElementById('connector');
  connector.setWalletManager(walletManager);
</script>
```

### React Integration

```tsx
import { WalletManager } from '@xrpl-connect/core';
import { PrivyAdapter } from '@xrpl-connect/adapter-privy';

function App() {
  const walletManager = new WalletManager({
    adapters: [
      new PrivyAdapter({
        appId: import.meta.env.VITE_PRIVY_APP_ID,
        chainType: 'ethereum', // secp256k1
        onAuthStateChange: (authenticated) => {
          console.log('Auth state:', authenticated);
        }
      })
    ]
  });

  return <YourApp walletManager={walletManager} />;
}
```

## Configuration Options

### PrivyAdapterOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `appId` | `string` | **Required** | Your Privy App ID (public, safe in frontend) |
| `authMethods` | `AuthMethod[]` | `['social', 'email', 'wallet']` | Authentication methods to enable |
| `socialProviders` | `SocialProvider[]` | `['google', 'twitter', 'discord']` | Social login providers |
| `chainType` | `'ethereum' \| 'solana'` | `'ethereum'` | Wallet curve type (use `ethereum` for XRPL) |
| `appearance` | `object` | `{}` | UI customization options |
| `createWalletOnLogin` | `string` | `'users-without-wallets'` | When to create embedded wallets |
| `onAuthRequired` | `function` | - | Callback when auth UI should show |
| `onAuthStateChange` | `function` | - | Callback for auth state changes |

### Social Providers

Available social providers:
- `google` - Google OAuth
- `twitter` - Twitter/X OAuth
- `discord` - Discord OAuth
- `github` - GitHub OAuth
- `apple` - Apple Sign In
- `linkedin` - LinkedIn OAuth
- `tiktok` - TikTok OAuth
- `farcaster` - Farcaster Auth

### Chain Types

- `ethereum` - secp256k1 curve (recommended for XRPL)
- `solana` - ed25519 curve

## How It Works

1. **User Authentication**: User logs in with their chosen method (social, email, etc.)
2. **Wallet Creation**: Privy creates an embedded wallet using secure MPC technology
3. **Address Derivation**: The adapter converts the wallet's public key to an XRPL address
4. **Transaction Signing**: Transactions are signed using Privy's secure signing infrastructure
5. **Submission**: Signed transactions are submitted to the XRPL network

## Address Conversion

The adapter automatically converts Privy's embedded wallet addresses to XRPL addresses:

```
Ethereum Wallet (secp256k1)
  ↓ Public Key Extraction
  ↓ SHA-256 Hash
  ↓ RIPEMD-160 Hash
  ↓ Base58Check Encoding
XRPL Address (r...)
```

## Security

- ✅ **App ID is public** - Safe to expose in frontend code
- ✅ **Private keys never exposed** - Managed by Privy's secure infrastructure
- ✅ **MPC technology** - Keys are split across multiple parties
- ✅ **User control** - Users control access via authentication
- ✅ **HTTPS required** - OAuth requires secure connections

## Environment Variables

Create a `.env` file in your project root:

```bash
# Privy Configuration
VITE_PRIVY_APP_ID=your_app_id_here
```

Or for Next.js:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=your_app_id_here
```

## Examples

### Custom Authentication Flow

```typescript
const adapter = new PrivyAdapter({
  appId: process.env.VITE_PRIVY_APP_ID,
  authMethods: ['social', 'email'],
  socialProviders: ['google', 'twitter'],
  onAuthRequired: (method) => {
    console.log('Authentication required:', method);
    // Show custom UI
  },
  onAuthStateChange: (authenticated) => {
    if (authenticated) {
      console.log('User logged in!');
    } else {
      console.log('User logged out');
    }
  }
});
```

### Email-Only Authentication

```typescript
const adapter = new PrivyAdapter({
  appId: process.env.VITE_PRIVY_APP_ID,
  authMethods: ['email'],
  appearance: {
    theme: 'light',
    accentColor: '#00ff00'
  }
});
```

### Wallet Connection Only

```typescript
const adapter = new PrivyAdapter({
  appId: process.env.VITE_PRIVY_APP_ID,
  authMethods: ['wallet'], // Connect existing wallets
});
```

## API Reference

### PrivyAdapter

#### `connect(options?: ConnectOptions): Promise<AccountInfo>`

Connect to Privy wallet. Opens authentication flow.

#### `disconnect(): Promise<void>`

Disconnect and logout from Privy.

#### `signAndSubmit(transaction: Transaction, submit?: boolean): Promise<SubmittedTransaction>`

Sign and optionally submit an XRPL transaction.

#### `signMessage(message: string | Uint8Array): Promise<SignedMessage>`

Sign a message.

#### `getAccount(): Promise<AccountInfo | null>`

Get current account information.

#### `getNetwork(): Promise<NetworkInfo>`

Get current network.

## Current Status

🚧 **In Development** 🚧

This adapter has the core architecture in place but requires full integration with Privy's SDK:

### ✅ Completed
- Project structure and configuration
- TypeScript types and interfaces
- Address conversion logic (secp256k1 to XRPL)
- Transaction signing architecture
- Adapter interface implementation
- Documentation

### 🚧 Pending
- Full Privy SDK integration
- Authentication UI implementation
- Wallet creation flow
- Transaction signing with Privy API
- Testing with real Privy accounts

### Next Steps
1. Install `@privy-io/js-sdk-core` package
2. Implement `PrivyClientWrapper` methods using Privy SDK
3. Add authentication UI components
4. Test with Privy testnet
5. Add comprehensive tests

## Contributing

Contributions are welcome! Please see the main [XRPL Connect repository](https://github.com/XRPL-Commons/xrpl-connect) for contribution guidelines.

## Support

- 📚 [Documentation](https://docs.xrpl-connect.dev)
- 💬 [GitHub Discussions](https://github.com/XRPL-Commons/xrpl-connect/discussions)
- 🐛 [Issue Tracker](https://github.com/XRPL-Commons/xrpl-connect/issues)

## License

MIT © XRPL Connect Contributors
