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
│   │   ├── xaman/               # Xaman adapter (reference)
│   │   ├── crossmark/           # Crossmark adapter (reference)
│   │   ├── gemwallet/           # GemWallet adapter (reference)
│   │   ├── walletconnect/       # WalletConnect adapter (reference)
│   │   ├── ledger/              # Ledger hardware wallet adapter (reference)
│   │   ├── xyra/                # Xyra adapter (reference)
│   │   ├── ghostsig/            # GHOSTSIG adapter (reference)
│   │   ├── otsu/                # Otsu adapter (reference)
│   │   ├── metamask-snap/       # MetaMask Snap adapter (reference)
│   │   └── README.md            # Adapter documentation
│   ├── privy/                   # Optional Privy social login adapter package
│   ├── react/                   # React bindings
│   ├── vue/                     # Vue bindings
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
├── vite.config.ts
└── README.md
```

### 2.3 Setup package.json

Use the Xaman adapter as a template. Replace `my-wallet` and `MyWallet` with your wallet name:

```json
{
  "name": "@xrpl-connect/adapter-my-wallet",
  "version": "1.0.0",
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
    "build": "vp pack",
    "dev": "vp pack --watch",
    "test": "vp test run",
    "test:watch": "vp test",
    "lint": "vp lint src",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@xrpl-connect/core": "workspace:*"
  },
  "peerDependencies": {
    "xrpl": "^3.0.0 || ^4.0.0 || ^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0"
  }
}
```

### 2.4 Copy Config Files

Copy `tsconfig.json` and `vite.config.ts` from an existing adapter (e.g., xaman):

```bash
# From the xrpl-connect root
cp packages/adapters/xaman/tsconfig.json packages/adapters/my-wallet/
cp packages/adapters/xaman/vite.config.ts packages/adapters/my-wallet/
```

## Step 3: Implement Your Adapter

### 3.1 Understand the Interface

First, check the `WalletAdapter` interface in `packages/core/src/types.ts`. Your adapter must implement the required members; the optional ones opt into specific behavior:

```typescript
interface WalletAdapter {
  // Metadata
  readonly id: WalletIdentifier; // 'xaman', 'crossmark', or your own ID
  readonly name: string; // Display name
  readonly icon?: string; // URL or base64 icon
  readonly url?: string; // Wallet website / download URL
  readonly loginBranding?: { readonly label: string; readonly logo: string };

  // Declared support for sign, signAndSubmit, and signMessage (omitted flags default to true)
  readonly capabilities?: WalletCapabilities;
  // Keep the stored session when a restore times out (only if restoring never waits on the user)
  readonly keepsSessionOnRestoreTimeout?: boolean;

  // Availability and configuration
  getMissingConfiguration?(options?: ConnectOptions): readonly string[];
  isAvailable(): Promise<boolean>;

  // Authentication providers: sign-in choices and interactive prompts
  getLoginMethods?(options?: { signal?: AbortSignal }): Promise<readonly WalletLoginMethod[]>;
  onAuthPrompt?(callback: (prompt: WalletAuthPrompt | null) => void): () => void;

  // Connection lifecycle
  serializeReconnectOptions?(options: ConnectOptions): ReconnectOptions | undefined;
  connect(options?: ConnectOptions): Promise<AccountInfo>;
  disconnect(): Promise<void>;

  // Account information
  getAccount(): Promise<AccountInfo | null>;
  getNetwork(): Promise<NetworkInfo>;

  // Signing
  sign(transaction: Transaction): Promise<SignedTransaction>;
  signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction>;
  signMessage(message: string | Uint8Array): Promise<SignedMessage>;

  // Optional event hooks
  on?(event: WalletAdapterEvent, callback: (data: unknown) => void): void;
  off?(event: WalletAdapterEvent, callback: (data: unknown) => void): void;
}

