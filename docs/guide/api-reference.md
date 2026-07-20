---
description: Complete API reference documentation for WalletManager, adapters, and all XRPL-Connect components.
---

# API Reference

Complete documentation for all XRPL-Connect APIs.

## WalletManager

The central API for managing wallet connections and signing transactions.

### Constructor

```typescript
const walletManager = new WalletManager(options: WalletManagerOptions)
```

#### Options

| Property      | Type                              | Description                                                                                                                                     |
| ------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `adapters`    | `WalletAdapter[]`                 | Array of wallet adapters to register                                                                                                            |
| `network`     | `NetworkConfig`                   | Default network (a standard id or a custom `NetworkInfo`)                                                                                       |
| `autoConnect` | `boolean`                         | Auto-reconnect from stored session on initialization                                                                                            |
| `storage`     | `StorageAdapter`                  | Custom storage adapter (defaults to `LocalStorageAdapter`)                                                                                      |
| `logger`      | `LoggerOptions \| LoggerInstance` | `{ level?, prefix? }` to configure the built-in logger, or a custom logger object (`{ debug, info, warn, error }`) that receives all log output |

`NetworkConfig` is a string network identifier or a complete `NetworkInfo` object. The built-in standard identifiers are `mainnet`, `testnet`, and `devnet`.

### Properties

| Property    | Type                         | Description                             |
| ----------- | ---------------------------- | --------------------------------------- |
| `connected` | `boolean`                    | Whether a wallet is currently connected |
| `account`   | `AccountInfo \| null`        | Currently connected account             |
| `wallet`    | `WalletAdapter \| null`      | Currently connected wallet adapter      |
| `wallets`   | `WalletAdapter[]`            | Registered adapters as an array         |
| `adapters`  | `Map<string, WalletAdapter>` | Registered adapters keyed by id         |

### Methods

#### connect()

```typescript
async connect(walletId: string, options?: ConnectOptions): Promise<AccountInfo>
```

Connect to a registered adapter by `id` (e.g. `'xaman'`). The availability preflight is bounded by `TIME.AVAILABILITY_TIMEOUT` (one second) and rejects with `WALLET_NOT_AVAILABLE` when the adapter does not respond. Emits `connect` with the account.

`ConnectOptions.skipRequestAccess` is a best-effort request to reuse previously
granted wallet access without displaying another permission prompt. Adapters
whose provider APIs do not support silent access may ignore it.

#### reconnect()

```typescript
async reconnect(): Promise<AccountInfo | null>
```

Reconnect to the previously connected wallet using stored state. Returns `null` when no valid stored session is found.

#### getNetwork()

```typescript
async getNetwork(): Promise<NetworkInfo>
```

Returns the current network reported by the connected adapter. The manager must be connected. Adapter `WalletError` values are preserved; malformed responses and other failures are reported as `UNKNOWN_ERROR`.

#### switchNetwork()

```typescript
async switchNetwork(network: NetworkConfig): Promise<NetworkInfo>
```

Requests a real wallet-side network switch and returns the authoritative network the adapter confirms was applied. The connected adapter must implement `SupportsNetworkSwitch`; otherwise the call rejects with `UNSUPPORTED_METHOD` without changing account or stored state. Successful changes update `account.network`, persist the applied network, and emit `networkChanged` when the network differs.

No bundled adapter currently implements native switching. Check the adapter capability before requesting it:

```typescript
import { supportsNetworkSwitch } from 'xrpl-connect';

const adapter = walletManager.wallet;
if (adapter && supportsNetworkSwitch(adapter)) {
  const applied = await walletManager.switchNetwork('testnet');
  console.log(applied.id);
}
```

| Error                | Meaning                                                |
| -------------------- | ------------------------------------------------------ |
| `NOT_CONNECTED`      | No wallet session is active                            |
| `UNSUPPORTED_METHOD` | The connected adapter cannot request a native switch   |
| `UNKNOWN_ERROR`      | The response is malformed or an untyped failure occurs |

Typed `WalletError` values thrown by the adapter are preserved.

#### sign()

