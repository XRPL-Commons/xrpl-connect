/**
 * XRPL Connect - Browser Entry Point
 *
 * This is the browser-optimized entry point with all Node.js dependencies externalized.
 * Use this for browser/frontend applications.
 *
 * @example
 * ```typescript
 * import { WalletManager, Adapters } from 'xrpl-connect';
 *
 * const walletManager = new WalletManager({
 *   adapters: [new Adapters.Xaman()],
 *   network: 'testnet',
 * });
 * ```
 */

// Forward the complete public surface instead of maintaining a second export list.
export * from './index';