// Events an adapter can emit
type WalletAdapterEvent = 'connect' | 'disconnect' | 'accountChanged' | 'networkChanged' | 'error';
```

Missing configuration fields make the manager reject `connect()` with `CONFIGURATION_REQUIRED`.
Optional capability interfaces add further behavior; implement them as methods on the adapter:

- `SupportsFetchAccount` (`fetchAccount()`): live account refresh for `WalletManager.fetchAccount()`. Without it, the manager rejects refresh with `UNSUPPORTED_METHOD`.
- `SupportsPendingConnection` (`hasPendingConnection()`): a login that returned to this page through a redirect, completed by `connect()` without starting a new one.
- `SupportsPreInitialize` (`preInitialize()`) and `SupportsDeepLink` (`getDeepLinkURI()`): prepare a QR handshake before the user picks the wallet, and turn a URI into a mobile deep link.

See the [API reference](/guide/api-reference#types-interfaces) for the full contracts.

### 3.2 Create the Adapter Class

Create `src/my-wallet-adapter.ts`:

```typescript
import {
  WalletAdapter,
  WalletAdapterEvent,
  WalletCapabilities,
  AccountInfo,
  NetworkInfo,
  STANDARD_NETWORKS,
  SignedTransaction,
  SubmittedTransaction,
  SignedMessage,
  Transaction,
  ConnectOptions,
  createWalletError,
  decodeMessage,
  isStandardNetworkId,
} from '@xrpl-connect/core';

export class MyWalletAdapter implements WalletAdapter {
  readonly id = 'my-wallet';
  readonly name = 'My Wallet';
  readonly icon = 'https://example.com/wallet-icon.png';
  readonly url = 'https://example.com';
  // Declare `false` for any operation the wallet cannot perform.
  readonly capabilities: WalletCapabilities = {
    sign: true,
    signAndSubmit: true,
    signMessage: true,
  };

  private account: AccountInfo | null = null;
  private network: NetworkInfo = STANDARD_NETWORKS.mainnet;
  private listeners: Map<WalletAdapterEvent, Set<(data: unknown) => void>> = new Map();

  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    return typeof (window as any).myWallet !== 'undefined';
  }

  async connect(options?: ConnectOptions): Promise<AccountInfo> {
    if (!(await this.isAvailable())) {
      throw createWalletError.notInstalled(this.name);
    }

    try {
      const accounts = await (window as any).myWallet.connect();
      if (!accounts || accounts.length === 0) {
        throw createWalletError.connectionRejected(this.name);
      }

      const address = accounts[0];
      const publicKey = await (window as any).myWallet.getPublicKey(address);
      // Report the network the wallet is actually on, never just the requested
      // `options?.network`: the manager compares the two and rejects a mismatch
      // with NETWORK_MISMATCH instead of signing on the wrong network.
      this.network = this.toNetworkInfo(await (window as any).myWallet.getNetwork());

      this.account = { address, publicKey, network: this.network };
      this.setupWalletListeners();
      this.emit('connect', this.account);
      return this.account;
    } catch (error) {
      this.emit('error', error);
      throw createWalletError.connectionFailed(this.name, error as Error);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (typeof (window as any).myWallet?.disconnect === 'function') {
        await (window as any).myWallet.disconnect();
      }
      this.account = null;
      this.emit('disconnect', undefined);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async getAccount(): Promise<AccountInfo | null> {
    return this.account;
  }

  async getNetwork(): Promise<NetworkInfo> {
    return this.network;
  }

  async sign(transaction: Transaction): Promise<SignedTransaction> {
    this.assertConnected();
    const tx = { ...transaction, Account: transaction.Account || this.account!.address };
    const result = await (window as any).myWallet.sign(tx);
    return { hash: result.hash, tx_blob: result.tx_blob, signature: result.signature };
  }

  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    this.assertConnected();
    const tx = { ...transaction, Account: transaction.Account || this.account!.address };
    const result = await (window as any).myWallet.signAndSubmit(tx);
    return { hash: result.hash };
  }

  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    this.assertConnected();
    // Rejects invalid UTF-8 with INVALID_MESSAGE instead of signing U+FFFD substitutes.
    const text = decodeMessage(message);
    const result = await (window as any).myWallet.signMessage(text);
    return {
      message: text,
      signature: result.signature,
      publicKey: result.publicKey ?? this.account!.publicKey ?? '',
    };
  }

  on(event: WalletAdapterEvent, callback: (data: unknown) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
  }

  off(event: WalletAdapterEvent, callback: (data: unknown) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private assertConnected(): void {
    if (!this.account) throw createWalletError.notConnected();
  }

  private toNetworkInfo(walletNetworkId: string): NetworkInfo {
    if (isStandardNetworkId(walletNetworkId)) return STANDARD_NETWORKS[walletNetworkId];
    throw createWalletError.networkNotSupported(walletNetworkId, this.name);
  }

  private setupWalletListeners(): void {
    const wallet = (window as any).myWallet;

    wallet.on?.('disconnect', () => {
      this.account = null;
      this.emit('disconnect', undefined);
    });

    wallet.on?.('accountChanged', (addresses: string[]) => {
      if (!addresses?.length) {
        this.account = null;
        this.emit('disconnect', undefined);
        return;
      }
      this.account = {
        address: addresses[0],
        publicKey: this.account?.publicKey,
        network: this.network,
      };
      this.emit('accountChanged', this.account);
    });
  }

  private emit(event: WalletAdapterEvent, data: unknown): void {
    this.listeners.get(event)?.forEach((listener) => listener(data));
  }
}
```

### 3.3 Verify Wallet-Signed Results

Treat a signed result returned by the wallet as untrusted input. `@xrpl-connect/core` exports the
checks the built-in adapters use:

- `canonicalizeTransaction(transaction)` returns the codec-canonical form. Send it to the wallet,
  so the wallet signs exactly what you verify; it throws for a transaction that cannot be serialized.
- `assertSignedTransaction(tx_json, tx_blob, { walletName, account, networkId })` checks the network
  ID, the signing account, and the signatures. Pass `multisign: true` for a multisign contribution.
- `assertRequestedTransaction(request, tx_json, { walletName })` checks that every requested field
  is preserved; the wallet may only add omitted fields such as `Fee` or `Sequence`.

```typescript
import { decode, hashes } from 'xrpl';
import { assertRequestedTransaction, assertSignedTransaction, canonicalizeTransaction } from '@xrpl-connect/core';

