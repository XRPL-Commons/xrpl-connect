import { describe, it, expect } from 'vitest';

import { WalletError } from './errors';
import { resolveNetwork } from './network';
import type { NetworkInfo } from './types';
import { STANDARD_NETWORKS, WalletErrorCode } from './types';

describe('resolveNetwork', () => {
  it('defaults to mainnet when no config is provided', () => {
    expect(resolveNetwork()).toBe(STANDARD_NETWORKS.mainnet);
    expect(resolveNetwork(undefined)).toBe(STANDARD_NETWORKS.mainnet);
  });

  it('resolves standard network ids to their NetworkInfo', () => {
    expect(resolveNetwork('testnet')).toBe(STANDARD_NETWORKS.testnet);
    expect(resolveNetwork('devnet')).toBe(STANDARD_NETWORKS.devnet);
  });

  it('passes a custom NetworkInfo through unchanged', () => {
    const custom: NetworkInfo = {
      id: 'custom',
      name: 'Custom',
      wss: 'wss://example.com',
    };
    expect(resolveNetwork(custom)).toBe(custom);
  });

  it('throws a WalletError when given an unknown network id', () => {
    expect(() => resolveNetwork('not-a-network')).toThrow(WalletError);
    try {
      resolveNetwork('not-a-network');
    } catch (err) {
      expect(err).toBeInstanceOf(WalletError);
      expect((err as WalletError).code).toBe(WalletErrorCode.UNKNOWN_ERROR);
      expect((err as WalletError).message).toContain('not-a-network');
    }
  });
});
