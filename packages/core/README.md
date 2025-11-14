# @xrpl-connect/core - Code Documentation

## Overview

`@xrpl-connect/core` is the foundational framework-agnostic SDK for managing wallet connections across multiple XRPL wallet providers. It provides a centralized `WalletManager` class that orchestrates wallet operations, manages connection state, handles signing/submission, and emits events for wallet lifecycle changes.

**Key Responsibility**: Act as the single source of truth for wallet state and provide a unified interface to interact with any connected XRPL wallet.

---

## Architecture

### Core Classes

#### `WalletManager` (Main Class)

The `WalletManager` is an event emitter that manages all wallet interactions and maintains connection state.

**Extends**: `EventEmitter<WalletEvent>` (from `eventemitter3`)

**Location**: `src/wallet-manager.ts`

---

### Initialization

```typescript
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter, CrossmarkAdapter } from '@xrpl-connect/adapters';

const walletManager = new WalletManager({
  adapters: [
    new XamanAdapter({ apiKey: 'YOUR_API_KEY' }),
    new CrossmarkAdapter()
  ],
  network: 'mainnet',
  autoConnect: true,
  storage: new LocalStorageAdapter(),
  logger: { level: 'debug' }
});
```

**Constructor Options**:

```typescript
interface WalletManagerOptions {
  adapters: WalletAdapter[];              // Array of wallet adapters to register
  network?: NetworkConfig | string;       // Default network ('mainnet', 'testnet', 'devnet')
  autoConnect?: boolean;                  // Attempt to reconnect from stored state
  storage?: StorageAdapter;               // Custom storage implementation (defaults to LocalStorageAdapter)
  logger?: LoggerOptions;                 // Logging configuration
}

interface LoggerOptions {
  level?: 'debug' | 'info' | 'warn' | 'error' | 'none';  // Log level (default: 'info')
}
```

---

## Public API

### Connection Methods

#### `connect(walletId: string, options?: ConnectOptions): Promise<AccountInfo>`

Initiates connection to a specific wallet adapter.

**Parameters**:
- `walletId` (string): The ID of the wallet to connect (e.g., 'xaman', 'crossmark', 'gemwallet', 'walletconnect')
- `options` (optional): Wallet-specific options (e.g., `{ apiKey: 'key' }` for Xaman)

**Returns**: `AccountInfo` containing the connected account details

**Throws**: `WalletError` with specific error codes on failure

**Example**:
```typescript
try {
  const account = await walletManager.connect('xaman', {
    apiKey: process.env.XUMM_API_KEY
  });
  console.log('Connected to:', account.address);
} catch (error) {
  console.error('Connection failed:', error.code);
}
```

**Events Triggered**: `connect` event with AccountInfo

---

#### `disconnect(): Promise<void>`

Disconnects from the currently connected wallet and clears stored connection state.

**Example**:
```typescript
await walletManager.disconnect();
console.log('Disconnected');
```

**Events Triggered**: `disconnect` event

---

#### `reconnect(): Promise<AccountInfo>`

Reconnects to the previously connected wallet using stored state.

**Returns**: `AccountInfo` of the reconnected account

**Throws**: `WalletError` if reconnection fails or no previous connection exists

**Example**:
```typescript
const account = await walletManager.reconnect();
```

**Events Triggered**: `connect` event with AccountInfo

---

### Signing Methods

#### `signAndSubmit(transaction: Transaction, submit?: boolean): Promise<SignedTransaction | SubmittedTransaction>`

Signs a transaction and optionally submits it to the network.

**Parameters**:
- `transaction` (Transaction): An XRPL transaction object
- `submit` (boolean, optional): If `true`, automatically submit after signing. Default: `false`

**Returns**:
- `SignedTransaction` if `submit=false` (contains `tx_blob`, `signature`, etc.)
- `SubmittedTransaction` if `submit=true` (contains `hash`, `id`, etc.)

**Throws**: `WalletError` with `SIGN_FAILED`, `SIGN_REJECTED`, or `NOT_CONNECTED` error codes

**Requires**: Active connection (`walletManager.connected === true`)