const XRPL_NETWORK_IDS: Record<string, number> = { mainnet: 0, testnet: 1, devnet: 2 };

async sign(transaction: Transaction): Promise<SignedTransaction> {
  this.assertConnected();
  const account = this.account!;
  try {
    const request = canonicalizeTransaction({ ...transaction, Account: transaction.Account || account.address });
    const { tx_blob } = await (window as any).myWallet.sign(request);
    const tx_json = decode(tx_blob) as Transaction;
    assertSignedTransaction(tx_json, tx_blob, {
      walletName: this.name,
      account: account.address,
      networkId: XRPL_NETWORK_IDS[account.network.id],
    });
    assertRequestedTransaction(request, tx_json, { walletName: this.name });
    return { hash: hashes.hashSignedTx(tx_blob), tx_blob, tx_json, signature: tx_json.TxnSignature };
  } catch (error) {
    // signFailed() passes a WalletError through unchanged, so report a user
    // rejection from your wallet as createWalletError.signRejected() above.
    throw createWalletError.signFailed(error as Error);
  }
}
```

The helpers throw plain `Error`s; wrap them in a `WalletError` as above.

### 3.4 Create Export File

Create `src/index.ts`:

```typescript
export { MyWalletAdapter } from './my-wallet-adapter';
```

## Step 4: Test Your Adapter

Create a test file `src/my-wallet-adapter.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vite-plus/test';
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
    await expect(adapter.isAvailable()).resolves.toBe(false); // In test environment
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
    "@xrpl-connect/adapter-crossmark": "workspace:*",
    "@xrpl-connect/adapter-gemwallet": "workspace:*",
    "@xrpl-connect/adapter-ghostsig": "workspace:*",
    "@xrpl-connect/adapter-ledger": "workspace:*",
    "@xrpl-connect/adapter-metamask-snap": "workspace:*",
    "@xrpl-connect/adapter-my-wallet": "workspace:*",
    "@xrpl-connect/adapter-walletconnect": "workspace:*",
    "@xrpl-connect/adapter-xaman": "workspace:*",
    "@xrpl-connect/adapter-otsu": "workspace:*",
    "@xrpl-connect/adapter-xyra": "workspace:*",
    "@xrpl-connect/core": "workspace:*",
    "@xrpl-connect/ui": "workspace:*"
  }
}
```

Re-export the adapter's public surface from `packages/xrpl-connect/src/index.ts`. Its exports must
not collide with the other adapters' names:

```typescript
export * from '@xrpl-connect/core';
export * from '@xrpl-connect/ui';

