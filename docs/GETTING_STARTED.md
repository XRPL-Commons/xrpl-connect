# Getting Started with XRPL Connect

This guide will help you get started with XRPL Connect, a framework-agnostic wallet connection toolkit for the XRP Ledger.

## Table of Contents

- [What is XRPL Connect?](#what-is-xrpl-connect)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [Basic Usage](#basic-usage)
- [Wallet Adapters](#wallet-adapters)
- [Event System](#event-system)
- [Error Handling](#error-handling)
- [Network Configuration](#network-configuration)
- [Storage and Persistence](#storage-and-persistence)
- [API Reference](#api-reference)

## What is XRPL Connect?

XRPL Connect is a modular toolkit that simplifies wallet connections for XRPL applications. It provides:

- **Unified API** - Single interface for all XRPL wallets
- **Framework Agnostic** - Works with any JavaScript framework or vanilla JS
- **Type Safe** - Full TypeScript support
- **Event Driven** - Reactive state management
- **Extensible** - Easy to add new wallet adapters

### Supported Wallets

- **Xaman** (formerly Xumm) - Mobile wallet with QR code signing
- **Crossmark** - Browser extension wallet
- **GemWallet** - Browser extension wallet
- **WalletConnect** - Protocol for connecting various wallets

## Installation

Install the UI package and wallet adapters you need:

```bash
# Recommended: UI package includes core + provides plug-and-play web component
npm install @xrpl-connect/ui @xrpl-connect/adapter-xaman @xrpl-connect/adapter-crossmark

# Or with pnpm
pnpm add @xrpl-connect/ui @xrpl-connect/adapter-xaman @xrpl-connect/adapter-crossmark

# Or with yarn
yarn add @xrpl-connect/ui @xrpl-connect/adapter-xaman @xrpl-connect/adapter-crossmark
```

### Additional Wallet Adapters

```bash
# Add more wallet adapters as needed
npm install @xrpl-connect/adapter-gemwallet
npm install @xrpl-connect/adapter-walletconnect
```

### Core Package Only (Advanced)

For advanced users who want to build custom UI:

```bash
npm install @xrpl-connect/core @xrpl-connect/adapter-xaman xrpl
```

## Core Concepts

### WalletManager

The `WalletManager` is the main class you interact with. It orchestrates wallet connections, manages state, and handles events.

```typescript
import { WalletManager } from '@xrpl-connect/core';

const walletManager = new WalletManager({
  adapters: [...],  // Wallet adapters
  network: 'testnet',
  autoConnect: true,
});
```

### Wallet Adapters

Adapters are plugins that implement wallet-specific connection logic. Each wallet (Xaman, Crossmark, etc.) has its own adapter.

```typescript
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';

const adapters = [
  new XamanAdapter(),
  new CrossmarkAdapter(),
];
```

### Events

XRPL Connect uses an event-driven architecture. Listen to events to react to connection state changes:

```typescript
walletManager.on('connect', (account) => {
  console.log('Connected:', account);
});

walletManager.on('disconnect', () => {
  console.log('Disconnected');
});
```

## Basic Usage

### Method 1: Web Component (Recommended)

The easiest way to add wallet connection to your app:

**1. Add the HTML element:**
```html
<button id="connect-btn">Connect Wallet</button>

<xrpl-wallet-connector
  id="wallet-connector"
  background-color="#1a202c"
  primary-wallet="xaman">
</xrpl-wallet-connector>
```

**2. Initialize in JavaScript:**
```javascript
import '@xrpl-connect/ui';
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';

// Create wallet manager
const walletManager = new WalletManager({
  adapters: [
    new XamanAdapter(),
    new CrossmarkAdapter(),
  ],
  network: 'testnet',
  autoConnect: true,
});

// Connect UI component to wallet manager
const connector = document.getElementById('wallet-connector');
connector.setWalletManager(walletManager);

// Open modal when button clicked
document.getElementById('connect-btn').addEventListener('click', () => {
  connector.open();
});

// Listen to events
walletManager.on('connect', (account) => {
  console.log('Connected:', account.address);
});
```

**3. Sign transactions after connection:**
```javascript
// Sign a transaction
const signed = await walletManager.sign({
  TransactionType: 'Payment',
  Account: walletManager.account.address,
  Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
  Amount: '1000000',
});

// Sign a message
const signedMessage = await walletManager.signMessage('Hello XRPL!');

// Disconnect
await walletManager.disconnect();
```

The web component provides:
- Beautiful pre-built UI for wallet selection
- QR code display for mobile wallets
- Loading and error states
- Responsive design
- Customizable theming

### Method 2: Manual Integration (Advanced)

For full control over the UI, you can use the core package directly without the web component. See the [API Reference](#api-reference) section below.

## Wallet Adapters

### Xaman Adapter

Xaman (formerly Xumm) is a mobile wallet that uses QR codes or deep links for signing.

```typescript
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

const xamanAdapter = new XamanAdapter({
  apiKey: 'your-xaman-api-key', // Optional, but recommended
});

// Connect
const account = await walletManager.connect('xaman', {
  apiKey: 'your-xaman-api-key',
});
```

### Crossmark Adapter

Crossmark is a browser extension wallet.

```typescript
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';

const crossmarkAdapter = new CrossmarkAdapter();

// Connect
const account = await walletManager.connect('crossmark');
```

### GemWallet Adapter

GemWallet is a browser extension wallet.

```typescript
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';

const gemWalletAdapter = new GemWalletAdapter();

// Connect
const account = await walletManager.connect('gemwallet');
```

### WalletConnect Adapter

WalletConnect enables connections to various wallets via QR code.

```typescript
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';

const walletConnectAdapter = new WalletConnectAdapter({
  projectId: 'your-walletconnect-project-id',
});

// Connect
const account = await walletManager.connect('walletconnect', {
  projectId: 'your-walletconnect-project-id',
});
```

## Event System

Subscribe to events to react to connection state changes:

### Available Events

- `connect` - Emitted when wallet connects
- `disconnect` - Emitted when wallet disconnects
- `accountChanged` - Emitted when account changes
- `networkChanged` - Emitted when network changes
- `error` - Emitted when an error occurs

### Event Listeners

```typescript
// Listen to events
walletManager.on('connect', (account) => {
  console.log('Connected:', account.address);
  console.log('Network:', account.network.name);
});

walletManager.on('disconnect', () => {
  console.log('Wallet disconnected');
});

walletManager.on('accountChanged', (account) => {
  console.log('Account changed to:', account.address);
});

walletManager.on('networkChanged', (network) => {
  console.log('Network changed to:', network.name);
});

walletManager.on('error', (error) => {
  console.error('Wallet error:', error);
});

// Listen once
walletManager.once('connect', (account) => {
  console.log('First connection:', account);
});

// Remove listener
const listener = (account) => console.log(account);
walletManager.on('connect', listener);
walletManager.off('connect', listener);
```

## Error Handling

XRPL Connect provides typed errors for better error handling:

```typescript
import { WalletError, WalletErrorCode } from '@xrpl-connect/core';

try {
  await walletManager.connect('xaman');
} catch (error) {
  if (error instanceof WalletError) {
    switch (error.code) {
      case WalletErrorCode.WALLET_NOT_INSTALLED:
        console.error('Wallet is not installed');
        break;
      case WalletErrorCode.CONNECTION_REJECTED:
        console.error('User rejected connection');
        break;
      case WalletErrorCode.SIGN_REJECTED:
        console.error('User rejected signing');
        break;
      default:
        console.error('Wallet error:', error.message);
    }
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Error Codes

- `WALLET_NOT_FOUND` - Wallet adapter not found
- `WALLET_NOT_INSTALLED` - Wallet not installed
- `CONNECTION_FAILED` - Connection failed
- `CONNECTION_REJECTED` - User rejected connection
- `SIGN_FAILED` - Signing failed
- `SIGN_REJECTED` - User rejected signing
- `NETWORK_NOT_SUPPORTED` - Network not supported
- `NETWORK_MISMATCH` - Network mismatch
- `NOT_CONNECTED` - Not connected to wallet
- `ALREADY_CONNECTED` - Already connected
- `UNKNOWN_ERROR` - Unknown error

## Network Configuration

### Standard Networks

```typescript
// Use standard network names
const walletManager = new WalletManager({
  adapters: [...],
  network: 'mainnet', // or 'testnet', 'devnet'
});
```

### Custom Networks

```typescript
const customNetwork = {
  id: 'custom',
  name: 'My Custom Network',
  wss: 'wss://custom.xrpl.org',
  rpc: 'https://custom.xrpl.org',
};

const walletManager = new WalletManager({
  adapters: [...],
  network: customNetwork,
});
```

### Network Switching

```typescript
// Get current network
const network = await walletManager.wallet?.getNetwork();
console.log('Current network:', network?.name);
```

## Storage and Persistence

XRPL Connect automatically persists connection state to localStorage for auto-reconnection.

### Custom Storage

You can provide custom storage implementation:

```typescript
import { StorageAdapter } from '@xrpl-connect/core';

class CustomStorage implements StorageAdapter {
  async get(key: string): Promise<string | null> {
    // Your implementation
  }

  async set(key: string, value: string): Promise<void> {
    // Your implementation
  }

  async remove(key: string): Promise<void> {
    // Your implementation
  }

  async clear(): Promise<void> {
    // Your implementation
  }
}

const walletManager = new WalletManager({
  adapters: [...],
  storage: new CustomStorage(),
});
```

## API Reference

### WalletManager

#### Constructor Options

```typescript
interface WalletManagerOptions {
  adapters: WalletAdapter[];    // Array of wallet adapters
  network?: NetworkConfig;       // Default network (default: 'mainnet')
  autoConnect?: boolean;         // Auto-reconnect on page load (default: false)
  storage?: StorageAdapter;      // Custom storage (default: localStorage)
  logger?: LoggerOptions;        // Logger configuration
}
```

#### Properties

- `connected: boolean` - Whether wallet is connected
- `account: AccountInfo | null` - Current account info
- `wallet: WalletAdapter | null` - Current wallet adapter

#### Methods

- `connect(walletId: string, options?: ConnectOptions): Promise<AccountInfo>` - Connect to wallet
- `disconnect(): Promise<void>` - Disconnect from wallet
- `reconnect(): Promise<AccountInfo | null>` - Reconnect to last wallet
- `sign(transaction: Transaction): Promise<SignedTransaction>` - Sign transaction
- `signMessage(message: string | Uint8Array): Promise<SignedMessage>` - Sign message
- `getAvailableWallets(): Promise<WalletAdapter[]>` - Get available wallets
- `on(event: WalletEvent, callback: Function): void` - Add event listener
- `off(event: WalletEvent, callback: Function): void` - Remove event listener
- `once(event: WalletEvent, callback: Function): void` - Add one-time event listener

### Types

#### AccountInfo

```typescript
interface AccountInfo {
  address: string;       // XRPL address
  publicKey?: string;    // Public key (optional)
  network: NetworkInfo;  // Network info
}
```

#### NetworkInfo

```typescript
interface NetworkInfo {
  id: string;                // Network ID
  name: string;              // Display name
  wss: string;               // WebSocket endpoint
  rpc?: string;              // HTTP RPC endpoint (optional)
  walletConnectId?: string;  // WalletConnect chain ID (optional)
}
```

#### SignedTransaction

```typescript
interface SignedTransaction {
  hash: string;       // Transaction hash
  tx_blob?: string;   // Signed transaction blob
  signature?: string; // Signature
}
```

#### SignedMessage

```typescript
interface SignedMessage {
  message: string;    // Original message
  signature: string;  // Signature
  publicKey: string;  // Public key used
}
```

## Next Steps

- **[Vanilla JS Guide](./VANILLA_JS.md)** - Integration with vanilla JavaScript
- **[React Guide](./REACT.md)** - Integration with React
- **[Vue Guide](./VUE.md)** - Integration with Vue 3

## Support

For issues, questions, or contributions:

- GitHub Issues: https://github.com/your-org/xrpl-connect/issues
- Documentation: https://github.com/your-org/xrpl-connect
- XRPL Community: https://xrpl.org/community.html
