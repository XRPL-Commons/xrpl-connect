---
description: Safely sign transactions, submit transactions, and sign messages with XRPL Connect v1.0.
---

# Transactions and signing

`WalletManager` exposes three operations. Their results and side effects are intentionally different.

| Method                       | Ledger submission | Result                                                                       |
| ---------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `sign(transaction)`          | No                | Signed JSON/blob/signature when supplied by the wallet, plus `signerAddress` |
| `signAndSubmit(transaction)` | Yes               | Transaction hash and wallet-provided signed artifacts                        |
| `signMessage(message)`       | No                | Message signature plus `signerAddress`                                       |

## Sign and submit

```ts
import { WalletErrorCode, isWalletError } from 'xrpl-connect';

async function submitPayment() {
  const account = manager.account;
  if (!account) throw new Error('Connect a wallet first');

  try {
    const result = await manager.signAndSubmit({
      TransactionType: 'Payment',
      Account: account.address,
      Destination: destination,
      Amount: amountInDrops,
    });

    console.log('Submitted transaction:', result.hash);
  } catch (error) {
    if (isWalletError(error) && error.code === WalletErrorCode.SIGN_REJECTED) return;
    throw error;
  }
}
```

A returned hash means the wallet accepted/submitted the transaction according to its protocol. Query a trusted XRPL client when your application needs validated-ledger confirmation.

## Sign without submitting

Use `sign()` when your application submits separately or needs the signed artifact. Wallets expose different artifacts, so check `tx_blob` and `tx_json` instead of assuming one representation:

```ts
const signed = await manager.sign(transaction);

if (signed.tx_blob) {
  await xrplClient.submit(signed.tx_blob);
} else if (signed.tx_json) {
  await xrplClient.submit(xrpl.encode(signed.tx_json));
}
```

## Message signing

Not every XRPL wallet supports arbitrary messages. Gate the UI with `manager.supports('signMessage')` and include domain, origin, purpose, nonce, and expiry in authentication messages to prevent replay.

## Safety checklist

- Validate destination, amount, flags, network, and transaction type before opening the wallet.
- Show users a human-readable summary of what they are signing.
- Never request or handle a seed/private key.
- Treat caught values as `unknown`; narrow with `isWalletError`.
- Distinguish `SIGN_REJECTED` from `SIGN_FAILED` so cancellation does not look like a system failure.
- Do not call signing methods concurrently on the same manager.
