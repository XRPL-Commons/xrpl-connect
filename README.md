# xrpl-connect (internal fork)

> Private fork of [XRPL-Commons/xrpl-connect](https://github.com/XRPL-Commons/xrpl-connect),
> repurposed as an internal facade for direct XRPL address/key management, balances,
> payments, and trust lines — not the original wallet-connection toolkit.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)

## What this repo is

Upstream `xrpl-connect` is a wallet-*connection* toolkit: connect to a user's browser
extension or mobile wallet (Xaman, Crossmark, GemWallet, ...) and ask it to sign. This
fork keeps that machinery in the tree as internal implementation detail, but the
package that's actually meant to be imported from outside this workspace —
**[`packages/xrpl-connect`](packages/xrpl-connect)** — is a different thing: a facade
for code that already holds a seed/private key (generated or imported) and wants to
derive addresses, read balances, and sign+submit transactions directly, with no browser
wallet in the loop.

## Install / connect

Within this workspace, add it as a `workspace:*` dependency and import from the package
name — there's no client to construct, no connection to open yourself:

```json
{ "dependencies": { "xrpl-connect": "workspace:*" } }
```

```typescript
import { Address, Accounts, Payments, TrustLines } from 'xrpl-connect';
```

Every method that talks to the network (`Accounts.*`, `Payments.*`, `TrustLines.*`)
opens its own connection and closes it when it resolves or rejects, defaulting to
**testnet** unless you pass `network: 'mainnet' | 'testnet' | 'devnet'` (or a custom
`NetworkInfo` with your own `wss` endpoint) as the last argument / a `network` field.

**→ [`examples/facade`](examples/facade)** is a working Vite app wiring every method
below to a UI form — clone it for a starting point, or `pnpm --filter facade-example run dev`
to click through them live.

## Usage examples

### `Address` — keys, no network

```typescript
// Generate a brand-new wallet (ed25519 by default)
const { address, publicKey, privateKey, seed } = Address.generate();
const secp = Address.generate('ecdsa-secp256k1');

// Restore a wallet you already have a secret for
Address.importBySeed('sEdT6jVBw43pnH3K49zWzKmUr3S21oj');
Address.importByHex('ED8AF704F03460A711BB62F16ED1699030CEA95627FC428348C16C222062D2CD33');
Address.importByMnemonic('bronze elite hammer first zone okay shrimp height injury vendor arrow omit');
Address.importByMnemonic(['bronze', 'elite', /* ...12/15/18/21/24 words */ 'omit']);
Address.importByXaman(['996118', '085046', '840948', '900303', '734410', '553242', '187768', '077910']);

// Validate before you import/sign — same rules the import methods themselves enforce
Address.isValidSeed('sEdT6jVBw43pnH3K49zWzKmUr3S21oj'); // true
Address.isValidHex('not-hex'); // false
Address.isValidMnemonic(someUserInput); // true/false, string or string[]
Address.isValidClassicAddress('rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT'); // true
Address.isValidXamanGroup('996118', 0); // one group, at its 0-indexed position
Address.isValidXamanSecretNumbers(['996118', '085046', /* ... all 8 */]);

// Generate demo/placeholder input for a form's "generate" button
Address.generateMnemonic(); // fresh random 12-word BIP-39 mnemonic
Address.generateXamanSecretNumbers(); // fresh random 8-group backup, checksums valid
```

### `Accounts` — read-only balance lookups

```typescript
const { drops, xrp } = await Accounts.getXrpBalance(address, 'testnet');

const tokens = await Accounts.getTokenBalances(address, 'testnet');
// [{ currency: 'FOO', issuer: 'rIssuer...', balance: '42' }, ...]

const mpts = await Accounts.getMptBalances(address, 'testnet');
// [{ mptIssuanceId: '0138...', value: '500', locked?: '0' }, ...]
```

### `Payments` — sign and submit

