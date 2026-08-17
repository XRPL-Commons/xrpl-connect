# @xrpl-connect/adapters - Code Documentation

## Overview

`@xrpl-connect/adapters` is a collection of wallet adapter implementations that enable the core `WalletManager` to interact with different XRPL wallet providers. Each adapter bridges the communication gap between the standardized WalletManager interface and wallet-specific implementations.

**Key Responsibility**: Provide adapters that implement a unified interface for wallet operations while handling wallet-specific nuances (OAuth flows, browser extensions, QR codes, etc.).

---

## Adapter Pattern

The adapter pattern is a structural design pattern used here to convert the interface of a wallet into another interface that clients (the WalletManager) expect. This allows:

1. **Unified Interface**: All wallets behave the same way from the WalletManager's perspective
2. **Loose Coupling**: WalletManager doesn't need to know wallet-specific details
3. **Extensibility**: New wallets can be added by implementing the interface
4. **Flexibility**: Developers can use any combination of adapters they need

### Architecture Diagram

```
WalletManager (expects WalletAdapter interface)
    ↓
┌───────────────────────────────────────────────────┐
│  WalletAdapter Interface                          │
│  ├─ connect()                                     │
│  ├─ disconnect()                                  │
│  ├─ getAccount()                                  │
│  ├─ fetchAccount() (optional live query)           │
│  ├─ sign()                                        │
│  ├─ signAndSubmit()                               │
│  ├─ signMessage()                                 │
│  └─ on() / off() (event listeners)                │
└───────────────────────────────────────────────────┘
    ↓                ↓                ↓
┌─────────┐   ┌──────────────┐   ┌────────┐
│ Xaman   │   │  Crossmark   │   │GemWall │
│         │   │              │   │        │
│OAuth    │   │Extension     │   │Extensio│
│Flow     │   │Messaging     │   │n       │
└─────────┘   │              │   │        │
              └──────────────┘   └────────┘
```

---

## WalletAdapter Interface

All adapters must implement the `WalletAdapter` interface. This is the contract that WalletManager depends on.

```typescript
interface WalletAdapter {
  // ==================== Metadata ====================
  readonly id: string; // Unique identifier (e.g., 'xaman', 'crossmark')
  readonly name: string; // Display name (e.g., 'Xaman by Xumm')
  readonly icon?: string; // URL or base64-encoded wallet icon
  readonly url?: string; // Wallet website or download URL
  readonly capabilities?: WalletCapabilities;

  // ==================== Availability ====================
  isAvailable(): Promise<boolean>; // Check if wallet is accessible

  // ==================== Connection Lifecycle ====================
  connect(options?: ConnectOptions): Promise<AccountInfo>;
  disconnect(): Promise<void>;

  // ==================== Account & Network ====================
  getAccount(): Promise<AccountInfo | null>;
  getNetwork(): Promise<NetworkInfo>;

  // ==================== Signing Operations ====================
  sign(transaction: Transaction): Promise<SignedTransaction>;
  signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction>;
  signMessage(message: string | Uint8Array): Promise<SignedMessage>;

  // ==================== Event Listeners (Optional) ====================
  on?(event: WalletAdapterEvent, callback: (data?: unknown) => void): void;
  off?(event: WalletAdapterEvent, callback: (data?: unknown) => void): void;
}

type WalletAdapterEvent = 'connect' | 'disconnect' | 'accountChanged' | 'networkChanged' | 'error';

interface ConnectOptions {
  network?: NetworkConfig;
  autoReconnect?: boolean;
  skipRequestAccess?: boolean; // Best-effort silent-access hint
  [key: string]: unknown; // Wallet-specific options
}
```

Signing capabilities omitted from `capabilities` default to `true` through
`CAPABILITY_DEFAULTS`. Declare a flag as `false` when that operation cannot
succeed. `WalletManager` rejects an explicitly unsupported operation with
`UNSUPPORTED_METHOD` before calling the adapter.

Live account refresh is intentionally separate from cached `getAccount()`:

```typescript
interface SupportsFetchAccount {
  fetchAccount(): Promise<AccountInfo | null>;
}
```

Crossmark, GemWallet, Ledger, Otsu, and Xaman implement this optional interface.
WalletConnect and Xyra do not currently provide a reliable live query. Custom
adapters should implement `SupportsFetchAccount` only when `fetchAccount()`
contacts the wallet, extension, session, or hardware rather than returning an
in-memory account.

