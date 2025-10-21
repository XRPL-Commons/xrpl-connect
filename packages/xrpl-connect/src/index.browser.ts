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

export const Adapters = {
  Xaman: XamanAdapter,
  Crossmark: CrossmarkAdapter,
  GemWallet: GemWalletAdapter,
  WalletConnect: WalletConnectAdapter,
};