**Example**:
```typescript
const txn = {
  TransactionType: 'Payment',
  Account: walletManager.account.address,
  Destination: 'rN7n7otQDd6FczFgLdkqsL...',
  Amount: '1000000',
  Fee: '12',
  Sequence: 1
};

// Sign only
const signed = await walletManager.signAndSubmit(txn, false);
console.log('Signature:', signed.signature);

// Sign and submit
const submitted = await walletManager.signAndSubmit(txn, true);
console.log('Transaction hash:', submitted.hash);
```

**Event Triggered**: None (wallet adapter may emit internal events)

---

#### `signMessage(message: string | Uint8Array): Promise<SignedMessage>`

Signs an arbitrary message (not a transaction).

**Parameters**:
- `message` (string | Uint8Array): The message to sign

**Returns**: `SignedMessage` containing the signature, message, and public key

**Throws**: `WalletError` with `SIGN_FAILED` or `SIGN_REJECTED` error codes

**Example**:
```typescript
const message = 'Sign this message to authenticate';
const signed = await walletManager.signMessage(message);
console.log('Signature:', signed.signature);
console.log('Public Key:', signed.publicKey);
```

---

### Query Methods

#### `getAvailableWallets(): Promise<WalletAdapter[]>`

Returns a filtered list of available (installed/accessible) wallets.

**Returns**: Array of `WalletAdapter` objects whose `isAvailable()` method returns `true`

**Example**:
```typescript
const available = await walletManager.getAvailableWallets();
available.forEach(wallet => {
  console.log(`${wallet.name} (${wallet.id})`);
});
```

---

### State Properties

These are read-only properties representing the current connection state.

#### `connected: boolean`

Indicates if a wallet is currently connected.

```typescript
if (walletManager.connected) {
  console.log('Address:', walletManager.account.address);
} else {
  console.log('No wallet connected');
}
```

---

#### `account: AccountInfo | null`

The current connected account, or `null` if disconnected.

**Type**:
```typescript
interface AccountInfo {
  address: string;              // XRPL address (format: rXXXXXXXXXXXXXXXXXXXXXXX)
  publicKey?: string;           // Optional: account public key
  network: NetworkInfo;         // Connected network details
}
```

**Example**:
```typescript
if (walletManager.account) {
  console.log('Connected to:', walletManager.account.address);
  console.log('Network:', walletManager.account.network.name);
}
```

---

#### `wallet: WalletAdapter | null`

The currently active wallet adapter, or `null` if disconnected.

```typescript
if (walletManager.wallet) {
  console.log('Using:', walletManager.wallet.name);
}
```

---

#### `wallets: WalletAdapter[]`

All registered adapters (both available and unavailable).

```typescript
walletManager.wallets.forEach(adapter => {
  console.log(`${adapter.name} - Available: ${adapter.isAvailable()}`);
});
```

---

## Events

`WalletManager` extends `EventEmitter` and emits the following events:

### `connect` Event

Emitted when a wallet successfully connects.

```typescript
walletManager.on('connect', (account: AccountInfo) => {
  console.log('Connected to:', account.address);
  console.log('Network:', account.network.name);
});
```

**Event Data**: `AccountInfo`

---

### `disconnect` Event

Emitted when a wallet disconnects.

```typescript
walletManager.on('disconnect', () => {
  console.log('Wallet disconnected');
});
```

**Event Data**: None

---

### `accountChanged` Event

Emitted when the user switches accounts in the wallet (if supported).

```typescript
walletManager.on('accountChanged', (account: AccountInfo) => {
  console.log('Account changed to:', account.address);
});
```

**Event Data**: `AccountInfo`

---

### `networkChanged` Event

Emitted when the connected network changes.

```typescript
walletManager.on('networkChanged', (network: NetworkInfo) => {
  console.log('Network changed to:', network.name);
});
```

**Event Data**: `NetworkInfo`

---

### `error` Event

Emitted when an error occurs (connection failed, signing failed, etc.).

```typescript
walletManager.on('error', (error: WalletError) => {
  console.error('Error code:', error.code);
  console.error('Error message:', error.message);
});
```

**Event Data**: `WalletError`

---

## Type Definitions

### NetworkInfo

```typescript
interface NetworkInfo {
  id: string;                   // Unique network identifier ('mainnet', 'testnet', 'devnet', custom ID)
  name: string;                 // Display name (e.g., 'Mainnet')
  wss: string;                  // WebSocket endpoint URL
  rpc?: string;                 // Optional HTTP RPC endpoint
  walletConnectId?: string;     // Optional WalletConnect network ID (e.g., 'xrpl:0')
  chainId?: number;             // Optional chain ID
}
```

