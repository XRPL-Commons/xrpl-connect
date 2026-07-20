/**
 * XRPL Connect - The easiest way to connect XRPL wallets to your app
 *
 * This package bundles everything you need for XRPL wallet connections:
 * - Core wallet management
 * - Pre-built UI web component
 * - All wallet adapters (Xaman, Crossmark, GemWallet, WalletConnect)
 *
 * @example
 * ```typescript
 * import { WalletManager, XamanAdapter, CrossmarkAdapter } from 'xrpl-connect';
 * import 'xrpl-connect/ui';
 *
 * const walletManager = new WalletManager({
 *   adapters: [new XamanAdapter(), new CrossmarkAdapter()],
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

// Convenient grouped exports for better DX
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';
import { LedgerAdapter } from '@xrpl-connect/adapter-ledger';
import { XyraAdapter } from '@xrpl-connect/adapter-xyra';
import { OtsuAdapter } from '@xrpl-connect/adapter-otsu';
import { MetaMaskSnapAdapter } from '@xrpl-connect/adapter-metamask-snap';

/**
 * Convenient object containing all wallet adapters
 *
 * @example
 * ```typescript
 * import { WalletManager, Adapters } from 'xrpl-connect';
 *
 * const walletManager = new WalletManager({
 *   adapters: [
 *     new Adapters.Xaman(),
 *     new Adapters.Crossmark(),
 *   ],
 * });
 * ```
 */
export const Adapters = {
  Xaman: XamanAdapter,
  Crossmark: CrossmarkAdapter,
  GemWallet: GemWalletAdapter,
  WalletConnect: WalletConnectAdapter,
  Ledger: LedgerAdapter,
  Xyra: XyraAdapter,
  Otsu: OtsuAdapter,
  MetaMaskSnap: MetaMaskSnapAdapter,
};
