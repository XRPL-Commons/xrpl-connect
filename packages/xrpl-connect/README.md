# xrpl-connect

Internal facade over XRPL address/key management, balances, payments, and trust lines.
This is the **only** entry point meant to be imported from outside this workspace —
`@xrpl-connect/core`, `@xrpl-connect/ui`, and the `@xrpl-connect/adapter-*` packages are
implementation details of the wider monorepo and are not part of this package's API.

> If you're looking for the wallet-*connection* toolkit (`WalletManager`, browser wallet
> adapters like Xaman/Crossmark/GemWallet, the `<xrpl-wallet-connector>` UI component),
> that's a different concern — this package doesn't touch it. `xrpl-connect` here is for
> code that already holds a seed/private key (generated or imported) and wants to derive
> addresses, read balances, and sign+submit transactions directly, without a browser
> extension or mobile wallet in the loop.

## Install

Within this workspace, add it as a dependency via the `workspace:*` protocol:

```json
{
  "dependencies": {
    "xrpl-connect": "workspace:*"
  }
}
```

## Quick start

```typescript
import { Address, Accounts, Payments } from 'xrpl-connect';

// 1. Generate a wallet
const { address, seed } = Address.generate();

// 2. Read its balance
const { xrp } = await Accounts.getXrpBalance(address, 'testnet');
console.log(`${address} holds ${xrp} XRP`);

// 3. Send a payment
const result = await Payments.sendXrp({
  credential: { seed },
  destination: 'rDestinationAddress...',
  amountXrp: '10',
  network: 'testnet',
});
console.log(result.engineResult); // e.g. 'tesSUCCESS'
```

Every method that talks to the network is `async`, opens its own connection, and closes
it when it resolves or rejects — there's no client to manage yourself. Everything
defaults to **testnet** unless you pass `network: 'mainnet' | 'testnet' | 'devnet'`
(or a custom `NetworkInfo` object with your own `wss` endpoint).

## `Address` — keys, no network

Pure local cryptography — nothing here touches the network. `generate()` makes a brand
new wallet; the four `import*` methods recover one from a secret you already have, each
validating its input the way the real thing is actually formatted.

```typescript
Address.generate(algorithm?: 'ed25519' | 'ecdsa-secp256k1'): GeneratedAddress
// { address, publicKey, privateKey, seed }

Address.importBySeed(seed: string): ImportedAddress
Address.importByMnemonic(mnemonic: string | string[]): ImportedAddress // BIP-39, 12/15/18/21/24 words
Address.importByHex(privateKeyHex: string): ImportedAddress            // 'ED' + 64 hex chars
Address.importByXaman(secretNumbers: string[]): ImportedAddress        // 8 groups of 6 digits
// ImportedAddress = { address, publicKey, privateKey, seed? }
```

- `importByHex()` has no `seed` in its result — a raw ed25519 private key can't be
  derived back into an XRPL family seed.
- `importBySeed()` auto-detects `ed25519` vs `ecdsa-secp256k1` from the seed's own
  encoded version byte — you never need to pass the algorithm yourself.
- Every method throws a plain `Error` with a human-readable `message` when the input is
  malformed (wrong shape, bad BIP-39 checksum, bad Xaman checksum digit, etc.) — nothing
  is silently coerced.

## `Accounts` — read-only balance lookups

```typescript
Accounts.getXrpBalance(address: string, network?: NetworkConfig): Promise<XrpBalance>
// { drops, xrp }

Accounts.getTokenBalances(address: string, network?: NetworkConfig): Promise<TokenBalance[]>
// { currency, issuer, balance }[]

Accounts.getMptBalances(address: string, network?: NetworkConfig): Promise<MptBalance[]>
// { mptIssuanceId, value, locked? }[]
```

An account that doesn't exist on the ledger yet (never received a funding payment)
rejects with the ledger's own `actNotFound` error for `getXrpBalance()` — it isn't
special-cased into a zero balance.

## `Payments` — sign and submit

All three take a `credential` (see below), wait for the transaction to validate, and
resolve to the same `TxResult` shape — they never throw for an on-ledger failure (an
insufficient balance, a missing trust line, ...); check `engineResult` for that.

```typescript
Payments.sendXrp({ credential, destination, amountXrp, destinationTag?, network? }): Promise<TxResult>
Payments.sendToken({ credential, destination, currency, issuer, value, destinationTag?, network? }): Promise<TxResult>
Payments.sendMpt({ credential, destination, mptIssuanceId, value, destinationTag?, network? }): Promise<TxResult>
// TxResult = { hash, engineResult, validated }
```

`amountXrp` is in XRP, not drops (`Payments.sendXrp` converts it for you). `sendMpt()`
requires the destination to already hold an authorized `MPToken` for that issuance — see
`TrustLines.setMptTrustLine()`.

## `TrustLines` — issued-currency trust lines and the MPT equivalent

```typescript
TrustLines.getTrustLines(address: string, network?: NetworkConfig): Promise<TrustLine[]>
// { currency, issuer, balance, limit, limitPeer, noRipple?, frozen? }[]

TrustLines.setTokenTrustLine({ credential, currency, issuer, limit, network? }): Promise<TxResult>
// TrustSet — limit: '0' resizes the line down to removed

TrustLines.setMptTrustLine({ credential, mptIssuanceId, authorize?, network? }): Promise<TxResult>
// MPTokenAuthorize — authorize defaults to true; pass false to opt back out
```

MPTs don't use `TrustSet` — `MPTokenAuthorize` is the equivalent "I'm willing to hold
this" opt-in, required once before an account can be the destination of `sendMpt()`.

## Signing credentials

`Payments` and `TrustLines` sign with whatever `Address` gave you — pass it straight
through, no reshaping needed:

```typescript
type SigningCredential = { seed: string } | { publicKey: string; privateKey: string };
```

- `Address.generate()` / `importBySeed()` / `importByMnemonic()` / `importByXaman()` →
  `{ seed: result.seed }`
- `Address.importByHex()` (no seed) → `{ publicKey: result.publicKey, privateKey: result.privateKey }`

## Networks

Every network-touching method takes an optional last `network` argument (or a `network`
field in its params object), defaulting to **`'testnet'`**:

```typescript
type NetworkConfig = 'mainnet' | 'testnet' | 'devnet' | NetworkInfo; // NetworkInfo from '@xrpl-connect/core'
```

Pass a custom `NetworkInfo` (`{ id, name, wss, ... }`) to point at your own rippled
node instead of the standard public endpoints. An unrecognized network name string
rejects with a `WalletError` (from `@xrpl-connect/core`'s own `resolveNetwork()` —
still a plain `Error` under the hood, with `.message`, plus `.code`/`.category`).

## Handling private keys/seeds

Every `Address` result and every `SigningCredential` carries a private key or seed in
plain text. That's fine for scripts, tests, and this package's own demo — never log,
store unencrypted, or display these in a real product without thinking through where
they end up.

## Browser bundling

`Address.importByMnemonic()` and `Address.importByXaman()` pull in `bip39`, which needs
Node's `Buffer`/`crypto` polyfilled in a browser build — without it, checksum validation
silently computes the **wrong** result instead of throwing. Add
[`vite-plugin-node-polyfills`](https://www.npmjs.com/package/vite-plugin-node-polyfills)
(or your bundler's equivalent) if you hit this. See [`examples/facade`](../../examples/facade)
for a working Vite config and a live demo of every method in this package, including a
UI form for each one.