---

## Built-in Adapters

### 1. Xaman Adapter

**Package**: `@xrpl-connect/adapter-xaman`

**Export**: `XamanAdapter`

**File Location**: `packages/adapters/xaman/src/index.ts`

#### Overview

The Xaman adapter provides OAuth-based wallet connection without requiring browser extensions. It's built on the Xumm API and is always available.

#### Features

- ✅ OAuth-based authentication flow
- ✅ QR code support for mobile scanning
- ✅ Always available (no extension needed)
- ✅ Desktop and mobile support
- ✅ Automatic sign-in URL generation

#### Constructor

```typescript
const xamanAdapter = new XamanAdapter(options?: XamanAdapterOptions);
```

**Options**:

```typescript
interface XamanAdapterOptions {
  apiKey?: string; // Xumm API key (required for actual usage)
  onQRCode?: (uri: string) => void; // Callback when QR code is available
  onDeepLink?: (uri: string) => string; // Transform deep links (mobile)
}
```

#### Example Usage

```typescript
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { WalletManager } from '@xrpl-connect/core';

const xamanAdapter = new XamanAdapter({
  apiKey: process.env.XUMM_API_KEY,
  onQRCode: (uri) => {
    console.log('QR Code URI:', uri);
    // Display QR code to user
    showQRCode(uri);
  },
});

const walletManager = new WalletManager({
  adapters: [xamanAdapter],
});

// Connect with API key
const account = await walletManager.connect('xaman', {
  apiKey: process.env.XUMM_API_KEY,
});
```

#### Implementation Details

- **isAvailable()**: Always returns `true`
- **connect()**: Returns sign-in URL and waits for user approval via polling
- **Metadata**: Includes Xaman branding and official URL
- **Event Handling**: Emits `connect`, `disconnect`, `accountChanged` events

---

### 2. Crossmark Adapter

**Package**: `@xrpl-connect/adapter-crossmark`

**Export**: `CrossmarkAdapter`

**File Location**: `packages/adapters/crossmark/src/index.ts`

#### Overview

Crossmark is a browser extension adapter. It uses injected provider APIs and message passing to communicate with the extension.

#### Features

- ✅ Browser extension-based
- ✅ Available only if extension is installed
- ✅ No OAuth required
- ✅ Automatic account detection
- ✅ Network switching support

#### Constructor

```typescript
const crossmarkAdapter = new CrossmarkAdapter(options?: CrossmarkAdapterOptions);
```

**Options**:

```typescript
interface CrossmarkAdapterOptions {
  // Currently no specific configuration needed
}
```

#### Example Usage

```typescript
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
import { WalletManager } from '@xrpl-connect/core';

const crossmarkAdapter = new CrossmarkAdapter();

const walletManager = new WalletManager({
  adapters: [crossmarkAdapter],
});

// Check if available before connecting
const available = await crossmarkAdapter.isAvailable();
if (available) {
  const account = await walletManager.connect('crossmark');
}
```

#### Implementation Details

- **isAvailable()**: Checks if `window.crossmark` (injected by extension) exists
- **connect()**: Creates a sign-in hash and requests user authorization via extension
- **sign()**: Uses extension's `signAndWait` method to return signed blob
- **signAndSubmit()**: Uses extension's `signAndSubmitAndWait` method
- **signMessage()**: Uses extension's `signMessage` method
- **Event Handling**: Listens to extension-emitted events

---

### 3. GemWallet Adapter

**Package**: `@xrpl-connect/adapter-gemwallet`

**Export**: `GemWalletAdapter`

**File Location**: `packages/adapters/gemwallet/src/index.ts`

#### Overview

GemWallet is another browser extension adapter, specifically for GemWallet users.

#### Features

- ✅ Browser extension-based
- ✅ Available only if extension is installed
- ✅ Automatic account detection
- ✅ Support for GemWallet-specific features

#### Constructor

```typescript
const gemwalletAdapter = new GemWalletAdapter(options?: GemWalletAdapterOptions);
```

**Options**:

```typescript
interface GemWalletAdapterOptions {
  // Configuration as needed for GemWallet
}
```

#### Example Usage

```typescript
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';

const gemwalletAdapter = new GemWalletAdapter();

const walletManager = new WalletManager({
  adapters: [gemwalletAdapter],
});

const account = await walletManager.connect('gemwallet');
```

