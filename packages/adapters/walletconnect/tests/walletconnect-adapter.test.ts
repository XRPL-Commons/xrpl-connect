import { describe, it, expect, expectTypeOf, vi, beforeEach } from 'vite-plus/test';
import { WalletErrorCode, type Transaction } from '@xrpl-connect/core';

const mockClient = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  request: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('@walletconnect/sign-client', () => ({
  default: { init: vi.fn() },
}));

vi.mock('@walletconnect/modal', () => ({
  WalletConnectModal: vi.fn(),
}));

import SignClient from '@walletconnect/sign-client';
import { WalletConnectAdapter } from '../src/walletconnect-adapter';

const SignClientMock = SignClient as unknown as { init: ReturnType<typeof vi.fn> };
const MAINNET_ADDRESS = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
const TESTNET_ADDRESS = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH';

beforeEach(() => {
  SignClientMock.init.mockReset();
  mockClient.connect.mockReset();
  mockClient.disconnect.mockReset();
  mockClient.disconnect.mockResolvedValue(undefined);
  mockClient.request.mockReset();
  mockClient.on.mockReset();
  mockClient.off.mockReset();
  SignClientMock.init.mockResolvedValue(mockClient);
});

describe('WalletConnectAdapter.isAvailable', () => {
  it('is always available because it uses a QR code', async () => {
    await expect(new WalletConnectAdapter().isAvailable()).resolves.toBe(true);
  });

  it('remains available even without a project ID configured', async () => {
    // Demonstrates the "false branch is unreachable" — isAvailable is decoupled
    // from credential validity; the only failure surfaces at connect()
    const adapter = new WalletConnectAdapter({ projectId: undefined });
    await expect(adapter.isAvailable()).resolves.toBe(true);
  });
});

