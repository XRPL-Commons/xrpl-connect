# @xrpl-connect/adapter-clasp

[Clasp](https://claspwallet.com) adapter for XRPL Connect.

Clasp is a passkey wallet that runs in the browser. It has no extension and stores no private key:
a passkey derives a standard XRPL family seed (`sEd…`), so the same account also opens in Xaman or
Joey. The wallet opens in a popup on claspwallet.com, shows the requesting origin and every field
of the transaction, and one passkey touch approves it.

## Features

- Nothing to install: a popup and a passkey
- One passkey touch per approval, with the requesting origin and the whole transaction shown
- Sign, and sign-and-submit; `Account`, `Sequence`, `Fee` and `LastLedgerSequence` are filled in only
  where the transaction leaves them out
- Session restore without a popup
- Built on [`clasp-connect`](https://github.com/claspwallet/clasp-connect), Clasp's own SDK (MIT,
  no runtime dependencies)

## Installation

```bash
npm install @xrpl-connect/adapter-clasp
# or
pnpm add @xrpl-connect/adapter-clasp
```

## Usage

### Basic Setup

```typescript
import { WalletManager } from '@xrpl-connect/core';
import { ClaspAdapter } from '@xrpl-connect/adapter-clasp';

const walletManager = new WalletManager({
  adapters: [new ClaspAdapter()],
  network: 'testnet',
});

const account = await walletManager.connect('clasp');
console.log('Connected:', account.address);
```

The adapter is included in `createAdapters()` and in the `<xrpl-wallet-connector>` picker.

### Sign a Transaction

```typescript
const signed = await walletManager.sign({
  TransactionType: 'Payment',
  Destination: 'rDestination...',
  Amount: '1000000',
});
console.log(signed.tx_blob); // nothing was submitted

const submitted = await walletManager.signAndSubmit({
  TransactionType: 'Payment',
  Destination: 'rDestination...',
  Amount: '1000000',
});
console.log(submitted.hash);
```

Every signing request names the connected address. If the user's passkey opens a different
account, Clasp signs nothing and the request rejects with `SIGN_FAILED`.

`sign()` returns the signed transaction without submitting it, and the popup tells the user that
your app will send it. When Clasp filled in `LastLedgerSequence`, the signature expires a few
ledgers later, so submit it promptly.

`signAndSubmit()` resolves only when the ledger validated the transaction with `tesSUCCESS`. A
transaction the ledger applied with a `tec` result rejects with `SIGN_FAILED`, naming the result
code and the transaction hash. A submission Clasp could not confirm also rejects, but it may still
apply: check the transaction hash in the error message before retrying. Both are preserved on
`error.originalError.transaction`.

## Configuration Options

```typescript
interface ClaspAdapterOptions {
  timeoutMs?: number; // how long one request may wait for the user, defaults to 300000
}
```

There is no URL option. A Clasp passkey belongs to claspwallet.com, so a wallet at any other
address would hold none of the user's accounts.

## Networks

`mainnet` and `testnet`, the two networks Clasp signs on. It chooses its own servers, so `devnet`
and a custom `NetworkInfo` are refused with `NETWORK_NOT_SUPPORTED` before any popup opens.

## Reconnection

The `WalletManager` stores the connected address and public key and restores them without a
popup. The next signature proves control: it names the address, and Clasp signs only if the
passkey opens that account.

## Error Handling

| Situation                                       | Error code                                   |
| ----------------------------------------------- | -------------------------------------------- |
| The user declined or closed the popup           | `CONNECTION_REJECTED` / `SIGN_REJECTED`      |
| The browser blocked the popup                   | `WALLET_NOT_AVAILABLE`                       |
| No answer before `timeoutMs`                    | `OPERATION_TIMEOUT`                          |
| `devnet` or a custom network                    | `NETWORK_NOT_SUPPORTED`                      |
| The passkey opens a different account           | `SIGN_FAILED`, nothing signed                |
| The ledger applied the transaction with a `tec` | `SIGN_FAILED`, with the result code and hash |
| Submission not confirmed                        | `SIGN_FAILED`, with the hash to check        |
| `signMessage`                                   | `UNSUPPORTED_METHOD`                         |

## Browser Support

Any browser with passkeys and the WebAuthn PRF extension. Call `connect`, `sign` and
`signAndSubmit` from a click handler: the popup opens inside the user's gesture, and Safari blocks
it otherwise. An app served with `Cross-Origin-Opener-Policy: same-origin` severs the popup's
opener and cannot be answered; `same-origin-allow-popups` works. After a request the Clasp window
stays open briefly, so a connect followed by a signature reuses the same window.

## License

MIT
