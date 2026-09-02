/**
 * Network resolution helpers shared by all wallet adapters.
 */

import { createWalletError } from './errors';
import type { ConnectOptions, NetworkInfo } from './types';
import { isStandardNetworkId, STANDARD_NETWORKS } from './types';

/**
 * Resolve a `ConnectOptions['network']` value to a concrete `NetworkInfo`.
 *
 * - `undefined` → mainnet (default).
 * - `string` → looked up in `STANDARD_NETWORKS`; throws if unknown.
 * - `NetworkInfo` → returned as-is.
 */
export function resolveNetwork(config?: ConnectOptions['network']): NetworkInfo {
  if (!config) {
    return STANDARD_NETWORKS.mainnet;
  }

  if (typeof config === 'string') {
    if (!isStandardNetworkId(config)) {
      throw createWalletError.unknown(`Unknown network: ${config}`);
    }
    return STANDARD_NETWORKS[config];
  }

  return config;
}