describe('WalletConnectAdapter.connect', () => {
  it('returns account info after a successful session approval', async () => {
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-1',
        namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
      }),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const account = await adapter.connect();

    expect(account.address).toBe(MAINNET_ADDRESS);
    expect(account.network.id).toBe('mainnet');
  });

  it('selects the account whose CAIP-10 chain matches the requested network', async () => {
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-multiple',
        namespaces: {
          xrpl: {
            accounts: [`xrpl:1:${TESTNET_ADDRESS}`, `xrpl:0:${MAINNET_ADDRESS}`],
          },
        },
      }),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const account = await adapter.connect({ network: 'mainnet' });

    expect(account).toMatchObject({ address: MAINNET_ADDRESS, network: { id: 'mainnet' } });
    expect(mockClient.disconnect).not.toHaveBeenCalled();
  });

  it.each(['21338', '4294967295'])(
    'matches an account against custom XRPL network ID %s',
    async (networkId) => {
      mockClient.connect.mockResolvedValue({
        uri: 'wc:example',
        approval: vi.fn().mockResolvedValue({
          topic: 'topic-custom',
          namespaces: { xrpl: { accounts: [`xrpl:${networkId}:${MAINNET_ADDRESS}`] } },
        }),
      });

      const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
      const account = await adapter.connect({
        network: {
          id: 'custom',
          name: 'Custom',
          wss: 'wss://example.com',
          walletConnectId: `xrpl:${networkId}`,
        },
      });

      expect(account).toMatchObject({ address: MAINNET_ADDRESS, network: { id: 'custom' } });
    }
  );

  it.each(['', 'xrpl:01', 'xrpl:not-a-network', 'xrpl:4294967296', 'eip155:1'])(
    'rejects invalid requested XRPL chain ID %s before connecting',
    async (walletConnectId) => {
      const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });

      await expect(
        adapter.connect({
          network: {
            id: 'custom',
            name: 'Custom',
            wss: 'wss://example.com',
            walletConnectId,
          },
        })
      ).rejects.toMatchObject({ code: WalletErrorCode.CONNECTION_FAILED });

      expect(SignClientMock.init).not.toHaveBeenCalled();
      expect(mockClient.connect).not.toHaveBeenCalled();
    }
  );

  it('preserves a newer pre-initialized connection when older validation cleanup finishes', async () => {
    let finishDisconnect!: () => void;
    const disconnect = new Promise<void>((resolve) => {
      finishDisconnect = resolve;
    });

    mockClient.connect
      .mockResolvedValueOnce({
        uri: 'wc:invalid',
        approval: vi.fn().mockResolvedValue({
          topic: 'topic-invalid',
          namespaces: { xrpl: { accounts: [`xrpl:1:${TESTNET_ADDRESS}`] } },
        }),
      })
      .mockResolvedValueOnce({
        uri: 'wc:newer',
        approval: vi.fn().mockResolvedValue({
          topic: 'topic-newer',
          namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
        }),
      });
    mockClient.disconnect.mockReturnValue(disconnect);

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const invalidConnection = adapter.connect();
    await vi.waitFor(() => expect(mockClient.disconnect).toHaveBeenCalledOnce());

    await adapter.preInitialize('mainnet');
    finishDisconnect();
    await expect(invalidConnection).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });

    const account = await adapter.connect();
    expect(account.address).toBe(MAINNET_ADDRESS);
    expect(mockClient.connect).toHaveBeenCalledTimes(2);
  });

  it('does not create a stale pre-initialized proposal after connect takes ownership', async () => {
    let finishInitialization!: () => void;
    const initialization = new Promise<typeof mockClient>((resolve) => {
      finishInitialization = () => resolve(mockClient);
    });
    SignClientMock.init.mockReturnValue(initialization);
    mockClient.connect.mockResolvedValue({
      uri: 'wc:current',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-current',
        namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
      }),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const preInitialization = adapter.preInitialize('mainnet');
    await vi.waitFor(() => expect(SignClientMock.init).toHaveBeenCalledOnce());

    const connection = adapter.connect();
    finishInitialization();

    await preInitialization;
    await expect(connection).resolves.toMatchObject({ address: MAINNET_ADDRESS });
    expect(mockClient.connect).toHaveBeenCalledOnce();
  });

  it('does not accept a custom chain by its network name without a numeric walletConnectId', async () => {
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-custom',
        namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
      }),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await expect(
      adapter.connect({ network: { id: 'custom', name: 'Custom', wss: 'wss://example.com' } })
    ).rejects.toMatchObject({ code: WalletErrorCode.CONNECTION_FAILED });
    expect(mockClient.connect).not.toHaveBeenCalled();
  });

  it.each([
    ['missing address', 'xrpl:0'],
    ['empty address', 'xrpl:0:'],
    ['extra component', `xrpl:0:${MAINNET_ADDRESS}:extra`],
    ['wrong namespace', `eip155:0:${MAINNET_ADDRESS}`],
    ['non-canonical chain reference', `xrpl:01:${MAINNET_ADDRESS}`],
    ['out-of-range chain reference', `xrpl:4294967296:${MAINNET_ADDRESS}`],
    ['invalid classic address', 'xrpl:0:rNotAValidClassicAddress'],
  ])('rejects and cleans up a malformed approved account (%s)', async (_case, account) => {
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-malformed',
        namespaces: { xrpl: { accounts: [account] } },
      }),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });

    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
    expect(mockClient.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'topic-malformed' })
    );
    expect(await adapter.getAccount()).toBeNull();
    await expect(adapter.getNetwork()).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
  });

  it.each([
    ['no XRPL accounts', []],
    ['only an account on another chain', [`xrpl:1:${TESTNET_ADDRESS}`]],
  ])('rejects and cleans up an approved session with %s', async (_case, accounts) => {
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-wrong-chain',
        namespaces: { xrpl: { accounts } },
      }),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });

    await expect(adapter.connect({ network: 'mainnet' })).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
    expect(mockClient.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'topic-wrong-chain' })
    );
    expect(await adapter.getAccount()).toBeNull();
  });

  it('clears local state when disconnecting an invalid approved session fails', async () => {
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-disconnect-failure',
        namespaces: { xrpl: { accounts: [`xrpl:1:${TESTNET_ADDRESS}`] } },
      }),
    });
    mockClient.disconnect.mockRejectedValue(new Error('Relay unavailable'));

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });

    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
      originalError: {
        message: 'WalletConnect did not return an account for xrpl:0',
      },
    });
    expect(await adapter.getAccount()).toBeNull();

    mockClient.disconnect.mockResolvedValue(undefined);
    mockClient.connect.mockResolvedValue({
      uri: 'wc:retry',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-retry',
        namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
      }),
    });

    await expect(adapter.connect()).resolves.toMatchObject({ address: MAINNET_ADDRESS });
    expect(SignClientMock.init).toHaveBeenCalledTimes(2);
    expect(mockClient.disconnect).toHaveBeenCalledOnce();
  });

  it('throws a wrapped error when no project ID is provided', async () => {
    const adapter = new WalletConnectAdapter();
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });

  it('wraps user rejection into a connection error', async () => {
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockRejectedValue(new Error('User rejected')),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });
});