---

### 4. WalletConnect Adapter

**Package**: `@xrpl-connect/adapter-walletconnect`

**Export**: `WalletConnectAdapter`

**File Location**: `packages/adapters/walletconnect/src/index.ts`

#### Overview

WalletConnect is a multi-wallet connection protocol supporting dozens of mobile and desktop wallets via QR code scanning.

#### Features

- ✅ Multi-wallet support (40+ wallets)
- ✅ QR code-based pairing
- ✅ Mobile-first design
- ✅ Pre-initialization for faster loading
- ✅ Supports XRPL mainnet, testnet, devnet, and custom XRPL networks

#### Constructor

```typescript
const wcAdapter = new WalletConnectAdapter(options: WalletConnectAdapterOptions);
```

**Options**:

```typescript
interface WalletConnectAdapterOptions {
  projectId: string; // WalletConnect project ID (required)
  onQRCode?: (uri: string) => void; // Callback when QR code is generated
}
```

#### Example Usage

```typescript
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';

const wcAdapter = new WalletConnectAdapter({
  projectId: 'your-walletconnect-project-id',
  onQRCode: (uri) => {
    console.log('Scan this QR code:', uri);
  },
});

const walletManager = new WalletManager({
  adapters: [wcAdapter],
});

const account = await walletManager.connect('walletconnect');
```

#### Special Method: Pre-initialization

For improved user experience, pre-initialize WalletConnect before the user interacts with it:

```typescript
// Initialize during app load, not on first user click
await wcAdapter.preInitialize('mainnet');
```

This eagerly initializes the WalletConnect infrastructure, reducing latency when the user first clicks "Connect".

#### Implementation Details

- **isAvailable()**: Always returns `true` (QR codes are always accessible)
- **connect()**: Generates QR code and waits for wallet connection
- **Multi-wallet**: Shows wallet selection after QR scan
- **Namespace**: Uses `xrpl` namespace for XRPL networks
- **Validation**: Accepts only a valid XRPL classic address whose CAIP-10 chain matches the requested network; invalid approved sessions are disconnected

---

### 5. Xyra Adapter

**Package**: `@xrpl-connect/adapter-xyra`

**Export**: `XyraAdapter`

**File Location**: `packages/adapters/xyra/src/index.ts`

#### Overview

Xyra is a browser-native popup-based wallet adapter. It uses the `@xyrawallet/sdk` to open secure popup windows for account selection and transaction signing, communicating back to the parent page via `postMessage`. No browser extensions, app downloads, or API keys are required.

#### Features

- ✅ Browser-native popup-based signing
- ✅ Always available (no extension or app required)
- ✅ No OAuth or API key required
- ✅ XRPL mainnet and testnet networks support
- ✅ Origin verification displayed to user before approval
- ✅ Message signing for authentication and proof of ownership
- ✅ Client-side encryption — private keys never leave the wallet popup

#### Constructor

```typescript
const xyraAdapter = new XyraAdapter(options?: XyraAdapterOptions);
```

**Options**:

```typescript
interface XyraAdapterOptions {
  walletUrl?: string; // Custom wallet URL (default: 'https://wallet.xyra.now')
  timeout?: number; // Popup timeout in ms (default: 300000 / 5 minutes)
  popupWidth?: number; // Connect popup width (default: 420)
  popupHeight?: number; // Connect popup height (default: 720)
  signPopupHeight?: number; // Sign popup height (default: 640)
}
```

#### Example Usage

```typescript
import { XyraAdapter } from '@xrpl-connect/adapter-xyra';
import { WalletManager } from '@xrpl-connect/core';

const xyraAdapter = new XyraAdapter();

const walletManager = new WalletManager({
  adapters: [xyraAdapter],
  network: 'testnet',
});

// Xyra is always available — no availability check needed
const account = await walletManager.connect('xyra');
console.log('Connected:', account.address);
```

#### Implementation Details

- **isAvailable()**: Always returns `true` in browser environments (web-based wallet, no extension dependency)
- **connect()**: Opens a popup at `wallet.xyra.now/connect` via the Xyra SDK; user selects an account and approves; address and public key are returned via `postMessage`
- **sign()**: Opens a popup at `wallet.xyra.now/sign` showing full transaction details and requesting origin; does not submit to the transaction to the network.
  **signAndSubmit()**: Opens a popup at `wallet.xyra.now/sign` showing full transaction details and requesting origin; submit the transaction to the network.
