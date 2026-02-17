---
description: Learn how to create and integrate new wallet adapters into XRPL-Connect for ecosystem wallets.
---

# Creating Wallet Adapters

This guide walks you through creating a new wallet adapter and integrating it into XRPL-Connect. We'll follow the same process the core adapters (Xaman, Crossmark, GemWallet, WalletConnect) use.

## Overview

An **adapter** is a package that implements the `WalletAdapter` interface, bridging XRPL-Connect with your wallet implementation. The adapter handles:

- Connection management
- Account retrieval
- Transaction signing
- Message signing
- Event handling
- Error handling

## Repository Structure

The XRPL-Connect monorepo is organized as follows:

```
xrpl-connect/
├── packages/
│   ├── core/                    # WalletManager and interfaces
│   ├── ui/                      # Web component
│   ├── adapters/                # All wallet adapters
│   │   ├── xaman/              # Xaman adapter (reference)
│   │   ├── crossmark/           # Crossmark adapter (reference)
│   │   ├── gemwallet/           # GemWallet adapter (reference)
│   │   ├── walletconnect/       # WalletConnect adapter (reference)
│   │   ├── ledger/              # Ledger hardware wallet adapter (reference)
│   │   └── README.md            # Adapter documentation
│   └── xrpl-connect/            # Meta package (exports all adapters)
└── docs/                        # Documentation (this file)
```

## Step 1: Fork and Clone

