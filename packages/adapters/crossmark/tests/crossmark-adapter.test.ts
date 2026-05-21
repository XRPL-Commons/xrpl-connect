import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletErrorCode } from '@xrpl-connect/core';

vi.mock('@crossmarkio/sdk', () => {
  const sdk = {
    sync: { isInstalled: vi.fn() },
    methods: {
      signInAndWait: vi.fn(),
      signAndWait: vi.fn(),
      signAndSubmitAndWait: vi.fn(),
    },
  };
  return { default: sdk };
});

import sdkDefault from '@crossmarkio/sdk';
import { CrossmarkAdapter } from '../src/crossmark-adapter';

const sdk = sdkDefault as unknown as {
  sync: { isInstalled: ReturnType<typeof vi.fn> };
  methods: {
    signInAndWait: ReturnType<typeof vi.fn>;
    signAndWait: ReturnType<typeof vi.fn>;
    signAndSubmitAndWait: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  sdk.sync.isInstalled.mockReset();
  sdk.methods.signInAndWait.mockReset();
  sdk.methods.signAndWait.mockReset();
  sdk.methods.signAndSubmitAndWait.mockReset();
});

describe('CrossmarkAdapter.isAvailable', () => {
  it('returns true when the extension reports installed', async () => {
    sdk.sync.isInstalled.mockReturnValue(true);
    const adapter = new CrossmarkAdapter();
    await expect(adapter.isAvailable()).resolves.toBe(true);
  });

  it('returns false when the extension reports not installed', async () => {
    sdk.sync.isInstalled.mockReturnValue(false);
    const adapter = new CrossmarkAdapter();
    await expect(adapter.isAvailable()).resolves.toBe(false);
  });

  it('returns false when the underlying check throws', async () => {
    sdk.sync.isInstalled.mockImplementation(() => {
      throw new Error('boom');
    });
    const adapter = new CrossmarkAdapter();
    await expect(adapter.isAvailable()).resolves.toBe(false);
  });
});

describe('CrossmarkAdapter.connect', () => {
  it('returns account info on success', async () => {
    sdk.sync.isInstalled.mockReturnValue(true);
    sdk.methods.signInAndWait.mockResolvedValue({
      response: { data: { address: 'rUserAddress', publicKey: 'PUBKEY' } },
    });

    const adapter = new CrossmarkAdapter();
    const account = await adapter.connect();

    expect(account.address).toBe('rUserAddress');
    expect(account.publicKey).toBe('PUBKEY');
    expect(account.network.id).toBe('mainnet');
  });

  it('wraps "not installed" into a connection error', async () => {
    sdk.sync.isInstalled.mockReturnValue(false);
    const adapter = new CrossmarkAdapter();

    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });

  it('wraps user rejection into a connection error', async () => {
    sdk.sync.isInstalled.mockReturnValue(true);
    sdk.methods.signInAndWait.mockRejectedValue(new Error('User rejected'));
    const adapter = new CrossmarkAdapter();

    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });
});

describe('CrossmarkAdapter.sign', () => {
  async function connected() {
    sdk.sync.isInstalled.mockReturnValue(true);
    sdk.methods.signInAndWait.mockResolvedValue({
      response: { data: { address: 'rUser', publicKey: 'PK' } },
    });
    const adapter = new CrossmarkAdapter();
    await adapter.connect();
    return adapter;
  }

  it('returns tx_blob on success', async () => {
    const adapter = await connected();
    sdk.methods.signAndWait.mockResolvedValue({
      response: { data: { txBlob: 'DEADBEEF' } },
    });

    const result = await adapter.sign({ TransactionType: 'Payment' } as never);

    expect(result.tx_blob).toBe('DEADBEEF');
  });

  it('throws notConnected when no account is set', async () => {
    const adapter = new CrossmarkAdapter();
    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
  });

  it('maps user rejection to a sign-rejected error', async () => {
    const adapter = await connected();
    sdk.methods.signAndWait.mockRejectedValue(new Error('User Rejected the signature'));

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });
  });
});

describe('CrossmarkAdapter.disconnect', () => {
  it('clears the connected account', async () => {
    sdk.sync.isInstalled.mockReturnValue(true);
    sdk.methods.signInAndWait.mockResolvedValue({
      response: { data: { address: 'rUser', publicKey: 'PK' } },
    });
    const adapter = new CrossmarkAdapter();
    await adapter.connect();
    expect(await adapter.getAccount()).not.toBeNull();

    await adapter.disconnect();

    expect(await adapter.getAccount()).toBeNull();
  });
});