- **signMessage()**: Opens a popup at `wallet.xyra.now/sign-message` for arbitrary message signing (authentication, proof of ownership)
- **Network mapping**: Translates between xrpl-connect network IDs (`mainnet`, `testnet`) and Xyra network strings (`xrpl-mainnet`, `xrpl-testnet`)
- **Event Handling**: Emits standard `connect`, `disconnect`, and `error` events; no persistent wallet-side listeners since Xyra is stateless

---

### 6. Otsu Adapter

**Package**: `@xrpl-connect/adapter-otsu`

**Export**: `OtsuAdapter`

**File Location**: `packages/adapters/otsu/src/index.ts`

#### Overview

Otsu is an MV3 browser extension wallet for XRPL that supports mainnet, testnet, and devnet. It injects a provider at `window.xrpl` with `isOtsu=true` and communicates with dApps via postMessage-based content script bridging.

#### Features

- Browser extension-based (Chrome + Firefox)
- Available only if extension is installed
- Granular dApp permission scopes (read, sign, submit, switchNetwork)
- Transaction simulation and risk scanning before user approval
- Account and network change event forwarding
- Message signing for authentication

#### Constructor

```typescript
const otsuAdapter = new OtsuAdapter();
```

#### Example Usage

```typescript
import { OtsuAdapter } from '@xrpl-connect/adapter-otsu';
import { WalletManager } from '@xrpl-connect/core';

const otsuAdapter = new OtsuAdapter();

const walletManager = new WalletManager({
  adapters: [otsuAdapter],
  network: 'testnet',
});

const available = await otsuAdapter.isAvailable();
if (available) {
  const account = await walletManager.connect('otsu');
  console.log('Connected:', account.address);
}
```

#### Implementation Details

- **isAvailable()**: Checks if `window.xrpl?.isOtsu` exists (injected by extension)
- **connect()**: Requests connection with full permission scopes; opens extension notification popup for user approval
- **sign()**: Uses extension's `signTransaction` method with transaction simulation
- **signAndSubmit()**: Uses extension's `signAndSubmit` method
- **signMessage()**: Signs arbitrary messages for authentication
- **Event Handling**: Forwards `accountChanged`, `networkChanged`, and `disconnected` events from the extension provider

---

### 7. MetaMask Snap Adapter

**Package**: `@xrpl-connect/adapter-metamask-snap`

**Export**: `MetaMaskSnapAdapter`

#### Overview

