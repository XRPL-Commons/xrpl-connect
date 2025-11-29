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

// Re-export all adapters
export { XamanAdapter } from '@xrpl-connect/adapter-xaman';
export { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
export { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';
export { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';
export { LedgerAdapter } from '@xrpl-connect/adapter-ledger';
export { Web3AuthAdapter } from '@xrpl-connect/adapter-web3auth';

// Convenient grouped exports for better DX
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';
import { LedgerAdapter } from '@xrpl-connect/adapter-ledger';
import { Web3AuthAdapter } from '@xrpl-connect/adapter-web3auth';

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
  Web3Auth: Web3AuthAdapter,
};
