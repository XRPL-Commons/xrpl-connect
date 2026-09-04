import type { NetworkConfig } from '@xrpl-connect/core';
import { resolveNetwork } from '@xrpl-connect/core';
// Default-import + destructure: xrpl is CommonJS — see address.ts for why.
import XrplPkg from 'xrpl';

const { Client } = XrplPkg;

/**
 * Resolves a `NetworkConfig` to its wss endpoint via `@xrpl-connect/core`'s own
 * `resolveNetwork()` — the same lookup/validation the wallet-connection adapters use —
 * instead of re-deriving it here. Every call site in this package always passes a
 * concrete network (each public method defaults its own `network` param to
 * `'testnet'`), so `resolveNetwork`'s `undefined → mainnet` fallback never triggers;
 * an unrecognized network name still throws (as a `WalletError`, via `resolveNetwork`
 * itself) exactly as before.
 */
function resolveEndpoint(network: NetworkConfig): string {
  return resolveNetwork(network).wss;
}

/** Opens one client connection, runs `run`, and always disconnects afterwards. */
export async function withClient<T>(
  network: NetworkConfig,
  run: (client: InstanceType<typeof Client>) => Promise<T>
): Promise<T> {
  const client = new Client(resolveEndpoint(network));
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.disconnect();
  }
}