Brings XRPL support to MetaMask via the [`xrpl-snap`](https://snaps.metamask.io/snap/npm/xrpl-snap/) MetaMask Snap. The snap runs sandboxed inside MetaMask; the adapter talks to it through the standard provider RPC (`wallet_requestSnaps` to install/connect, `wallet_invokeSnap` for XRPL operations), so it needs **no `xrpl-snap` npm dependency**.

#### Features

- ✅ Uses the user's existing MetaMask install (no separate wallet)
- ✅ Available only when MetaMask + Snaps are present
- ✅ Sign, sign-and-submit, and message signing
- ✅ Network switching via the snap

#### Constructor

```typescript
const metaMaskSnapAdapter = new MetaMaskSnapAdapter(options?: MetaMaskSnapAdapterOptions);
```

```typescript
interface MetaMaskSnapAdapterOptions {
  snapId?: string; // defaults to 'npm:xrpl-snap'
}
```

#### Example Usage

```typescript
import { MetaMaskSnapAdapter } from '@xrpl-connect/adapter-metamask-snap';
// or: import { MetaMaskSnapAdapter, Adapters } from 'xrpl-connect';

const metaMaskSnapAdapter = new MetaMaskSnapAdapter();
```

#### Implementation Details

- **isAvailable()**: Returns `true` only when `window.ethereum?.isMetaMask` is set and `wallet_getSnaps` succeeds.
- **connect()**: Installs/connects the snap (`wallet_requestSnaps`), switches network, then reads the account via `xrpl_getAccount`.
- **sign() / signAndSubmit() / signMessage()**: Invoke the snap's `xrpl_sign`, `xrpl_signAndSubmit`, `xrpl_signMessage` methods.

---

## Creating a Custom Adapter

To add support for a new wallet, create a class that implements the `WalletAdapter` interface.

### Step-by-Step Guide

#### 1. Create Adapter File

Create a new directory under `packages/adapters/`:

```
packages/adapters/your-wallet/
├── src/
│   ├── index.ts          # Main adapter export
│   ├── types.ts          # Type definitions
│   └── utils.ts          # Helper functions
├── package.json
├── tsconfig.json
└── README.md
```

#### 2. Implement the WalletAdapter Interface

**File**: `packages/adapters/your-wallet/src/index.ts`

```typescript
import {
  WalletAdapter,
  AccountInfo,
  NetworkInfo,
  SignedTransaction,
  SubmittedTransaction,
  SignedMessage,
  SupportsFetchAccount,
  WalletError,
  WalletErrorCode,
} from '@xrpl-connect/core';

export class YourWalletAdapter implements WalletAdapter, SupportsFetchAccount {
  readonly id = 'your-wallet-id';
  readonly name = 'Your Wallet';
  readonly icon = 'https://...'; // URL or base64
  readonly url = 'https://your-wallet.com';

  private account: AccountInfo | null = null;
  private network: NetworkInfo | null = null;

  // ==================== Metadata ====================

  async isAvailable(): Promise<boolean> {
    // Check if wallet is accessible
    // For extension: check if window.yourWallet exists
    // For OAuth: always return true
    return typeof window !== 'undefined' && 'yourWallet' in window;
  }

  // ==================== Connection ====================

  async connect(options?: any): Promise<AccountInfo> {
    try {
      if (!(await this.isAvailable())) {
        throw new WalletError('Your Wallet is not available', WalletErrorCode.WALLET_NOT_AVAILABLE);
      }

      // Implement wallet-specific connection logic
      // For extensions: call window.yourWallet.connect()
      // For OAuth: redirect to authorization endpoint

      const result = await this.connectToWallet(options);

      // Store account and network info
      this.account = {
        address: result.address,
        publicKey: result.publicKey,
        network: await this.getNetwork(),
      };

      // Emit event
      this.emit('connect', this.account);

      return this.account;
    } catch (error) {
      // Convert wallet errors to WalletError
      throw this.handleError(error, 'Connection failed');
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Clean up connection
      await this.disconnectFromWallet();

      this.account = null;
      this.emit('disconnect');
    } catch (error) {
      throw this.handleError(error, 'Disconnection failed');
    }
  }

  // ==================== Account & Network ====================

  async getAccount(): Promise<AccountInfo | null> {
    return this.account;
  }

  async fetchAccount(): Promise<AccountInfo | null> {
    if (!this.account) {
      return null;
    }

    try {
      // Verify account is still connected
      const currentAccount = await this.fetchCurrentAccount();

      if (currentAccount.address !== this.account.address) {
        // Account changed
        this.account = {
          ...this.account,
          address: currentAccount.address,
          publicKey: currentAccount.publicKey,
        };
        this.emit('accountChanged', this.account);
      }

      return this.account;
    } catch (error) {
      throw this.handleError(error, 'Account refresh failed');
    }
  }

  async getNetwork(): Promise<NetworkInfo> {
    if (this.network) {
      return this.network;
    }

    // Fetch current network from wallet
    const network = await this.fetchNetworkInfo();
    this.network = network;
    return network;
  }

  // ==================== Signing ====================

  async sign(transaction: any): Promise<SignedTransaction> {
    if (!this.account) {
      throw new WalletError('Not connected', WalletErrorCode.NOT_CONNECTED);
    }

    try {
      const signedTx = await this.signTransaction(transaction);

      return {
        hash: '',
        tx_blob: signedTx.tx_blob,
      };
    } catch (error) {
      throw this.handleError(error, 'Signing failed');
    }
  }

  async signAndSubmit(transaction: any): Promise<SubmittedTransaction> {
    if (!this.account) {
      throw new WalletError('Not connected', WalletErrorCode.NOT_CONNECTED);
    }

    try {
      const signedTx = await this.signTransaction(transaction);
      const submitResult = await this.submitTransaction(signedTx);

      return {
        hash: submitResult.hash,
        id: submitResult.id,
      };
    } catch (error) {
      throw this.handleError(error, 'Signing failed');
    }
  }

  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    if (!this.account) {
      throw new WalletError('Not connected', WalletErrorCode.NOT_CONNECTED);
    }

    try {
      const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);

      const signed = await this.signMessageWithWallet(messageStr);

      return {
        message: messageStr,
        signature: signed.signature,
        publicKey: signed.publicKey,
      };
    } catch (error) {
      throw this.handleError(error, 'Message signing failed');
    }
  }

  // ==================== Events ====================

  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  private emit(event: string, data?: unknown): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach((callback) => callback(data));
    }
  }

  // ==================== Private Helper Methods ====================

  private async connectToWallet(options: any): Promise<any> {
    // Implement wallet-specific connection
    // This is where you call the actual wallet API
    throw new Error('Implement connectToWallet');
  }

  private async disconnectFromWallet(): Promise<void> {
    // Implement wallet-specific disconnection
    throw new Error('Implement disconnectFromWallet');
  }

  private async fetchCurrentAccount(): Promise<any> {
    // Get current account from wallet
    throw new Error('Implement fetchCurrentAccount');
  }

  private async fetchNetworkInfo(): Promise<NetworkInfo> {
    // Get network info from wallet
    throw new Error('Implement fetchNetworkInfo');
  }

  private async signTransaction(transaction: any): Promise<any> {
    // Call wallet to sign transaction
    throw new Error('Implement signTransaction');
  }

  private async submitTransaction(signedTx: any): Promise<any> {
    // Submit transaction to network
    throw new Error('Implement submitTransaction');
  }

  private async signMessageWithWallet(message: string): Promise<any> {
    // Call wallet to sign message
    throw new Error('Implement signMessageWithWallet');
  }

  private handleError(error: any, context: string): WalletError {
    if (error instanceof WalletError) {
      return error;
    }

    // Map wallet-specific errors to WalletError codes
    const message = error?.message || 'Unknown error';
    let code = WalletErrorCode.UNKNOWN_ERROR;

    if (message.includes('user rejected')) {
      code = WalletErrorCode.SIGN_REJECTED;
    } else if (message.includes('not connected')) {
      code = WalletErrorCode.NOT_CONNECTED;
    }

    return new WalletError(`${context}: ${message}`, code);
  }
}
```

#### 3. Create Package.json

**File**: `packages/adapters/your-wallet/package.json`

```json
{
  "name": "@xrpl-connect/adapter-your-wallet",
  "version": "0.1.0",
  "description": "Your Wallet adapter for XRPL Connect",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "vp pack",
    "dev": "vp pack --watch"
  },
  "dependencies": {
    "@xrpl-connect/core": "workspace:*"
  },
  "peerDependencies": {
    "xrpl": "^2.0.0"
  }
}
```

#### 4. Add Adapter to Exports

Update `packages/adapters/index.ts` to export your adapter:

```typescript
export { YourWalletAdapter } from './your-wallet/src/index.js';
```

#### 5. Register in WalletManager

Users can now use your adapter:

```typescript
import { YourWalletAdapter } from '@xrpl-connect/adapters';
import { WalletManager } from '@xrpl-connect/core';

const walletManager = new WalletManager({
  adapters: [new YourWalletAdapter()],
});

const account = await walletManager.connect('your-wallet-id');
```

---

## Error Handling in Adapters

Always convert wallet-specific errors to `WalletError` with appropriate error codes:

```typescript
async connect(options?: any): Promise<AccountInfo> {
  try {
    // Connect logic
    return account;
  } catch (error) {
    // Map specific errors
    if (error.code === 'USER_REJECTED') {
      throw new WalletError(
        'Connection rejected by user',
        WalletErrorCode.CONNECTION_REJECTED
      );
    }

    if (error.code === 'NOT_INSTALLED') {
      throw new WalletError(
        'Wallet extension not found',
        WalletErrorCode.WALLET_NOT_INSTALLED
      );
    }

    // Generic error
    throw new WalletError(
      `Connection failed: ${error.message}`,
      WalletErrorCode.CONNECTION_FAILED,
      { originalError: error }
    );
  }
}
```

---

## Testing Adapters

### Unit Testing Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vite-plus/test';
import { YourWalletAdapter } from './index';
import { WalletErrorCode } from '@xrpl-connect/core';

describe('YourWalletAdapter', () => {
  let adapter: YourWalletAdapter;

  beforeEach(() => {
    adapter = new YourWalletAdapter();
  });

  describe('isAvailable', () => {
    it('should return false if wallet is not available', async () => {
      const available = await adapter.isAvailable();
      expect(available).toBe(false); // Assuming not in test environment
    });
  });

  describe('connect', () => {
    it('should throw if wallet is not available', async () => {
      await expect(adapter.connect()).rejects.toThrow('not available');
    });
  });

  describe('signMessage', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.signMessage('test')).rejects.toThrow(WalletErrorCode.NOT_CONNECTED);
    });
  });

  describe('events', () => {
    it('should emit connect event', (done) => {
      adapter.on('connect', (account) => {
        expect(account.address).toBeDefined();
        done();
      });

      // Trigger connection
      adapter.connect();
    });
  });
});
```

---

## Adapter Directory Structure

```
packages/adapters/
├── xaman/                    # Xaman OAuth adapter
│   ├── src/
│   │   ├── index.ts
│   │   └── types.ts
│   ├── package.json
│   └── tsconfig.json
├── crossmark/                # Crossmark extension adapter
│   ├── src/
│   │   ├── index.ts
│   │   └── types.ts
│   ├── package.json
│   └── tsconfig.json
├── gemwallet/                # GemWallet extension adapter
│   ├── src/
│   │   ├── index.ts
│   │   └── types.ts
│   ├── package.json
│   └── tsconfig.json
├── walletconnect/            # WalletConnect multi-wallet adapter
│   ├── src/
│   │   ├── index.ts
│   │   └── types.ts
│   ├── package.json
│   └── tsconfig.json
├── xyra/                     # Xyra browser adapter
│   ├── src/
│   │   ├── index.ts
│   │   ├── types.ts
|   |   └── xyra-adapter.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── otsu/                     # Otsu extension adapter
│   ├── src/
│   │   ├── index.ts
│   │   ├── types.ts
|   |   └── otsu-adapter.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── index.ts                  # Central export point
└── CODE_DOC.md              # This file
```

---

## Common Patterns

### Browser Extension Adapters

```typescript
// Check for injected provider
async isAvailable(): Promise<boolean> {
  return typeof window !== 'undefined' && 'extensionName' in window;
}

