---
description: Learn how to create and integrate new wallet adapters into XRPL-Connect for ecosystem wallets.
---

# Creating Wallet Adapters

This guide explains how to create a new wallet adapter to integrate your wallet into XRPL-Connect. Whether you're building a new wallet or want to add support for an existing one, this guide will walk you through the process.

## Understanding Adapters

An **adapter** is the bridge between XRPL-Connect and your wallet. It handles:

- **Connection management** - Establishing connections to your wallet
- **Account retrieval** - Getting the connected account information
- **Transaction signing** - Signing transactions with your wallet
- **Message signing** - Signing messages for verification
- **Event handling** - Broadcasting connection state changes
- **Disconnection** - Properly cleaning up connections

## Architecture Overview

```
XRPL-Connect WalletManager
        ↓
    Adapter Interface
        ↓
Your Wallet Implementation
        ↓
Wallet Extension/App
```

## Adapter Interface

Every adapter must implement the `WalletAdapter` interface. Here's the complete interface:

```typescript
interface WalletAdapter {
  // Metadata
  name: string;
  icon: string;
  isAvailable: () => boolean;

  // Connection
  connect(options?: ConnectOptions): Promise<void>;
  disconnect(): Promise<void>;

  // Account
  getAccount(): Promise<Account | null>;

  // Signing
  signTransaction(transaction: Transaction): Promise<SignResult>;
  signMessage(message: string): Promise<SignResult>;

  // Events
  on(event: 'connect' | 'disconnect' | 'accountChange' | 'error', listener: (data?: any) => void): void;
  off(event: string, listener: (data?: any) => void): void;
}
```

### Type Definitions

```typescript
interface Account {
  address: string;
  publicKey: string;
}

interface SignResult {
  signature: string;
  signedTransaction?: string;
}

interface Transaction {
  Account?: string;
  TransactionType: string;
  [key: string]: any;
}

interface ConnectOptions {
  autoConnect?: boolean;
}
```

## Step-by-Step Implementation

### Step 1: Create Your Adapter Class

```typescript
import { WalletAdapter } from '@xrpl-connect/core';

export class MyWalletAdapter implements WalletAdapter {
  name = 'My Wallet';
  icon = 'https://example.com/wallet-icon.png';

  private connected = false;
  private account: Account | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  async connect(options?: ConnectOptions): Promise<void> {
    try {
      // Initialize connection to your wallet
      // This might involve checking if wallet is installed,
      // requesting user permission, etc.

      if (typeof window === 'undefined') {
        throw new Error('Wallet adapter requires browser environment');
      }

      // Example: Check if wallet is available
      if (!this.isAvailable()) {
        throw new Error('My Wallet is not installed');
      }

      // Example: Request connection from wallet
      const accounts = await this.requestConnection();

      this.account = {
        address: accounts[0],
        publicKey: await this.getPublicKey(accounts[0])
      };

      this.connected = true;
      this.emit('connect', { account: this.account });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Clean up connection
      this.connected = false;
      this.account = null;
      this.emit('disconnect');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getAccount(): Promise<Account | null> {
    return this.account;
  }

  isAvailable(): boolean {
    // Check if wallet is available in the current environment
    // Example: return typeof (window as any).myWallet !== 'undefined';
    return false;
  }

  async signTransaction(transaction: Transaction): Promise<SignResult> {
    if (!this.connected || !this.account) {
      throw new Error('Not connected to wallet');
    }

    try {
      // Sign transaction with your wallet
      // The exact implementation depends on your wallet's API
      const signedTx = await this.requestSignature(transaction);

      return {
        signature: signedTx.signature,
        signedTransaction: signedTx.signedTransaction
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async signMessage(message: string): Promise<SignResult> {
    if (!this.connected || !this.account) {
      throw new Error('Not connected to wallet');
    }

    try {
      // Sign message with your wallet
      const signature = await this.requestMessageSignature(message);

      return {
        signature
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: Function): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(listener);
    }
  }

  private emit(event: string, data?: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(listener => listener(data));
    }
  }

  // Private helper methods for your specific wallet integration
  private async requestConnection(): Promise<string[]> {
    // Implement wallet-specific connection logic
    throw new Error('Not implemented');
  }

  private async getPublicKey(address: string): Promise<string> {
    // Implement logic to get public key for address
    throw new Error('Not implemented');
  }

  private async requestSignature(transaction: Transaction): Promise<any> {
    // Implement wallet-specific signing logic
    throw new Error('Not implemented');
  }

  private async requestMessageSignature(message: string): Promise<string> {
    // Implement wallet-specific message signing logic
    throw new Error('Not implemented');
  }
}
```