```typescript
const credential = { seed }; // or { publicKey, privateKey } — whatever Address.* gave you

await Payments.sendXrp({
  credential,
  destination: 'rDestinationAddress...',
  amountXrp: '10', // XRP, not drops
  destinationTag: 12345, // optional
  network: 'testnet',
});

await Payments.sendToken({
  credential,
  destination: 'rDestinationAddress...',
  currency: 'FOO',
  issuer: 'rIssuerAddress...',
  value: '42',
  network: 'testnet',
});

await Payments.sendMpt({
  credential,
  destination: 'rDestinationAddress...', // must already hold an authorized MPToken — see TrustLines.setMptTrustLine()
  mptIssuanceId: '013801153F91B797EB5824286DD7C258FAF11CCEF58177E5',
  value: '500',
  network: 'testnet',
});
// All three resolve to { hash, engineResult, validated } — engineResult is 'tesSUCCESS'
// on success; an on-ledger failure (tecUNFUNDED_PAYMENT, tecNO_LINE, ...) is returned
// here, not thrown.
```

### `TrustLines` — issued-currency trust lines and the MPT equivalent

```typescript
const lines = await TrustLines.getTrustLines(address, 'testnet');
// [{ currency: 'FOO', issuer: 'rIssuer...', balance: '42', limit: '1000', limitPeer: '0' }, ...]

await TrustLines.setTokenTrustLine({
  credential,
  currency: 'FOO',
  issuer: 'rIssuerAddress...',
  limit: '1000', // '0' resizes the line down to removed
  network: 'testnet',
});

await TrustLines.setMptTrustLine({
  credential,
  mptIssuanceId: '013801153F91B797EB5824286DD7C258FAF11CCEF58177E5',
  authorize: true, // default; pass false to opt back out
  network: 'testnet',
});
```

**→ [Full API reference](packages/xrpl-connect/README.md)** — every method's exact
signature, the `SigningCredential`/network types, and the error-handling model.

## Repo layout

```
packages/
  xrpl-connect/         ← the facade — the only package meant to be imported externally
  core/                 ← internal: WalletManager, wallet-connection types (only
                           STANDARD_NETWORKS/resolveNetwork are reused by the facade)
  ui/                   ← internal: <xrpl-wallet-connector> web component
  react/, vue/           internal: framework bindings for the web component — these
                          still import the pre-facade API from 'xrpl-connect' and
                          currently fail to build; nothing in this repo depends on them
  adapters/*/            internal: Xaman/Crossmark/GemWallet/WalletConnect/Ledger/
                          Xyra/Otsu/MetaMask Snap wallet-connection adapters
examples/
  facade/                live demo of the facade (see above) — the only example in
                          this fork that reflects packages/xrpl-connect's current API
docs/                    original wallet-connection toolkit docs (WalletManager,
                          adapters, framework guides) — describes APIs that are no
                          longer part of packages/xrpl-connect's public surface
```

## Development

```bash
# Install dependencies
pnpm exec vp install

# Build all packages
pnpm exec vp run build

# Run tests
pnpm exec vp run test

# Lint
pnpm exec vp lint

# Format
pnpm exec vp fmt

# Development mode (watch)
pnpm exec vp run dev
```

Needs Node **`^20.19.0 || ^22.18.0 || >=24.11.0`** — `vp` fails on older Node 20.x
patch versions with an `ERR_UNKNOWN_FILE_EXTENSION` error. Check `node -v`; if you're on
`nvm`, `nvm use 20.19.5` (or newer) before running any `vp` command.

## License

MIT License — see the [LICENSE](./LICENSE) file for details.

## Acknowledgments

Fork of [XRPL-Commons/xrpl-connect](https://github.com/XRPL-Commons/xrpl-connect), itself
inspired by [RainbowKit](https://www.rainbowkit.com/), [ConnectKit](https://github.com/family/connectkit),
and [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter).