// Listen to extension events
private setupExtensionListeners(): void {
  if (window.extensionName) {
    window.extensionName.on('accountChanged', (account) => {
      this.emit('accountChanged', account);
    });
  }
}
```

### OAuth/API-Based Adapters

```typescript
// Always available if API endpoint is reachable
async isAvailable(): Promise<boolean> {
  return true; // OAuth doesn't require extension
}

// Redirect to authorization endpoint
async connect(options: any): Promise<AccountInfo> {
  const authUrl = `https://api.example.com/auth?...`;
  // OAuth flow handles redirect
}
```

### QR Code Adapters

```typescript
// Notify UI of QR code
private notifyQRCode(uri: string): void {
  if (this.options.onQRCode) {
    this.options.onQRCode(uri);
  }
}

// Wait for user to scan
private waitForScan(requestId: string): Promise<AccountInfo> {
  return new Promise((resolve, reject) => {
    // Poll or use websocket to wait for connection
  });
}
```

---

## Key Design Principles

1. **Implement the Full Interface**: All required methods must be implemented, even if some are no-ops for your wallet type.

2. **Consistent Error Handling**: Always throw `WalletError` with appropriate error codes.

3. **Event Emitter Pattern**: Use the event pattern for wallet state changes (`connect`, `disconnect`, `accountChanged`, `networkChanged`, `error`).

4. **Type Safety**: Export types for your adapter options so users get proper TypeScript support.

5. **Dependency Injection**: Don't hard-code configuration; accept options in the constructor.

6. **Resource Cleanup**: Properly clean up event listeners and connections in `disconnect()`.

7. **No Globals**: Don't rely on global state; encapsulate state in the adapter instance.

---

## Integration Checklist

When creating a new adapter:

- [ ] Implement all methods from `WalletAdapter` interface
- [ ] Handle all error cases with appropriate `WalletErrorCode`
- [ ] Implement event listeners for state changes
- [ ] Add type definitions for adapter-specific options
- [ ] Write unit tests
- [ ] Create package.json with proper exports
- [ ] Document adapter-specific behavior in README
- [ ] Add to main exports in `packages/adapters/index.ts`
- [ ] Test integration with `WalletManager`
- [ ] Test with UI component in `@packages/ui`
