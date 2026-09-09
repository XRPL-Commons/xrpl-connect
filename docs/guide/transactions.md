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

Use `sign()` when your application submits separately or needs the signed artifact. Wallets expose different artifacts, so check `tx_blob` and `tx_json` instead of assuming one representation. A `Signers` array may represent one contribution or a fully combined multisigned transaction; the artifact alone does not prove that the account's signer quorum is satisfied:

```ts
const signed = await manager.sign(transaction);
const signedBlob = signed.tx_blob ?? (signed.tx_json ? xrpl.encode(signed.tx_json) : undefined);

if (!signedBlob) throw new Error('Wallet did not return a signed artifact');

const signedJson = signed.tx_json ?? xrpl.decode(signedBlob);
if (Array.isArray(signedJson.Signers)) {
  throw new Error('Verify this multisigned artifact is complete before submitting');
}

await xrplClient.submit(signedBlob);
```

Submit a multisigned artifact only after the adapter-specific flow has combined
all required contributions. The generic result does not contain the account's
signer-list quorum, so it cannot determine submission readiness by itself.

### Xaman expiry policy

::: warning Release availability
This policy is an unreleased change after `1.0.0-rc.2`. RC2 requires exact matching
of supplied expiry values even when Xaman adjusts them.
:::

For `sign()` only, Xaman may increase a supplied absolute `LastLedgerSequence` by
**up to 50 ledgers by default**. This is an extension beyond the requested expiry,
not a 50-ledger deadline measured from signing time. Configure it on the adapter:

```ts
const xaman = new XamanAdapter({
  apiKey: 'YOUR_KEY',
  maxLastLedgerSequenceExtension: 50, // Default; use 0 for exact expiry matching
});
```

For a requested expiry of `10_000_020`, the default accepts an actual signed expiry
from `10_000_020` through `10_000_070`, inclusive. A decrease, missing expiry, or a
larger extension fails with `SIGN_FAILED`. The limit must be an integer from `0`
through `4_294_967_295`; invalid configuration throws `RangeError` at construction.

The adapter checks the expiry in both the resolved request and the decoded,
cryptographically verified signed blob. Other supplied transaction fields remain
strictly compared. The original caller object is not modified. Use the returned
`signed.tx_json.LastLedgerSequence` (or decode `signed.tx_blob`) when recording
the actual deadline; do not record the originally requested expiry as the signed one.

Supply an **absolute** expiry to get this bound, for example by preparing the
transaction with your XRPL client's `autofill()` before calling `sign()`:

```ts
const prepared = await xrplClient.autofill(transaction);
const signed = await manager.sign(prepared);
```

Supplied values must be integers between `32570` and `4_294_967_295`.
Xaman treats smaller values as relative offsets; `sign()` rejects those before
opening a signing request because their absolute deadline cannot be bounded from
the request alone. If you **omit** expiry, wallet autofill remains supported, but
there is no requested absolute deadline to enforce this extension limit against.
The setting does not introduce an RPC lookup or guarantee that a deadline is still
in the future. Multisigning and Batch require exact matching of supplied expiry
even when the configured allowance is nonzero.

`signAndSubmit()` remains wallet-owned: Xaman signs and broadcasts. It does not
apply this allowance or compare the result with the original request after
submission. Signature, signer, hash, network, and dispatch-result checks remain.
Use `sign()` followed by application submission when you need the expiry policy
enforced before broadcasting. A `signAndSubmit()` error is not proof that nothing
was submitted; reconcile the outcome before asking the user to sign again.

### Ledger multisign contributions

Ledger supports parallel multisigning through `sign()`. Prepare the transaction
once with the total signer count so its fee and all other fields are identical
for every signer. Each result contains one verified `Signers` entry; combine the
blobs and submit the final transaction yourself:

```ts
const prepared = await xrplClient.autofill(
  {
    TransactionType: 'Payment',
    Account: multisignAccount,
    Destination: destination,
    Amount: amountInDrops,
    SigningPubKey: '',
  },
  2
);

const ledgerContribution = await manager.sign(prepared);
const combinedBlob = xrpl.multisign([ledgerContribution.tx_blob!, otherSignerContributionBlob]);

await xrplClient.submitAndWait(combinedBlob);
```

Do not pass an existing `TxnSignature` or `Signers` array to Ledger. Its
`sign()` path also rejects multisign input without `Fee` and `Sequence`; it never
autofills a contribution independently. `signAndSubmit()` rejects multisign input
because one contribution may not satisfy the account's signer quorum.

## Message signing

Not every XRPL wallet supports arbitrary messages. Gate the UI with `manager.supports('signMessage')` and include domain, origin, purpose, nonce, and expiry in authentication messages to prevent replay.

## Safety checklist

- Validate destination, amount, flags, network, and transaction type before opening the wallet.
- Show users a human-readable summary of what they are signing.
- Never request or handle a seed/private key.
- Treat caught values as `unknown`; narrow with `isWalletError`.
- Distinguish `SIGN_REJECTED` from `SIGN_FAILED` so cancellation does not look like a system failure.
- Do not call signing methods concurrently on the same manager.
