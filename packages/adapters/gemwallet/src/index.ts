/**
 * GemWallet adapter for xrpl-connect
 */

export { GemWalletAdapter } from './gemwallet-adapter';
export type { GemWalletAdapterOptions } from './gemwallet-adapter';

// Expose every upstream API function and type under a collision-safe namespace.
export * as GemWalletAPI from '@gemwallet/api';
