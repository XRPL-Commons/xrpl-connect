# @xrpl-connect/adapter-ledger

Ledger hardware wallet adapter for XRPL Connect.

## Features

- 🔒 **Secure hardware wallet integration** - Connect to Ledger devices
- 🔌 **WebHID & WebUSB support** - Works with modern browsers
- 📱 **Device state detection** - Automatically detects locked, unlocked, and app states
- ✍️ **Transaction signing** - Sign XRPL transactions with physical confirmation
- 🎯 **BIP44 derivation** - Customizable derivation paths
- ⏱️ **Configurable timeouts** - Adjust for user confirmation time

## Installation

```bash
npm install @xrpl-connect/adapter-ledger
# or
pnpm add @xrpl-connect/adapter-ledger
# or
yarn add @xrpl-connect/adapter-ledger
```

## Usage

### Basic Setup

```typescript
import { WalletManager } from '@xrpl-connect/core';
import { LedgerAdapter } from '@xrpl-connect/adapter-ledger';

const walletManager = new WalletManager({
  adapters: [
    new LedgerAdapter({
      // Optional: customize derivation path (default: "44'/144'/0'/0/0")
      derivationPath: "44'/144'/0'/0/0",

      // Optional: timeout for operations in ms (default: 60000)
      timeout: 60000,

      // Optional: prefer WebHID over WebUSB (default: true)
      preferWebHID: true,
    }),
  ],
  network: 'mainnet',
});
```

### Connect to Ledger

```typescript
// This will prompt user to select their Ledger device
const account = await walletManager.connect('ledger');

console.log('Connected:', account.address);
```

### Sign a Transaction

```typescript
const result = await walletManager.signAndSubmit({
  TransactionType: 'Payment',
  Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3KeKniv',
  Amount: '1000000',
});

console.log('Transaction hash:', result.hash);
```

### Multi-Signature Transactions

The Ledger adapter supports both single-signature and multi-signature transactions:

**Single-signature (default):**

- The Ledger device signs and submits the transaction directly
- `SigningPubKey` is set to the device's public key
- Transaction is broadcast to the network automatically

**Multi-signature:**

- Set `SigningPubKey` to an empty string in your transaction
- The Ledger signs but doesn't submit automatically
- You collect signatures from multiple signers
- Build the final transaction with all signatures in the `Signers` array

```typescript
// Multi-sig example: Sign without submitting
const result = await adapter.signAndSubmit(
  {
    TransactionType: 'Payment',
    Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3KeKniv',
    Amount: '1000000',
    SigningPubKey: '', // Empty for multisig
    Fee: '30', // Higher fee for multisig : Base fee (10 drops) + (10 drops per signer in quorum)
  },
  false
); // Don't submit yet

// The result contains the signed tx_blob
// Now collect other signatures and build final transaction with Signers array
```

### Check Device State

```typescript
import { LedgerAdapter, LedgerDeviceState } from '@xrpl-connect/adapter-ledger';

const adapter = new LedgerAdapter();
const state = await adapter.getDeviceState();

switch (state) {
  case LedgerDeviceState.NOT_CONNECTED:
    console.log('Please connect your Ledger device');
    break;
  case LedgerDeviceState.LOCKED:
    console.log('Please unlock your Ledger device');
    break;
  case LedgerDeviceState.APP_NOT_OPEN:
    console.log('Please open the XRP app on your Ledger');
    break;
  case LedgerDeviceState.READY:
    console.log('Device is ready!');
    break;
}
```

## Configuration Options

### `LedgerAdapterOptions`