### Step 2: Handle Wallet Events

Your wallet probably emits events when the user connects, disconnects, or changes accounts. Make sure to listen to these events and propagate them:

```typescript
private setupWalletListeners(): void {
  if (typeof window === 'undefined') return;

  const wallet = (window as any).myWallet;

  // Listen to wallet disconnect
  wallet.on('disconnect', () => {
    this.connected = false;
    this.account = null;
    this.emit('disconnect');
  });

  // Listen to account changes
  wallet.on('accountChange', (newAddress: string) => {
    this.account = {
      address: newAddress,
      publicKey: this.account?.publicKey || ''
    };
    this.emit('accountChange', { account: this.account });
  });

  // Listen to network changes
  wallet.on('networkChange', (network: string) => {
    this.emit('networkChange', { network });
  });
}
```

### Step 3: Handle Errors Gracefully

```typescript
private handleError(error: Error, context: string): void {
  console.error(`MyWallet error in ${context}:`, error);

  this.emit('error', {
    code: error.name,
    message: error.message,
    context
  });
}
```

## Example: Integration with a Browser Extension

If your wallet is a browser extension, here's how to implement it:

```typescript
export class ExtensionWalletAdapter implements WalletAdapter {
  name = 'Extension Wallet';
  icon = 'https://example.com/icon.png';

  private connected = false;
  private account: Account | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  isAvailable(): boolean {
    return typeof (window as any).extensionWallet !== 'undefined';
  }

  async connect(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Extension Wallet not found. Please install it.');
    }

    const extensionWallet = (window as any).extensionWallet;

    try {
      // Request connection permission from extension
      const accounts = await extensionWallet.connect();

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts available');
      }

      this.account = {
        address: accounts[0],
        publicKey: await extensionWallet.getPublicKey(accounts[0])
      };

      this.connected = true;
      this.setupWalletListeners();
      this.emit('connect', { account: this.account });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private setupWalletListeners(): void {
    const extensionWallet = (window as any).extensionWallet;

    extensionWallet.on('disconnect', () => {
      this.connected = false;
      this.account = null;
      this.emit('disconnect');
    });

    extensionWallet.on('accountChange', (accounts: string[]) => {
      if (accounts.length === 0) {
        this.connected = false;
        this.account = null;
        this.emit('disconnect');
      } else {
        this.account = {
          address: accounts[0],
          publicKey: this.account?.publicKey || ''
        };
        this.emit('accountChange', { account: this.account });
      }
    });
  }

  // ... rest of implementation
}
```

## Using Your Adapter

Once your adapter is implemented, users can integrate it with XRPL-Connect:

```typescript
import { WalletManager } from '@xrpl-connect/core';
import { MyWalletAdapter } from './adapters/MyWalletAdapter';

const walletManager = new WalletManager({
  adapters: [
    new MyWalletAdapter(),
    // ... other adapters
  ],
  network: 'mainnet'
});

// Connect to wallet
await walletManager.connect();

// Get connected account
const account = await walletManager.getAccount();

// Sign transaction
const result = await walletManager.signTransaction({
  Account: account.address,
  TransactionType: 'Payment',
  Destination: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
  Amount: '1000000'
});
```

## Best Practices

### 1. Handle Connection States Properly

```typescript
// Always check connection before operations
async signTransaction(transaction: Transaction): Promise<SignResult> {
  if (!this.connected) {
    throw new Error('Wallet not connected');
  }
  // ... signing logic
}
```

### 2. Implement Auto-reconnect

```typescript
async connect(options?: ConnectOptions): Promise<void> {
  if (options?.autoConnect && this.hasStoredConnection()) {
    // Attempt silent reconnection
    const stored = this.getStoredConnection();
    // ... reconnect logic
  }
  // ... normal connection flow
}

private hasStoredConnection(): boolean {
  // Check localStorage or sessionStorage
  return !!localStorage.getItem(`${this.name}_connected`);
}
```

