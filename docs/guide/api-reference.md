# API Reference

Complete documentation for all XRPL Connect APIs.

## WalletManager

The central API for managing wallet connections and signing transactions.

### Constructor

```typescript
const walletManager = new WalletManager(options: WalletManagerConfig)
```

#### Config Options

| Property | Type | Description |
|----------|------|-------------|
| `adapters` | `WalletAdapter[]` | Array of wallet adapters |
| `network` | `'mainnet' \| 'testnet' \| 'devnet'` | XRPL network to connect to |
| `autoConnect` | `boolean` | Auto-reconnect on initialization |
| `logger` | `Logger` | Logger instance for debugging |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `connected` | `boolean` | Whether a wallet is currently connected |
| `account` | `Account \| null` | Currently connected account |
| `wallet` | `Wallet \| null` | Currently connected wallet |
| `adapters` | `WalletAdapter[]` | List of available adapters |

### Methods

#### signAndSubmit()

```typescript
async signAndSubmit(transaction: Transaction): Promise<SubmitResult>
```

Sign and submit a transaction to the ledger.

#### signMessage()

```typescript
async signMessage(message: string): Promise<SignResult>
```

Sign a message using the connected wallet.

#### disconnect()

```typescript
async disconnect(): Promise<void>
```

Disconnect the current wallet and clear stored session.

#### on()

```typescript
on(event: string, listener: Function): void
```

Listen to wallet events.

#### off()

```typescript
off(event: string, listener: Function): void
```

Remove event listener.

#### once()

```typescript
once(event: string, listener: Function): void
```

Listen to event once, then remove listener.

## Web Component: xrpl-wallet-connector

Beautiful UI component for wallet connection.

### Usage

```html
<xrpl-wallet-connector
  id="wallet-connector"
  style="
    --xc-background-color: #1a202c;
    --xc-primary-color: #3b99fc;
  "
  primary-wallet="xaman"
  wallets="xaman,crossmark,walletconnect"
></xrpl-wallet-connector>
```

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `primary-wallet` | `string` | Wallet ID to feature/highlight |
| `wallets` | `string` | Comma-separated list of wallet IDs |

### Methods

#### setWalletManager()

```typescript
setWalletManager(walletManager: WalletManager): void
```

Connect the component to a WalletManager instance.

#### open()

```typescript
async open(): Promise<void>
```

Open the wallet selection modal.

#### close()

```typescript
close(): void
```

Close any open modals.

### Events

#### connecting

Emitted when connecting to a wallet.

```javascript
connector.addEventListener('connecting', (e) => {
  console.log('Connecting to:', e.detail.walletId);
});
```

#### connected

Emitted when successfully connected.

```javascript
connector.addEventListener('connected', (e) => {
  console.log('Connected:', e.detail);
});
```

#### error

Emitted when connection fails.

```javascript
connector.addEventListener('error', (e) => {
  console.error('Error:', e.detail.error.message);
});
```

## Wallet Adapters

Built-in adapters for popular XRPL wallets.

### Xaman Adapter

```typescript
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

const adapter = new XamanAdapter({
  apiKey: 'YOUR_API_KEY', // Get from https://apps.xumm.dev/
  apiSecret: 'YOUR_API_SECRET', // Optional
});
```

**Supported Features:** Transaction signing, message signing, QR codes

**Get API Key:** [https://apps.xumm.dev/](https://apps.xumm.dev/)

### Crossmark Adapter

```typescript
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';

const adapter = new CrossmarkAdapter();
```

**Supported Features:** Transaction signing, message signing

**Website:** [https://crossmark.io/](https://crossmark.io/)

### GemWallet Adapter

```typescript
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';

const adapter = new GemWalletAdapter();
```

**Supported Features:** Transaction signing, message signing

**Website:** [https://gemwallet.com/](https://gemwallet.com/)

### WalletConnect Adapter

```typescript
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';

const adapter = new WalletConnectAdapter({
  projectId: 'YOUR_PROJECT_ID', // Get from https://cloud.walletconnect.com
});
```

**Supported Features:** Transaction signing, message signing, mobile wallets

**Get Project ID:** [https://cloud.walletconnect.com/](https://cloud.walletconnect.com/)

## Types & Interfaces

### Account

```typescript
interface Account {
  address: string;
  network: Network;
}
```

### Network

```typescript
interface Network {
  id: string;
  name: string;
  rpcUrl?: string;
}
```

### Transaction

```typescript
interface Transaction {
  TransactionType: string;
  Account: string;
  [key: string]: any;
}
```

### SubmitResult

```typescript
interface SubmitResult {
  hash?: string;
  tx_blob?: string;
  [key: string]: any;
}
```

### SignResult

```typescript
interface SignResult {
  message: string;
  signature: string;
}
```

### WalletError

```typescript
interface WalletError extends Error {
  code: string;
  details?: any;
}
```

## Events

### WalletManager Events

#### connect

Emitted when a wallet is connected.

```javascript
walletManager.on('connect', (account: Account) => {
  console.log('Connected:', account.address);
});
```

#### disconnect

Emitted when a wallet is disconnected.

```javascript
walletManager.on('disconnect', () => {
  console.log('Disconnected');
});
```

#### error

Emitted when an error occurs.

```javascript
walletManager.on('error', (error: WalletError) => {
  console.error('Error:', error.message);
});
```

#### accountChange

Emitted when the connected account changes.

```javascript
walletManager.on('accountChange', (account: Account) => {
  console.log('Account changed:', account.address);
});
```

#### networkChange

Emitted when the network changes.

```javascript
walletManager.on('networkChange', (network: Network) => {
  console.log('Network changed:', network.name);
});
```

## Error Handling

### Error Codes

| Code | Description | Handling |
|------|-------------|----------|
| `WALLET_NOT_FOUND` | Wallet is not installed or not available | Notify user to install wallet |
| `CONNECTION_FAILED` | Failed to connect to wallet | Retry connection or try different wallet |
| `SIGN_FAILED` | Failed to sign transaction | User rejected or wallet error |
| `INVALID_PARAMS` | Invalid transaction parameters | Check transaction format |
| `NETWORK_ERROR` | Network communication failed | Check connection and retry |

### Error Example

```typescript
try {
  const result = await walletManager.signAndSubmit(transaction);
} catch (error) {
  if (error instanceof WalletError) {
    switch (error.code) {
      case 'WALLET_NOT_FOUND':
        console.log('Please install a wallet');
        break;
      case 'SIGN_FAILED':
        console.log('Transaction was rejected');
        break;
      default:
        console.error('Unexpected error:', error.message);
    }
  }
}
```
