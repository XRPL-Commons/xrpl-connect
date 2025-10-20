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

export * from '../../core';
export * from '../../ui';

// Re-export all adapters
export { XamanAdapter } from '../../adapters/xaman';
export { CrossmarkAdapter } from '../../adapters/crossmark';
export { GemWalletAdapter } from '../../adapters/gemwallet';
export { WalletConnectAdapter } from '../../adapters/walletconnect';

// Convenient grouped exports for better DX
import { XamanAdapter } from '../../adapters/xaman';
import { CrossmarkAdapter } from '../../adapters/crossmark';
import { GemWalletAdapter } from '../../adapters/gemwallet';
import { WalletConnectAdapter } from '../../adapters/walletconnect';

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
};