### 3. Handle Network Switching

```typescript
async switchNetwork(network: 'mainnet' | 'testnet' | 'devnet'): Promise<void> {
  const wallet = (window as any).myWallet;

  try {
    await wallet.switchNetwork(network);
    this.emit('networkChange', { network });
  } catch (error) {
    this.emit('error', { message: 'Failed to switch network' });
    throw error;
  }
}
```

### 4. Validate Transactions Before Signing

```typescript
private validateTransaction(transaction: Transaction): void {
  if (!transaction.Account) {
    throw new Error('Transaction must have Account field');
  }

  if (!transaction.TransactionType) {
    throw new Error('Transaction must have TransactionType');
  }

  // Add more validation as needed
}
```

### 5. Implement Timeout Handling

```typescript
private async withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
    )
  ]);
}
```

## Testing Your Adapter

Create tests to verify your adapter works correctly:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyWalletAdapter } from './MyWalletAdapter';

describe('MyWalletAdapter', () => {
  let adapter: MyWalletAdapter;

  beforeEach(() => {
    adapter = new MyWalletAdapter();
  });

  it('should detect wallet availability', () => {
    expect(adapter.isAvailable()).toBe(false); // Update based on test environment
  });

  it('should throw error when connecting to unavailable wallet', async () => {
    await expect(adapter.connect()).rejects.toThrow();
  });

  it('should emit events when connection changes', async () => {
    const listener = vi.fn();
    adapter.on('connect', listener);

    // Trigger connection somehow
    // expect(listener).toHaveBeenCalled();
  });
});
```

## Publishing Your Adapter

### 1. Package Structure

```
my-wallet-adapter/
├── src/
│   ├── index.ts
│   └── MyWalletAdapter.ts
├── tests/
│   └── MyWalletAdapter.test.ts
├── package.json
├── README.md
└── tsconfig.json
```

### 2. Package.json

```json
{
  "name": "@xrpl-connect/my-wallet-adapter",
  "version": "1.0.0",
  "description": "My Wallet adapter for XRPL-Connect",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@xrpl-connect/core": "^0.3.0"
  },
  "devDependencies": {
    "@xrpl-connect/core": "^0.3.0"
  }
}
```

### 3. Export Your Adapter

```typescript
// src/index.ts
export { MyWalletAdapter } from './MyWalletAdapter';
```

## Contributing Back to XRPL-Connect

If you'd like to have your adapter included in the official XRPL-Connect ecosystem:

1. **Fork the repository** - Clone the XRPL-Connect repository
2. **Create an adapter package** - Follow the structure above
3. **Add comprehensive tests** - Ensure good test coverage
4. **Submit a pull request** - Include documentation and examples
5. **Get review and feedback** - The maintainers will review your implementation

### Pull Request Checklist

- [ ] Adapter implements complete `WalletAdapter` interface
- [ ] All error cases are handled properly
- [ ] Event system is properly implemented
- [ ] Tests have good coverage (80%+)
- [ ] Documentation is clear and complete
- [ ] Example usage is provided
- [ ] No breaking changes to existing code

## Troubleshooting

### Connection Issues

**Problem**: Adapter can't connect to wallet
- Check `isAvailable()` returns `true`
- Verify wallet is installed in the browser
- Check browser console for errors
- Ensure wallet permissions are granted

### Signing Issues

**Problem**: Transaction signing fails
- Verify transaction format is correct
- Check account has sufficient balance
- Ensure wallet is still connected
- Check transaction validation logic

### Event Handling

**Problem**: Events not firing
- Verify listeners are registered with `on()`
- Check that `emit()` is being called
- Ensure wallet events are being listened to
- Check for event listener memory leaks

## Resources

- [XRPL Transaction Types](https://xrpl.org/transaction-types.html)
- [XRPL Signing](https://xrpl.org/sign-and-submit-transactions.html)
- [Wallet Integration Standards](https://xrpl.org/connect-your-wallet.html)

## Support

Have questions about creating an adapter?

- **GitHub Issues** - [XRPL-Commons/xrpl-connect/issues](https://github.com/XRPL-Commons/xrpl-connect/issues)
- **Discussions** - Start a discussion in the repository
- **Community** - Reach out to the XRPL community
