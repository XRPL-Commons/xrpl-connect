/**
 * XRPL Connect - The easiest way to connect XRPL wallets to your app
 *
 * This package bundles everything you need for XRPL wallet connections:
 * - Core wallet management
 * - Pre-built UI web component
 * - All eight wallet adapters (Xaman, Crossmark, GemWallet, WalletConnect,
 *   Ledger, Xyra, Otsu, and MetaMask Snap)
 *
 * @example
 * ```typescript
 * import { WalletManager, XamanAdapter, CrossmarkAdapter } from 'xrpl-connect';
 * const walletManager = new WalletManager({
 *   adapters: [
 *     new XamanAdapter({ apiKey: 'YOUR_XAMAN_API_KEY' }),
 *     new CrossmarkAdapter(),
 *   ],
 *   network: 'testnet',
 * });
 * ```
 */

export * from '@xrpl-connect/core';
export * from '@xrpl-connect/ui';

// Re-export each adapter's full public surface — adapter classes, option types,
// helpers, network maps, and collision-safe namespaces for the underlying wallet
// SDKs. Consumers can access every adapter and upstream API from this package.
// Adapter exports are uniquely named, so these `export *` re-exports do not collide
// with each other or with the core/ui surfaces above.
export * from '@xrpl-connect/adapter-xaman';
export * from '@xrpl-connect/adapter-crossmark';
export * from '@xrpl-connect/adapter-gemwallet';
export * from '@xrpl-connect/adapter-walletconnect';
export * from '@xrpl-connect/adapter-ledger';
export * from '@xrpl-connect/adapter-xyra';
export * from '@xrpl-connect/adapter-otsu';
export * from '@xrpl-connect/adapter-metamask-snap';
export * from './adapters';
