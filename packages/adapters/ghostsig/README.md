# @xrpl-connect/adapter-ghostsig

[GHOSTSIG](https://ghostsig.dev) adapter for XRPL Connect.

GHOSTSIG is a hosted passkey wallet. It has no extension and no stored private key: a passkey's
PRF output is expanded into an ed25519 key for one signature and zeroed. The wallet opens in a
popup on ghostsig.dev, the signing digest is the WebAuthn challenge, and one passkey prompt
approves one transaction.

## Features

- Nothing to install: a popup and a passkey
- One passkey prompt per signature, with the requesting origin shown in the popup
- Sign and sign-and-submit; a missing Sequence, Fee or LastLedgerSequence is filled in from the ledger
- Session restore without a popup
- No dependency beyond `@xrpl-connect/core`

## Installation

```bash
npm install @xrpl-connect/adapter-ghostsig
# or
pnpm add @xrpl-connect/adapter-ghostsig
```

## Usage

### Basic Setup

```typescript
import { WalletManager } from '@xrpl-connect/core';
import { GhostsigAdapter } from '@xrpl-connect/adapter-ghostsig';

const walletManager = new WalletManager({
  adapters: [new GhostsigAdapter()],
  network: 'testnet',
});

const account = await walletManager.connect('ghostsig');
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
console.log(signed.tx_blob);

const submitted = await walletManager.signAndSubmit({
  TransactionType: 'Payment',
  Destination: 'rDestination...',
  Amount: '1000000',
});
console.log(submitted.hash, submitted.submitted);
```

Every signing request names the connected address, and a reply for another address is refused.

`signAndSubmit()` resolves only when the wallet confirms successful ledger validation.
Known non-submission outcomes (including offline, unsent, and handed-back signatures)
reject with `SIGN_FAILED`. Missing or uncertain confirmation also rejects, but does
not mean the transaction failed to reach the ledger: check the transaction hash in
the error message before retrying. The signed transaction and wallet outcome are
preserved on `error.originalError.transaction`. Use `sign()` when you want a signed
transaction or a partial signature without requiring submission.

## Configuration Options

```typescript
interface GhostsigAdapterOptions {
  url?: string; // the wallet page, defaults to https://ghostsig.dev/?connect
  timeoutMs?: number; // how long one request may wait for the user, defaults to 60000
}
```

## Networks

`mainnet`, `testnet` and `devnet`. GHOSTSIG connects to its own nodes, so a custom `NetworkInfo`
is refused with `NETWORK_NOT_SUPPORTED`.

## Reconnection

The `WalletManager` stores the connected address and public key and restores them without a
popup. The next signature proves control: the wallet checks the derived key at every prompt.

## Error Handling

| Situation                                        | Error code                                         |
| ------------------------------------------------ | -------------------------------------------------- |
| The user declined the prompt or closed the popup | `CONNECTION_REJECTED` / `SIGN_REJECTED`            |
| The browser blocked the popup                    | `WALLET_NOT_AVAILABLE`                             |
| The ledger refused a submitted transaction       | `SIGN_FAILED`, with the result code in the message |
| `signMessage`                                    | `UNSUPPORTED_METHOD`                               |

## Browser Support

Any browser with passkeys and the WebAuthn PRF extension: current Chrome, Safari and Firefox on
desktop and mobile. The popup opens inside the user's click, so the adapter never awaits before
opening. An app served with `Cross-Origin-Opener-Policy: same-origin` severs the popup's opener
and cannot be answered; `same-origin-allow-popups` works. After a connect the popup stays open
briefly, so a connect followed by a signature needs one popup.

## License

MIT