---

### Transaction Types

#### SignedTransaction

Result from `signAndSubmit(txn, false)`:

```typescript
interface SignedTransaction {
  hash: string;                 // Transaction hash
  tx_blob?: string;             // Signed transaction blob
  signature?: string;           // Transaction signature
  [key: string]: unknown;       // Additional wallet-specific fields
}
```

---

#### SubmittedTransaction

Result from `signAndSubmit(txn, true)`:

```typescript
interface SubmittedTransaction {
  hash: string;                 // Transaction hash
  id?: string;                  // Optional transaction ID
  [key: string]: unknown;       // Additional submission response data
}
```

---

#### SignedMessage

Result from `signMessage()`:

```typescript
interface SignedMessage {
  message: string;              // Original message
  signature: string;            // Signature hex string
  publicKey: string;            // Public key of signing account
}
```

---

### Error Handling

#### WalletError

All errors thrown by WalletManager are instances of `WalletError`.

```typescript
class WalletError extends Error {
  code: WalletErrorCode;        // Specific error code
  walletId?: string;            // ID of the wallet where error occurred
  originalError?: Error;        // Original error from adapter/wallet
}

enum WalletErrorCode {
  WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
  WALLET_NOT_INSTALLED = 'WALLET_NOT_INSTALLED',
  WALLET_NOT_AVAILABLE = 'WALLET_NOT_AVAILABLE',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_REJECTED = 'CONNECTION_REJECTED',
  SIGN_FAILED = 'SIGN_FAILED',
  SIGN_REJECTED = 'SIGN_REJECTED',
  NETWORK_NOT_SUPPORTED = 'NETWORK_NOT_SUPPORTED',
  NETWORK_MISMATCH = 'NETWORK_MISMATCH',
  NOT_CONNECTED = 'NOT_CONNECTED',
  ALREADY_CONNECTED = 'ALREADY_CONNECTED',
  UNSUPPORTED_METHOD = 'UNSUPPORTED_METHOD',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
```

**Example Error Handling**:

```typescript
import { WalletError, WalletErrorCode } from '@xrpl-connect/core';

try {
  await walletManager.connect('xaman', { apiKey: 'key' });
} catch (error) {
  if (error instanceof WalletError) {
    switch (error.code) {
      case WalletErrorCode.WALLET_NOT_FOUND:
        console.error('Wallet adapter not registered');
        break;
      case WalletErrorCode.CONNECTION_REJECTED:
        console.error('User rejected connection');
        break;
      case WalletErrorCode.NETWORK_NOT_SUPPORTED:
        console.error('Wallet does not support this network');
        break;
      default:
        console.error('Unknown error:', error.message);
    }
  }
}
```

---

## Storage & Persistence

The core package includes a storage abstraction for persisting connection state (used when `autoConnect` is enabled).

### StorageAdapter Interface

```typescript
interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}
```

### Built-in Implementations

#### LocalStorageAdapter (Default)

Uses browser `localStorage` for persistence. Available across page reloads.

```typescript
const manager = new WalletManager({
  adapters: [...],
  storage: new LocalStorageAdapter()  // This is the default
});
```

#### MemoryStorageAdapter

Keeps state in memory only. Lost on page reload.

```typescript
const manager = new WalletManager({
  adapters: [...],
  storage: new MemoryStorageAdapter()  // For SSR or testing
});
```

#### Custom Storage

Implement `StorageAdapter` to use custom storage (e.g., IndexedDB, sessionStorage):

```typescript
class CustomStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    // Implement custom retrieval
    return localStorage.getItem(`custom_${key}`);
  }

  setItem(key: string, value: string): void {
    // Implement custom storage
    localStorage.setItem(`custom_${key}`, value);
  }

  removeItem(key: string): void {
    localStorage.removeItem(`custom_${key}`);
  }

  clear(): void {
    // Clear all stored items
  }
}

const manager = new WalletManager({
  adapters: [...],
  storage: new CustomStorageAdapter()
});
```

---

## Logging

The core includes a configurable logger for debugging.

### Logger Configuration

```typescript
const manager = new WalletManager({
  adapters: [...],
  logger: {
    level: 'debug'  // 'debug', 'info', 'warn', 'error', 'none'
  }
});
```