| Option           | Type      | Default             | Description                                                                                    |
| ---------------- | --------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| `derivationPath` | `string`  | `"44'/144'/0'/0/0"` | BIP44 derivation path for XRP account (overrides accountIndex)                                 |
| `accountIndex`   | `number`  | `0`                 | Account index for path generation (44'/144'/N'/0/0) - only used if derivationPath not provided |
| `timeout`        | `number`  | `60000`             | Timeout for operations in milliseconds                                                         |
| `preferWebHID`   | `boolean` | `true`              | Prefer WebHID over WebUSB when both available                                                  |

### Examples

**Using account index (recommended):**

```typescript
// Account 0 (default): 44'/144'/0'/0/0
const adapter1 = new LedgerAdapter({ accountIndex: 0 });

// Account 1: 44'/144'/1'/0/0
const adapter2 = new LedgerAdapter({ accountIndex: 1 });

// Account 5: 44'/144'/5'/0/0
const adapter3 = new LedgerAdapter({ accountIndex: 5 });
```

**Using custom derivation path:**

```typescript
const adapter = new LedgerAdapter({
  derivationPath: "44'/144'/10'/0/0",
});
```

### Retrieving Multiple Accounts

Use `getAccounts()` to retrieve multiple account addresses for account selection UI:

```typescript
const adapter = new LedgerAdapter();

// Get 5 accounts starting from index 0
const accounts = await adapter.getAccounts(5, 0);

// Display accounts to user
accounts.forEach((account) => {
  console.log(`Account ${account.index}: ${account.address}`);
  console.log(`  Path: ${account.path}`);
});

// Example output:
// Account 0: rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT
//   Path: 44'/144'/0'/0/0
// Account 1: rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY
//   Path: 44'/144'/1'/0/0
// ...

// User selects account 2, now connect with that account:
const selectedAdapter = new LedgerAdapter({ accountIndex: 2 });
await walletManager.connect(selectedAdapter);
```

## Device States

The adapter automatically detects and reports the following device states:

### `LedgerDeviceState`

- **`NOT_CONNECTED`** - Device is not connected via USB
- **`LOCKED`** - Device is connected but locked (PIN required)
- **`APP_NOT_OPEN`** - Device is unlocked but XRP app is not open
- **`READY`** - Device is ready (unlocked and XRP app open)
- **`UNKNOWN`** - Unknown state or error

## Browser Support

| Browser     | WebHID | WebUSB | Support       |
| ----------- | ------ | ------ | ------------- |
| Chrome/Edge | ✅     | ✅     | Full support  |
| Opera       | ✅     | ✅     | Full support  |
| Firefox     | ❌     | ❌     | Not supported |
| Safari      | ❌     | ❌     | Not supported |

### Requirements

- **HTTPS required** (localhost is OK for development)
- **User interaction required** - Device access must be triggered by user action (e.g., button click)
- **Ledger Live** - Close Ledger Live if it's running (conflicts with WebHID/WebUSB)

## Error Handling

The adapter provides user-friendly error messages for common issues:

```typescript
try {
  await walletManager.connect('ledger');
} catch (error) {
  console.error(error.message);
  // Examples:
  // "Please connect your Ledger device via USB"
  // "Please unlock your Ledger device by entering your PIN"
  // "Please open the XRP application on your Ledger device"
}
```

## Device State Messages

Built-in user-friendly messages for each state:

```typescript
import { LEDGER_STATE_MESSAGES } from '@xrpl-connect/adapter-ledger';

// Access messages
console.log(LEDGER_STATE_MESSAGES[LedgerDeviceState.LOCKED]);
// "Please unlock your Ledger device by entering your PIN"
```

## BIP44 Derivation Paths

XRP uses the following BIP44 path structure:

```
m/44'/144'/account'/change/address_index
```

Default path: `44'/144'/0'/0/0`

- `44'` - BIP44 purpose
- `144'` - XRP coin type
- `0'` - Account index (hardened)
- `0` - Change (0 = external, 1 = internal)
- `0` - Address index

### Multiple Accounts

To use different accounts from the same device:

```typescript
// First account
const adapter1 = new LedgerAdapter({
  derivationPath: "44'/144'/0'/0/0",
});

// Second account
const adapter2 = new LedgerAdapter({
  derivationPath: "44'/144'/1'/0/0",
});
```

## Advanced Usage

### Custom Transport Selection

```typescript
const adapter = new LedgerAdapter({
  // Force WebUSB instead of WebHID
  preferWebHID: false,
});
```

### Extended Timeout for Slow Users

```typescript
const adapter = new LedgerAdapter({
  // 2 minutes for users who need more time
  timeout: 120000,
});
```

### Monitoring Connection State

```typescript
// Check if Ledger support is available
const isAvailable = await adapter.isAvailable();
console.log('Ledger support:', isAvailable ? 'Yes' : 'No');

// Get current device state
const state = await adapter.getDeviceState();
console.log('Device state:', state);
```

## Troubleshooting

### "No compatible transport available"

**Solution**: Make sure you're using a supported browser (Chrome, Edge, or Opera) and the site is served over HTTPS.

### "Please close Ledger Live"

**Solution**: Ledger Live conflicts with WebHID/WebUSB. Close Ledger Live before connecting.

### Connection works but signing fails

**Solution**: Make sure the XRP app is still open on the device and the device hasn't gone to sleep mode.

### Transaction approval timeout

**Solution**: Increase the `timeout` option if users need more time to review transactions on the device.

## Security Notes

- 🔐 **Private keys never leave the device** - All signing happens on the Ledger hardware
- ✅ **Physical confirmation required** - Users must approve each transaction on the device
- 🔒 **PIN protection** - Device is protected by user's PIN code
- 📱 **No API keys required** - Direct device communication, no third-party services

## Resources

- [Ledger Official Website](https://www.ledger.com)
- [Ledger Developer Portal](https://developers.ledger.com)
- [XRP App Documentation](https://github.com/LedgerHQ/app-xrp)
- [XRPL Connect Documentation](https://github.com/XRPL-Commons/xrpl-connect)

## License

MIT License - see the [LICENSE](./LICENSE) file for details