```typescript
async sign(
  transaction: Transaction
): Promise<ManagedSignedTransaction>
```

Sign a transaction without submitting it to the ledger. Depending on the adapter, the result contains the complete signed transaction JSON (`tx_json`), a serialized transaction blob (`tx_blob`), and/or the raw signature. Manager results always contain the address that started the signing request as `signerAddress`, unless the adapter supplies a more specific signer address.

#### signAndSubmit()

```typescript
async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction>
```

Sign and submit a transaction to the ledger. Returns the transaction hash and, depending on the adapter, the signed transaction JSON (`tx_json`), serialized transaction blob (`tx_blob`), and/or raw signature.

#### signMessage()

```typescript
async signMessage(
  message: string | Uint8Array
): Promise<ManagedSignedMessage>
```

Sign a message using the connected wallet. The manager result always contains a
required `signerAddress`.

#### supports()

```typescript
supports(
  capability: keyof WalletCapabilities,
  adapter?: WalletAdapter | null
): boolean
```

Inspect support for `sign`, `signAndSubmit`, or `signMessage` on the connected
wallet, or pass an adapter to inspect it before connection. Returns `false` when
there is neither a connected wallet nor an explicit adapter. Omitted capability
flags use `CAPABILITY_DEFAULTS`, where each signing operation defaults to
`true`. A manager signing method rejects with `UNSUPPORTED_METHOD` before
calling an adapter that explicitly declares the operation unsupported.

#### fetchAccount()

```typescript
async fetchAccount(): Promise<AccountInfo | null>
```

Ask the connected adapter for fresh wallet account and network data, update the
manager cache and persisted session, and emit `accountChanged` and/or
`networkChanged` for differences. The `account` property remains the cached,
synchronous counterpart.

Crossmark, GemWallet, Ledger, Otsu, and Xaman support live refresh.
WalletConnect, Xyra, and custom adapters without `SupportsFetchAccount` reject
with `UNSUPPORTED_METHOD`; the manager does not silently substitute cached
`getAccount()` data. Calling without a connection rejects with `NOT_CONNECTED`.
If the wallet reports no active account, the manager clears the session, emits
`disconnect`, and returns `null`.

#### getAvailableWallets()

```typescript
async getAvailableWallets(): Promise<WalletAdapter[]>
```

Check registered adapters in parallel and return those whose `isAvailable()` resolves to `true` within `TIME.AVAILABILITY_TIMEOUT` (one second). Rejected or timed-out checks are treated as unavailable.

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

| Attribute        | Type     | Description                        |
| ---------------- | -------- | ---------------------------------- |
| `primary-wallet` | `string` | Wallet ID to feature/highlight     |
| `wallets`        | `string` | Comma-separated list of wallet IDs |

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

#### open

Emitted when the wallet selection modal opens.

```javascript
connector.addEventListener('open', () => {
  console.log('Modal opened');
});
```

#### close

Emitted when the modal closes.

```javascript
connector.addEventListener('close', () => {
  console.log('Modal closed');
});
```

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
import { XamanAdapter } from 'xrpl-connect';

const adapter = new XamanAdapter({
  apiKey: 'YOUR_API_KEY', // Get from https://apps.xumm.dev/
  // Optional: customize QR / deep link handling
  // onQRCode: (uri) => { /* ... */ },
  // onDeepLink: (uri) => uri,
});
```

**Supported Features:** Transaction signing, live account refresh, QR codes.
Arbitrary message signing is not supported.

**Get API Key:** [https://apps.xumm.dev/](https://apps.xumm.dev/)

### Crossmark Adapter

```typescript
import { CrossmarkAdapter } from 'xrpl-connect';

const adapter = new CrossmarkAdapter();
```

**Supported Features:** Transaction signing, message signing, live account
refresh

**Website:** [https://crossmark.io/](https://crossmark.io/)

### GemWallet Adapter

```typescript
import { GemWalletAdapter } from 'xrpl-connect';