describe('WalletConnectAdapter.sign', () => {
  async function connected() {
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-1',
        namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
      }),
    });
    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await adapter.connect();
    return adapter;
  }

  it('returns the signed tx_json and signature when no tx_blob is provided', async () => {
    const adapter = await connected();
    mockClient.request.mockResolvedValue({
      tx_json: {
        hash: 'ABCDEF0123456789',
        TransactionType: 'Payment',
        SigningPubKey: 'PUB',
        TxnSignature: 'SIG',
      },
    });

    const result = await adapter.sign({ TransactionType: 'Payment' } as never);

    // TxnSignature is a raw signature, not a serialized transaction blob — it
    // must not be reported as tx_blob (there is none, since the wallet only
    // signed; it did not encode/submit anything).
    expect(result.tx_blob).toBeUndefined();
    expect(result.signature).toBe('SIG');
    expect(result.tx_json).toMatchObject({
      TransactionType: 'Payment',
      SigningPubKey: 'PUB',
      TxnSignature: 'SIG',
    });
    expect(result.hash).toBe('ABCDEF0123456789');
    expectTypeOf(result.tx_json).toEqualTypeOf<Transaction | undefined>();
  });

  it('maps a rejected request to sign-rejected', async () => {
    const adapter = await connected();
    mockClient.request.mockRejectedValue(new Error('User rejected the request'));

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });
  });

  it('throws notConnected before any session is established', async () => {
    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
  });
});

describe('WalletConnectAdapter.signAndSubmit', () => {
  async function connected() {
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-1',
        namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
      }),
    });
    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await adapter.connect();
    return adapter;
  }

  it('returns the ledger hash and signed tx_json when no tx_blob is provided', async () => {
    const adapter = await connected();
    mockClient.request.mockResolvedValue({
      tx_json: {
        hash: 'ABCDEF0123456789',
        TransactionType: 'Payment',
        SigningPubKey: 'PUB',
        TxnSignature: 'SIG',
      },
    });

    const result = await adapter.signAndSubmit({ TransactionType: 'Payment' } as never);

    expect(result.hash).toBe('ABCDEF0123456789');
    expect(result.signature).toBe('SIG');
    expect(result.tx_json).toMatchObject({ TransactionType: 'Payment', TxnSignature: 'SIG' });
    expect(result.tx_blob).toBeUndefined();
    expectTypeOf(result.signature).toEqualTypeOf<string | undefined>();
    expectTypeOf(result.tx_json).toEqualTypeOf<Transaction | undefined>();
  });

  it('maps a rejected request to sign-rejected', async () => {
    const adapter = await connected();
    mockClient.request.mockRejectedValue(new Error('User rejected the request'));

    await expect(
      adapter.signAndSubmit({ TransactionType: 'Payment' } as never)
    ).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });
  });
});

describe('WalletConnectAdapter.disconnect', () => {
  it('disconnects a session that is approved after the pending connection was cancelled', async () => {
    let approve!: (session: {
      topic: string;
      namespaces: { xrpl: { accounts: string[] } };
    }) => void;
    const approval = new Promise<{
      topic: string;
      namespaces: { xrpl: { accounts: string[] } };
    }>((resolve) => {
      approve = resolve;
    });
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn(() => approval),
    });
    mockClient.disconnect.mockResolvedValue(undefined);

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const connection = adapter.connect();
    await vi.waitFor(() => expect(mockClient.connect).toHaveBeenCalledOnce());

    await adapter.disconnect();
    approve({
      topic: 'late-topic',
      namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
    });

    await expect(connection).rejects.toMatchObject({ code: WalletErrorCode.CONNECTION_FAILED });
    expect(mockClient.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'late-topic' })
    );
    expect(await adapter.getAccount()).toBeNull();
  });

  it('clears the session and account after a successful disconnect', async () => {
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-1',
        namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
      }),
    });
    mockClient.disconnect.mockResolvedValue(undefined);

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await adapter.connect();
    expect(await adapter.getAccount()).not.toBeNull();

    await adapter.disconnect();

    expect(mockClient.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'topic-1' })
    );
    expect(await adapter.getAccount()).toBeNull();
  });

  it('is a no-op when no session exists', async () => {
    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await expect(adapter.disconnect()).resolves.toBeUndefined();
    expect(mockClient.disconnect).not.toHaveBeenCalled();
  });
});
