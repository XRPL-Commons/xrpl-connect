/**
 * xrpl-connect - internal facade
 *
 * This is the only entry point meant to be imported from outside this
 * workspace. @xrpl-connect/core, @xrpl-connect/ui and the adapter packages
 * are implementation details reached only through what's exported here.
 *
 * @example
 * ```typescript
 * import { Address } from 'xrpl-connect';
 * const { address, seed, publicKey, privateKey } = Address.generate();
 * ```
 *
 * `Address.importByMnemonic()`/`importByXaman()` pull in `bip39`, which needs Node's
 * `Buffer`/`crypto` polyfilled in a browser build (e.g. `vite-plugin-node-polyfills`) —
 * without it, checksum validation silently computes the wrong result instead of
 * throwing. See `examples/facade` for a working Vite config.
 */

export { Address } from './address';
export type { AddressAlgorithm, GeneratedAddress, ImportedAddress } from './address';

export { Accounts } from './accounts';
export type { XrpBalance, TokenBalance, MptBalance } from './accounts';

export type { SigningCredential } from './credential';
export type { TxResult } from './tx-result';

// Every network-taking method below accepts this — re-exported so consumers can
// reference the type without reaching into @xrpl-connect/core themselves.
export type { NetworkConfig, NetworkInfo, StandardNetworkId } from '@xrpl-connect/core';

export { Payments } from './payments';
export type { SendXrpParams, SendTokenParams, SendMptParams } from './payments';

export { TrustLines } from './trustlines';
export type { SetTokenTrustLineParams, SetMptTrustLineParams, TrustLine } from './trustlines';