const adapter = new GemWalletAdapter();
```

**Supported Features:** Transaction signing, message signing, live account
refresh

**Website:** [https://gemwallet.com/](https://gemwallet.com/)

### WalletConnect Adapter

```typescript
import { WalletConnectAdapter } from 'xrpl-connect';

const adapter = new WalletConnectAdapter({
  projectId: 'YOUR_PROJECT_ID', // Get from https://cloud.walletconnect.com
  // Optional
  // metadata: { name: 'My App', description: '...', url: '...', icons: [] },
  // useModal: false,                       // use built-in WalletConnect modal
  // modalMode: 'mobile-only',              // 'mobile-only' | 'always' | 'never'
  // themeMode: 'dark',                     // 'dark' | 'light'
  // onQRCode: (uri) => { /* ... */ },
});
```

**Supported Features:** Transaction signing and mobile wallets. Arbitrary
message signing and live account refresh are not supported.

**Get Project ID:** [https://cloud.walletconnect.com/](https://cloud.walletconnect.com/)

### Ledger Adapter

```typescript
import { LedgerAdapter } from 'xrpl-connect';

const adapter = new LedgerAdapter({
  // Optional
  // derivationPath: "44'/144'/0'/0/0",
  // accountIndex: 0,
  // timeout: 60000,
  // preferWebHID: true,
});
```

**Supported Features:** On-device transaction confirmation, message signing,
live account refresh, and multiple derivation paths. Requires Chrome / Edge /
Opera with WebHID or WebUSB.

### Xyra Adapter

```typescript
import { XyraAdapter } from 'xrpl-connect';

const adapter = new XyraAdapter();
```

**Supported Features:** Transaction signing and message signing. Live account
refresh is not supported.

### Otsu Adapter

```typescript
import { OtsuAdapter } from 'xrpl-connect';

const adapter = new OtsuAdapter();
```

**Supported Features:** Transaction signing, message signing, and live account
refresh

## Direct Wallet SDK Access

`xrpl-connect` exposes the complete upstream APIs used by its Xaman, Crossmark,
and GemWallet adapters. Namespace exports prevent generic upstream names from
colliding with XRPL Connect's own API:

```typescript
import { CrossmarkSDK, GemWalletAPI, XamanOAuth2, XamanSDK } from 'xrpl-connect';

const xaman = new XamanSDK.Xumm('YOUR_API_KEY');
const oauth = new XamanOAuth2.XummPkce('YOUR_API_KEY');
const installed = CrossmarkSDK.default.sync.isInstalled();
const address = await GemWalletAPI.getAddress();
```

The namespaces include every upstream runtime function. Xaman and GemWallet also
preserve their upstream exported types; Crossmark uses equivalent local facade
types because its published declarations reference private package subpaths.

## Types & Interfaces

### WalletCapabilities

```typescript
interface WalletCapabilities {
  sign?: boolean;
  signAndSubmit?: boolean;
  signMessage?: boolean;
}

const CAPABILITY_DEFAULTS = {
  sign: true,
  signAndSubmit: true,
  signMessage: true,
};

function adapterSupports(adapter: WalletAdapter, capability: keyof WalletCapabilities): boolean;
```

Adapters use the optional `capabilities` property to declare operations that
cannot succeed. Missing declarations fall back to `CAPABILITY_DEFAULTS`, so
existing custom adapters retain support for all signing operations. Xaman and
WalletConnect declare `signMessage: false`.

### SupportsFetchAccount

```typescript
interface SupportsFetchAccount {
  fetchAccount(): Promise<AccountInfo | null>;
}