**Log Levels**:
- `debug`: Verbose output, including adapter calls
- `info`: General information messages
- `warn`: Warning messages
- `error`: Error messages only
- `none`: No logging

---

## Standard Networks

The core exports standard network configurations for convenience:

```typescript
import { STANDARD_NETWORKS } from '@xrpl-connect/core';

const mainnetManager = new WalletManager({
  adapters: [...],
  network: STANDARD_NETWORKS.mainnet
});

const testnetManager = new WalletManager({
  adapters: [...],
  network: STANDARD_NETWORKS.testnet
});

const devnetManager = new WalletManager({
  adapters: [...],
  network: STANDARD_NETWORKS.devnet
});
```

**Available Networks**:
- `mainnet`: Production XRPL network
- `testnet`: XRP Ledger testnet
- `devnet`: XRP Ledger devnet

---

## Advanced Patterns

### Listening to Adapter Events

```typescript
walletManager.on('connect', (account) => {
  console.log('Connected');
});

walletManager.on('accountChanged', (account) => {
  console.log('Account switched');
});

walletManager.on('networkChanged', (network) => {
  console.log('Network changed');
});

walletManager.on('disconnect', () => {
  console.log('Disconnected');
});

walletManager.on('error', (error) => {
  console.error('Error:', error.code, error.message);
});
```

### Graceful Disconnection

```typescript
async function logout() {
  try {
    await walletManager.disconnect();
    // Clear app state
  } catch (error) {
    console.error('Disconnect failed:', error);
  }
}
```

### Network Switching

Some wallets support network switching. Listen for `networkChanged` events:

```typescript
walletManager.on('networkChanged', (network) => {
  if (network.id === 'testnet') {
    console.log('Switched to testnet');
    // Update API endpoints
  }
});
```

---

## File Structure

```
packages/core/src/
├── index.ts                 # Main exports
├── wallet-manager.ts        # WalletManager class (main orchestrator)
├── types.ts                 # TypeScript interfaces and types
├── errors.ts                # WalletError class and error codes
├── storage.ts               # StorageAdapter implementations
├── logger.ts                # Logger utility
└── constants.ts             # Constants (standard networks, etc.)
```

---

## Common Usage Patterns

### Basic Setup

```typescript
import { WalletManager, STANDARD_NETWORKS } from '@xrpl-connect/core';
import { XamanAdapter, CrossmarkAdapter } from '@xrpl-connect/adapters';

const walletManager = new WalletManager({
  adapters: [
    new XamanAdapter({ apiKey: process.env.XUMM_API_KEY }),
    new CrossmarkAdapter()
  ],
  network: STANDARD_NETWORKS.mainnet,
  autoConnect: true
});
```

### Handling Connection

```typescript
try {
  const account = await walletManager.connect('xaman', {
    apiKey: process.env.XUMM_API_KEY
  });
  console.log('Connected:', account.address);
} catch (error) {
  console.error('Failed to connect:', error.message);
}
```

### Signing a Transaction

```typescript
const txn = {
  TransactionType: 'Payment',
  Account: walletManager.account.address,
  Destination: 'rN7n7...',
  Amount: '1000000',
  Fee: '12',
  Sequence: 1
};

try {
  const result = await walletManager.signAndSubmit(txn, true);
  console.log('Submitted:', result.hash);
} catch (error) {
  console.error('Transaction failed:', error.message);
}
```

### State Monitoring

```typescript
// React Hook example
useEffect(() => {
  const onConnect = (account) => setAccount(account);
  const onDisconnect = () => setAccount(null);
  const onError = (error) => setError(error);

  walletManager.on('connect', onConnect);
  walletManager.on('disconnect', onDisconnect);
  walletManager.on('error', onError);

  return () => {
    walletManager.off('connect', onConnect);
    walletManager.off('disconnect', onDisconnect);
    walletManager.off('error', onError);
  };
}, []);
```

---

## Dependency on Adapters

The core package does not directly depend on specific adapter implementations. Instead, adapters are provided at initialization via the `adapters` array. This allows:

- **Flexible adapter selection**: Include only the adapters your app needs
- **Custom adapters**: Implement the `WalletAdapter` interface to add new wallet support
- **Testability**: Mock adapters for unit testing

See `@packages/adapters` documentation for detailed adapter information.