1. Fork the repository at [github.com/XRPL-Commons/xrpl-connect](https://github.com/XRPL-Commons/xrpl-connect)
2. Clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/xrpl-connect.git
cd xrpl-connect
pnpm install
```

## Step 2: Create Your Adapter Package

### 2.1 Create Directory Structure

Navigate to the adapters folder and create a new directory for your wallet:

```bash
mkdir packages/adapters/my-wallet
cd packages/adapters/my-wallet
```

### 2.2 Create Files

Create the basic file structure:

```
packages/adapters/my-wallet/
├── src/
│   ├── index.ts                 # Exports
│   ├── my-wallet-adapter.ts     # Main adapter class
│   └── types.ts                 # Types (if needed)
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

### 2.3 Setup package.json

Use the Xaman adapter as a template. Replace `my-wallet` and `MyWallet` with your wallet name:

```json
{
  "name": "@xrpl-connect/adapter-my-wallet",
  "version": "0.3.0",
  "description": "My Wallet adapter for XRPL Connect",
  "author": "Your Name",
  "license": "MIT",
  "homepage": "https://github.com/XRPL-Commons/xrpl-connect#readme",
  "repository": {
    "type": "git",
    "url": "https://github.com/XRPL-Commons/xrpl-connect",
    "directory": "packages/adapters/my-wallet"
  },
  "bugs": {
    "url": "https://github.com/XRPL-Commons/xrpl-connect/issues"
  },
  "keywords": ["xrpl", "my-wallet", "wallet", "adapter", "web3"],
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@xrpl-connect/core": "workspace:*"
  },
  "peerDependencies": {
    "xrpl": "^3.0.0 || ^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "tsup": "^8.1.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

### 2.4 Copy Config Files

Copy `tsconfig.json` and `tsup.config.ts` from an existing adapter (e.g., xaman):

```bash
# From the xrpl-connect root
cp packages/adapters/xaman/tsconfig.json packages/adapters/my-wallet/
cp packages/adapters/xaman/tsup.config.ts packages/adapters/my-wallet/
```

## Step 3: Implement Your Adapter

### 3.1 Understand the Interface

First, check the `WalletAdapter` interface in `packages/core/src/types.ts`. Your adapter must implement:

```typescript
interface WalletAdapter {
  name: string;
  icon: string;
  isAvailable(): boolean;
  connect(options?: ConnectOptions): Promise<void>;
  disconnect(): Promise<void>;
  getAccount(): Promise<Account | null>;
  signTransaction(transaction: Transaction): Promise<SignResult>;
  signMessage(message: string): Promise<SignResult>;
  on(
    event: 'connect' | 'disconnect' | 'accountChange' | 'error',
    listener: (data?: any) => void
  ): void;
  off(event: string, listener: (data?: any) => void): void;
}
```

### 3.2 Create the Adapter Class

Create `src/my-wallet-adapter.ts`:

```typescript
import {
  WalletAdapter,
  Account,
  SignResult,
  Transaction,
  ConnectOptions,
} from '@xrpl-connect/core';

export class MyWalletAdapter implements WalletAdapter {
  name = 'My Wallet';
  icon = 'https://example.com/wallet-icon.png';

  private connected = false;
  private account: Account | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  isAvailable(): boolean {
    // Check if wallet is available in the browser environment
    // Example: return typeof (window as any).myWallet !== 'undefined';
    if (typeof window === 'undefined') return false;
    return typeof (window as any).myWallet !== 'undefined';
  }

  async connect(options?: ConnectOptions): Promise<void> {
    try {
      if (!this.isAvailable()) {
        throw new Error('My Wallet is not installed');
      }

      // Request connection from your wallet
      const accounts = await (window as any).myWallet.connect();

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts available');
      }

      // Get account details
      const address = accounts[0];
      const publicKey = await (window as any).myWallet.getPublicKey(address);

      this.account = {
        address,
        publicKey,
      };

      this.connected = true;

      // Setup wallet event listeners
      this.setupWalletListeners();

      // Emit connect event
      this.emit('connect', { account: this.account });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (typeof (window as any).myWallet?.disconnect === 'function') {
        await (window as any).myWallet.disconnect();
      }

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

  async signTransaction(transaction: Transaction): Promise<SignResult> {
    if (!this.connected || !this.account) {
      throw new Error('Wallet not connected');
    }

    try {
      // Add account to transaction if not present
      const tx = { ...transaction };
      if (!tx.Account) {
        tx.Account = this.account.address;
      }

      // Sign with your wallet
      const result = await (window as any).myWallet.signTransaction(tx);

      return {
        signature: result.signature,
        signedTransaction: result.signedTransaction,
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async signMessage(message: string): Promise<SignResult> {
    if (!this.connected || !this.account) {
      throw new Error('Wallet not connected');
    }

    try {
      const result = await (window as any).myWallet.signMessage(message);

      return {
        signature: result.signature,
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

  private setupWalletListeners(): void {
    const wallet = (window as any).myWallet;

    wallet.on('disconnect', () => {
      this.connected = false;
      this.account = null;
      this.emit('disconnect');
    });

    wallet.on('accountChange', (accounts: string[]) => {
      if (accounts.length === 0) {
        this.connected = false;
        this.account = null;
        this.emit('disconnect');
      } else {
        this.account = {
          address: accounts[0],
          publicKey: this.account?.publicKey || '',
        };
        this.emit('accountChange', { account: this.account });
      }
    });
  }

  private emit(event: string, data?: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach((listener) => listener(data));
    }
  }
}
```

### 3.3 Create Export File

Create `src/index.ts`:

```typescript
export { MyWalletAdapter } from './my-wallet-adapter';
```

## Step 4: Test Your Adapter

Create a test file `src/my-wallet-adapter.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyWalletAdapter } from './my-wallet-adapter';

describe('MyWalletAdapter', () => {
  let adapter: MyWalletAdapter;

  beforeEach(() => {
    adapter = new MyWalletAdapter();
  });

  it('should have correct metadata', () => {
    expect(adapter.name).toBe('My Wallet');
    expect(adapter.icon).toBeTruthy();
  });

  it('should handle unavailable wallet', async () => {
    expect(adapter.isAvailable()).toBe(false); // In test environment
  });

  it('should emit events on connection', async () => {
    const listener = vi.fn();
    adapter.on('connect', listener);

    // Test connection logic
    // expect(listener).toHaveBeenCalled();
  });
});
```

Run tests:

```bash
pnpm --filter @xrpl-connect/adapter-my-wallet test
```

## Step 5: Update the Meta Package

Edit `packages/xrpl-connect/package.json` and add your adapter to dependencies:

```json
{
  "dependencies": {
    "@xrpl-connect/core": "workspace:*",
    "@xrpl-connect/ui": "workspace:*",
    "@xrpl-connect/adapter-xaman": "workspace:*",
    "@xrpl-connect/adapter-crossmark": "workspace:*",
    "@xrpl-connect/adapter-gemwallet": "workspace:*",
    "@xrpl-connect/adapter-walletconnect": "workspace:*",
    "@xrpl-connect/adapter-ledger": "workspace:*",
    "@xrpl-connect/adapter-my-wallet": "workspace:*"
  }
}
```

Edit `packages/xrpl-connect/src/index.ts`:

```typescript
export * from '@xrpl-connect/core';
export * from '@xrpl-connect/ui';

// Re-export all adapters
export { XamanAdapter } from '@xrpl-connect/adapter-xaman';
export { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
export { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';
export { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';
export { LedgerAdapter } from '@xrpl-connect/adapter-ledger';
export { MyWalletAdapter } from '@xrpl-connect/adapter-my-wallet';

// Convenient grouped exports
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';
import { LedgerAdapter } from '@xrpl-connect/adapter-ledger';
import { MyWalletAdapter } from '@xrpl-connect/adapter-my-wallet';

export const Adapters = {
  Xaman: XamanAdapter,
  Crossmark: CrossmarkAdapter,
  GemWallet: GemWalletAdapter,
  WalletConnect: WalletConnectAdapter,
  Ledger: LedgerAdapter,
  MyWallet: MyWalletAdapter,
};
```

Also update `packages/xrpl-connect/src/index.browser.ts` with the same changes.

## Step 6: Update the Vanilla JS Example

Edit `docs/guide/frameworks/vanilla-js.md` to show your adapter in action:

```typescript
import { WalletManager, MyWalletAdapter, XamanAdapter } from 'xrpl-connect';

const walletManager = new WalletManager({
  adapters: [new MyWalletAdapter(), new XamanAdapter({ apiKey: 'YOUR_API_KEY' })],
  network: 'testnet',
  autoConnect: true,
});
```

Or using the `Adapters` object:

```typescript
import { WalletManager, Adapters } from 'xrpl-connect';

const walletManager = new WalletManager({
  adapters: [new Adapters.MyWallet(), new Adapters.Xaman({ apiKey: 'YOUR_API_KEY' })],
  network: 'testnet',
});
```

## Step 7: Build and Test Locally

Build your adapter:

```bash
pnpm --filter @xrpl-connect/adapter-my-wallet build
```

Build the entire project:

```bash
pnpm build
```

Test locally with the example:

```bash
pnpm docs:dev
```

Navigate to the vanilla JS example and verify your adapter works.

## Step 8: Update Documentation

Add a section to `docs/guide/frameworks/vanilla-js.md` or create a dedicated page:

```markdown
### My Wallet

To use My Wallet adapter:

1. Install xrpl-connect
2. Create your wallet manager with MyWalletAdapter
3. Pass it to the web component

\`\`\`typescript
import { WalletManager, MyWalletAdapter } from 'xrpl-connect';

const walletManager = new WalletManager({
adapters: [new MyWalletAdapter()],
network: 'mainnet'
});
\`\`\`
```

## Step 9: Submit a Pull Request

1. Commit your changes:

```bash
git add .
git commit -m "feat: add My Wallet adapter"
```

2. Push to your fork:

```bash
git push origin feat/add-my-wallet-adapter
```

3. Create a pull request on GitHub

### PR Checklist

- [ ] Adapter implements complete `WalletAdapter` interface
- [ ] All methods handle errors gracefully
- [ ] Event system works correctly (connect, disconnect, accountChange, error)
- [ ] Tests written with good coverage
- [ ] Documentation updated with example usage
- [ ] package.json properly configured
- [ ] Build passes (`pnpm build`)
- [ ] Vanilla JS example updated to show your adapter

## Common Patterns

### Auto-reconnect on Load

```typescript
async connect(options?: ConnectOptions): Promise<void> {
  if (options?.autoConnect && this.hasStoredSession()) {
    // Silent reconnection
    const session = this.getStoredSession();
    // ... reconnect logic
  }
  // ... normal connection flow
}

private hasStoredSession(): boolean {
  return !!localStorage.getItem(`myWallet_session`);
}
```

### Handle Network Switching

```typescript
async switchNetwork(network: 'mainnet' | 'testnet' | 'devnet'): Promise<void> {
  const wallet = (window as any).myWallet;
  await wallet.switchNetwork(network);
  this.emit('networkChange', { network });
}
```

### Timeout for Operations

```typescript
private withTimeout<T>(promise: Promise<T>, ms = 30000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), ms)
    ),
  ]);
}
```

## Troubleshooting

### "Wallet not found" error

- Ensure your wallet is installed/available
- Check `isAvailable()` returns `true`
- Verify wallet is initialized before calling `connect()`

### Connection drops unexpectedly

- Verify wallet event listeners are set up in `setupWalletListeners()`
- Ensure `off()` method properly removes listeners
- Check for memory leaks in event listener management

### Signing fails

- Verify account is properly set before signing
- Check transaction object format
- Ensure wallet has necessary permissions
- Handle wallet-specific signing requirements

## Resources

- [XRPL Documentation](https://xrpl.org)
- [XRPL Transaction Types](https://xrpl.org/transaction-types.html)
- [Existing Adapters](https://github.com/XRPL-Commons/xrpl-connect/tree/main/packages/adapters)
- [GitHub Issues](https://github.com/XRPL-Commons/xrpl-connect/issues)

## Support

Have questions?

- Open an issue on [GitHub](https://github.com/XRPL-Commons/xrpl-connect/issues)
- Check existing adapter implementations for reference
- Join the XRPL community discussions