function supportsFetchAccount(
  adapter: WalletAdapter
): adapter is WalletAdapter & SupportsFetchAccount;
```

Use this type guard before calling an adapter's live-refresh method directly.
Crossmark, GemWallet, Ledger, Otsu, and Xaman implement it. WalletConnect and
Xyra do not.

### ConnectOptions

```typescript
type ConnectOptions<WalletSpecificOptions extends Record<string, unknown> = {}> = {
  network?: NetworkConfig;
  autoReconnect?: boolean;
  skipRequestAccess?: boolean;
} & WalletSpecificOptions;
```

`skipRequestAccess` requests silent reuse of permission the user previously
granted. It is a hint rather than a guarantee; unsupported adapters may ignore
it.

### AccountInfo

```typescript
interface AccountInfo {
  address: string;
  publicKey?: string;
  network: NetworkInfo;
}
```

### NetworkInfo

```typescript
interface NetworkInfo {
  id: string;
  name: string;
  wss: string;
  rpc?: string;
  walletConnectId?: string;
}
```

### NetworkConfig

```typescript
type NetworkConfig = string | NetworkInfo;
```

Use a string network identifier or provide a complete custom `NetworkInfo` object. Strings passed through `resolveNetwork()` must exist in `STANDARD_NETWORKS` at call time (`mainnet`, `testnet`, and `devnet` by default). Switch-capable adapters receive `NetworkConfig` directly and define which identifiers they support.

### SupportsNetworkSwitch

```typescript
interface SupportsNetworkSwitch {
  switchNetwork(network: NetworkConfig): Promise<NetworkInfo>;
}

function supportsNetworkSwitch(
  adapter: WalletAdapter
): adapter is WalletAdapter & SupportsNetworkSwitch;
```

This opt-in capability is only for adapters that can request and verify a wallet-side switch. Its method returns the complete network actually applied, which may differ from the requested network.

### Transaction

`Transaction` is an alias for `SubmittableTransaction` from the `xrpl` package — any XRPL transaction object, e.g.:

```typescript
const payment = {
  TransactionType: 'Payment',
  Account: 'r...',
  Destination: 'r...',
  Amount: '1000000',
};
```

### SignedTransaction

```typescript
interface SignedTransaction {
  hash: string;
  tx_blob?: string;
  signature?: string;
  signerAddress?: string;
  tx_json?: Transaction;
  [key: string]: unknown;
}

type ManagedSignedTransaction = SignedTransaction & { signerAddress: string };
```

Direct adapter results keep `signerAddress` optional for backward compatibility.
`WalletManager.sign()` returns `ManagedSignedTransaction`, where it is required.

### SubmittedTransaction

```typescript
interface SubmittedTransaction {
  hash: string;
  id?: string;
  tx_blob?: string;
  signature?: string;
  tx_json?: Transaction;
  [key: string]: unknown;
}
```

### SignedMessage

```typescript
interface SignedMessage {
  message: string;
  signature: string;
  publicKey: string;
  signerAddress?: string;
}