export * from '@xrpl-connect/adapter-xaman';
// ...the other packaged adapters
export * from '@xrpl-connect/adapter-metamask-snap';
export * from '@xrpl-connect/adapter-my-wallet';
export * from './adapters';
```

Then register the constructor in `packages/xrpl-connect/src/adapters.ts`, both in the `Adapters`
object and in `ADAPTER_DESCRIPTORS`, the packaged adapters in display order:

```typescript
import { MyWalletAdapter } from '@xrpl-connect/adapter-my-wallet';

export const Adapters = {
  // ...existing adapters
  MyWallet: MyWalletAdapter,
} as const;

export const ADAPTER_DESCRIPTORS = [
  // ...existing descriptors
  {
    exportKey: 'MyWallet',
    id: 'my-wallet',
    name: 'My Wallet',
    Adapter: Adapters.MyWallet,
    availability: 'extension', // 'remote' | 'extension' | 'browser' | 'device'
    configuration: { requiredOptions: [], supportsDeferredConnection: false },
  },
] as const satisfies readonly AdapterDescriptor[];
```

Finally, add `'my-wallet'` to `STANDARD_WALLET_IDS` in `packages/core/src/types.ts`, in the same
order as `ADAPTER_DESCRIPTORS`. The packed-package tests in `packages/xrpl-connect/tests/publish`
check that both lists match the expected IDs; update those expectations too.
`index.browser.ts` forwards `index.ts` and needs no change.

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
- [ ] All methods handle errors gracefully and throw `WalletError` where appropriate
- [ ] Event system works correctly (`connect`, `disconnect`, `accountChanged`, `networkChanged`, `error`)
- [ ] Tests written with good coverage
- [ ] Documentation updated with example usage
- [ ] package.json properly configured
- [ ] Build passes (`pnpm build`)
- [ ] Vanilla JS example updated to show your adapter

## Common Patterns

### Restore a Session After Reload

`WalletManager` persists the session and restores it through `reconnect()` (automatically with
`autoConnect: true`); adapters do not read the manager's storage. To restore the same account,
implement `serializeReconnectOptions()`. The manager stores the small, JSON-safe object it returns
and passes it back to `connect()` on restore, together with the session's network:

```typescript
serializeReconnectOptions(): ReconnectOptions | undefined {
  return this.account ? { myWalletAddress: this.account.address } : undefined;
}

async connect(options?: ConnectOptions<{ myWalletAddress?: string }>): Promise<AccountInfo> {
  if (options?.myWalletAddress) {
    // Restore without a new permission prompt, and reject if the wallet now
    // reports a different account.
  }
  // ... normal connection flow
}
```

Never return tokens, keys, or other secrets from `serializeReconnectOptions()`.

### Handle Network Switching

```typescript
async switchNetwork(network: NetworkInfo): Promise<void> {
  const wallet = (window as any).myWallet;
  await wallet.switchNetwork(network.id);
  this.network = network;
  if (this.account) this.account.network = network;
  this.emit('networkChanged', network);
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
- [Existing Adapters](https://github.com/XRPL-Commons/xrpl-connect/tree/develop/packages/adapters)
- [GitHub Issues](https://github.com/XRPL-Commons/xrpl-connect/issues)

## Support

Have questions?

- Open an issue on [GitHub](https://github.com/XRPL-Commons/xrpl-connect/issues)
- Check existing adapter implementations for reference
- Join the XRPL community discussions