type ManagedSignedMessage = SignedMessage & { signerAddress: string };
```

`WalletManager.signMessage()` returns `ManagedSignedMessage`; direct adapter
results retain the optional base field.

### WalletError

```typescript
class WalletError extends Error {
  readonly code: WalletErrorCode;
  readonly category: WalletErrorCategory;
  readonly originalError?: Error;
}
```

Use `isWalletError(error)` to narrow `unknown` to `WalletError`. For UX decisions, switch on `error.category` (5 high-level buckets); for finer behavior, switch on `error.code`. See [Error Categories](#error-categories) for the recommended UX response per category.

## Events

### WalletManager Events

#### connect

Emitted when a wallet is connected.

```javascript
walletManager.on('connect', (account: AccountInfo) => {
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

#### accountChanged

Emitted when the connected account changes.

```javascript
walletManager.on('accountChanged', (account: AccountInfo) => {
  console.log('Account changed:', account.address);
});
```

#### networkChanged

Emitted for wallet-reported network changes and successful manager-initiated changes. Unsupported switch requests and no-op changes do not emit this event.

```javascript
walletManager.on('networkChanged', (network: NetworkInfo) => {
  console.log('Network changed:', network.name);
});
```

## Error Handling

### Error Categories

`WalletError.category` groups every code into one of five high-level buckets so
consumer apps can drive UX off the _kind_ of failure without enumerating every
code. Each code maps to exactly one category.

| Category             | Meaning                                                                  | Recommended UX                                                                            |
| -------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `USER_ACTION`        | The user explicitly rejected or cancelled.                               | No error toast — return to the previous state silently or show a subtle "cancelled" hint. |
| `WALLET_UNAVAILABLE` | Provider missing, locked, or on the wrong network.                       | Show install / unlock / switch-network instructions. Not retryable in place.              |
| `NETWORK`            | RPC, WebSocket, or transport failure between the app, wallet, or ledger. | Offer a retry. Consider a fallback wallet or RPC.                                         |
| `INVALID_INPUT`      | Programmer error: bad call, missing state, unsupported method.           | Bubble up. Should never reach an end user in a well-formed app — log it.                  |
| `INTERNAL`           | Unexpected failure with no specific category.                            | Surface a generic error and report to your error tracker.                                 |

### Error Codes

All error codes are exposed by the `WalletErrorCode` enum.

| Code                    | Category             | Description                                   | Handling                               |
| ----------------------- | -------------------- | --------------------------------------------- | -------------------------------------- |
| `WALLET_NOT_FOUND`      | `WALLET_UNAVAILABLE` | Adapter not registered with the WalletManager | Check the `adapters` array             |
| `WALLET_NOT_INSTALLED`  | `WALLET_UNAVAILABLE` | Browser extension / app is not installed      | Prompt the user to install the wallet  |
| `WALLET_NOT_AVAILABLE`  | `WALLET_UNAVAILABLE` | Wallet present but not currently usable       | Surface a "wallet unavailable" message |
| `NETWORK_NOT_SUPPORTED` | `WALLET_UNAVAILABLE` | Wallet does not support the requested network | Switch to a supported network          |
| `NETWORK_MISMATCH`      | `WALLET_UNAVAILABLE` | Wallet is connected to a different network    | Ask the user to switch networks        |
| `CONNECTION_REJECTED`   | `USER_ACTION`        | User rejected the connection                  | Allow the user to retry                |
| `SIGN_REJECTED`         | `USER_ACTION`        | User rejected the signing prompt              | Allow the user to retry                |
| `CONNECTION_FAILED`     | `NETWORK`            | Connection to the wallet failed               | Retry or fall back to another wallet   |
| `NOT_CONNECTED`         | `INVALID_INPUT`      | A connection is required but none is active   | Connect before calling the method      |
| `ALREADY_CONNECTED`     | `INVALID_INPUT`      | A wallet is already connected or connecting   | Disconnect first                       |
| `UNSUPPORTED_METHOD`    | `INVALID_INPUT`      | The wallet does not implement this method     | Use a wallet that supports it          |
| `SIGN_FAILED`           | `INTERNAL`           | Signing failed for an unspecified reason      | Retry or surface the original error    |
| `UNKNOWN_ERROR`         | `INTERNAL`           | Unhandled error from the adapter              | Inspect `originalError`                |

### Error Example

Most app code only needs the category:

```typescript
import { WalletErrorCategory, isWalletError } from 'xrpl-connect';

try {
  await walletManager.signAndSubmit(transaction);
} catch (error) {
  if (!isWalletError(error)) throw error;

  switch (error.category) {
    case WalletErrorCategory.USER_ACTION:
      // Cancelled by the user — no toast.
      break;
    case WalletErrorCategory.WALLET_UNAVAILABLE:
      showInstallOrSwitchNetworkPrompt(error);
      break;
    case WalletErrorCategory.NETWORK:
      offerRetry(error);
      break;
    case WalletErrorCategory.INVALID_INPUT:
    case WalletErrorCategory.INTERNAL:
      reportToErrorTracker(error);
      break;
  }
}
```

For finer-grained behavior, fall back to `error.code`:

```typescript
import { WalletErrorCode, isWalletError } from 'xrpl-connect';

try {
  await walletManager.signAndSubmit(transaction);
} catch (error) {
  if (isWalletError(error)) {
    switch (error.code) {
      case WalletErrorCode.WALLET_NOT_INSTALLED:
        console.log('Please install a wallet');
        break;
      case WalletErrorCode.SIGN_REJECTED:
        console.log('Transaction was rejected');
        break;
      default:
        console.error('Unexpected error:', error.message, error.originalError);
    }
  }
}
```
