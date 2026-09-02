import { describe, it, expect, expectTypeOf, vi, beforeEach } from 'vite-plus/test';
import {
  createWalletError,
  STANDARD_NETWORKS,
  WalletErrorCategory,
  WalletErrorCode,
  type Transaction,
} from '@xrpl-connect/core';

const mockClient = {
  core: { pairing: { disconnect: vi.fn() } },
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
const PAIRING_TOPIC = 'a'.repeat(64);
const OTHER_PAIRING_TOPIC = 'b'.repeat(64);

function walletConnectUri(topic: string): string {
  return `wc:${topic}@2?relay-protocol=irn&symKey=${'c'.repeat(64)}`;
}

function getClientEventHandler(event: string): (payload: never) => void {
  const registration = [...mockClient.on.mock.calls]
    .reverse()
    .find(([registeredEvent]) => registeredEvent === event);
  const handler = registration?.[1] as ((payload: never) => void) | undefined;
  if (!handler) throw new Error(`No ${event} handler was registered`);
  return handler;
}

beforeEach(() => {
  SignClientMock.init.mockReset();
  mockClient.connect.mockReset();
  mockClient.core.pairing.disconnect.mockReset();
  mockClient.core.pairing.disconnect.mockResolvedValue(undefined);
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

describe('WalletConnectAdapter configuration', () => {
  it('accepts constructor or deferred project IDs', () => {
    expect(
      new WalletConnectAdapter({ projectId: 'constructor-project' }).getMissingConfiguration()
    ).toEqual([]);
    expect(
      new WalletConnectAdapter().getMissingConfiguration({ projectId: 'deferred-project' })
    ).toEqual([]);
  });

  it('identifies a missing project ID before connection work begins', async () => {
    const adapter = new WalletConnectAdapter();

    expect(adapter.getMissingConfiguration()).toEqual(['projectId']);
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONFIGURATION_REQUIRED,
      message: 'WalletConnect requires configuration before connecting: projectId.',
    });
    expect(SignClientMock.init).not.toHaveBeenCalled();
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

  it('uses the approved XRPL session chain and rejects a wrong-chain approval before caching', async () => {
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-wrong-chain',
        namespaces: {
          xrpl: {
            chains: ['xrpl:1'],
            accounts: [`xrpl:1:${TESTNET_ADDRESS}`],
          },
        },
      }),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await expect(adapter.connect({ network: 'mainnet' })).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_MISMATCH,
    });

    expect(mockClient.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'topic-wrong-chain' })
    );
    await expect(adapter.getAccount()).resolves.toBeNull();
  });

  it('keeps a supported custom CAIP chain on the connected account and sign request', async () => {
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-custom',
        namespaces: {
          xrpl: {
            chains: ['xrpl:21338'],
            accounts: [`xrpl:21338:${MAINNET_ADDRESS}`],
          },
        },
      }),
    });
    mockClient.request.mockResolvedValue({
      tx_json: { TransactionType: 'Payment', TxnSignature: 'SIG' },
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const network = {
      id: 'custom',
      name: 'Custom',
      wss: 'wss://example.com',
      walletConnectId: 'xrpl:21338',
    };
    const account = await adapter.connect({ network });
    await adapter.sign({ TransactionType: 'Payment' } as never);

    expect(account).toMatchObject({ address: MAINNET_ADDRESS, network });
    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: 'xrpl:21338' })
    );
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
      ).rejects.toMatchObject({ code: WalletErrorCode.NETWORK_NOT_SUPPORTED });

      expect(SignClientMock.init).not.toHaveBeenCalled();
      expect(mockClient.connect).not.toHaveBeenCalled();
    }
  );

  it('rejects a standard network id paired with a different CAIP chain', async () => {
    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });

    await expect(
      adapter.connect({
        network: {
          id: 'mainnet',
          name: 'Contradictory Mainnet',
          wss: 'wss://example.com',
          walletConnectId: 'xrpl:1',
        },
      })
    ).rejects.toMatchObject({ code: WalletErrorCode.NETWORK_NOT_SUPPORTED });
    expect(SignClientMock.init).not.toHaveBeenCalled();
    expect(mockClient.connect).not.toHaveBeenCalled();
  });

  it('maps an unknown requested network to NETWORK_NOT_SUPPORTED', async () => {
    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });

    await expect(adapter.connect({ network: 'sidechain' as never })).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_NOT_SUPPORTED,
    });
    expect(SignClientMock.init).not.toHaveBeenCalled();
  });

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
      code: WalletErrorCode.NETWORK_MISMATCH,
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

  it('closes a pre-initialized proposal that becomes stale while it is being created', async () => {
    let finishPreInitialization!: (connection: {
      uri: string;
      approval: () => Promise<never>;
    }) => void;
    const preInitializedProposal = new Promise<{
      uri: string;
      approval: () => Promise<never>;
    }>((resolve) => {
      finishPreInitialization = resolve;
    });

    mockClient.connect.mockReturnValueOnce(preInitializedProposal).mockResolvedValueOnce({
      uri: walletConnectUri(OTHER_PAIRING_TOPIC),
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-current',
        namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
      }),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const preInitialization = adapter.preInitialize('mainnet');
    await vi.waitFor(() => expect(mockClient.connect).toHaveBeenCalledOnce());

    const connection = adapter.connect({ network: 'mainnet' });
    await expect(connection).resolves.toMatchObject({ address: MAINNET_ADDRESS });

    finishPreInitialization({
      uri: walletConnectUri(PAIRING_TOPIC),
      approval: vi.fn().mockRejectedValue(new Error('Proposal cancelled')),
    });
    await preInitialization;

    expect(mockClient.core.pairing.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: PAIRING_TOPIC })
    );
  });

  it('closes a pre-initialized proposal when publishing its QR code fails', async () => {
    mockClient.connect.mockResolvedValue({
      uri: walletConnectUri(PAIRING_TOPIC),
      approval: vi.fn().mockRejectedValue(new Error('Proposal cancelled')),
    });

    const adapter = new WalletConnectAdapter({
      projectId: 'proj-id',
      onQRCode: () => {
        throw new Error('QR renderer unavailable');
      },
    });

    await adapter.preInitialize('mainnet');

    expect(mockClient.core.pairing.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: PAIRING_TOPIC })
    );
  });

  it('closes a new proposal when publishing its QR code fails during connect', async () => {
    mockClient.connect.mockResolvedValue({
      uri: walletConnectUri(PAIRING_TOPIC),
      approval: vi.fn().mockRejectedValue(new Error('Proposal cancelled')),
    });

    const adapter = new WalletConnectAdapter({
      projectId: 'proj-id',
      onQRCode: () => {
        throw new Error('QR renderer unavailable');
      },
    });

    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
      originalError: { message: 'QR renderer unavailable' },
    });
    expect(mockClient.core.pairing.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: PAIRING_TOPIC })
    );
  });

  it('cancels a connection while SignClient initialization is still pending', async () => {
    let finishInitialization!: () => void;
    const initialization = new Promise<typeof mockClient>((resolve) => {
      finishInitialization = () => resolve(mockClient);
    });
    SignClientMock.init.mockReturnValueOnce(initialization).mockResolvedValueOnce(mockClient);
    mockClient.connect.mockResolvedValue({
      uri: 'wc:retry',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-retry',
        namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
      }),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const connection = adapter.connect();
    await vi.waitFor(() => expect(SignClientMock.init).toHaveBeenCalledOnce());

    await adapter.disconnect();
    finishInitialization();

    await expect(connection).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
      originalError: { message: 'WalletConnect connection was cancelled' },
    });
    expect(mockClient.connect).not.toHaveBeenCalled();

    await expect(adapter.connect()).resolves.toMatchObject({ address: MAINNET_ADDRESS });
    expect(SignClientMock.init).toHaveBeenCalledTimes(2);
  });

  it('closes an active proposal immediately when disconnect cancels its approval', async () => {
    const approvalPromise = new Promise<never>(() => {});
    const approval = vi.fn(() => approvalPromise);
    mockClient.connect.mockResolvedValue({
      uri: walletConnectUri(PAIRING_TOPIC),
      approval,
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const connection = adapter.connect();
    await vi.waitFor(() => expect(approval).toHaveBeenCalledOnce());

    await adapter.disconnect();

    expect(mockClient.core.pairing.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: PAIRING_TOPIC })
    );
    await expect(connection).rejects.toMatchObject({ code: WalletErrorCode.CONNECTION_REJECTED });
  });

  it('closes an active proposal when a newer connection supersedes it', async () => {
    const firstApprovalPromise = new Promise<never>(() => {});
    const firstApproval = vi.fn(() => firstApprovalPromise);
    mockClient.connect
      .mockResolvedValueOnce({
        uri: walletConnectUri(PAIRING_TOPIC),
        approval: firstApproval,
      })
      .mockResolvedValueOnce({
        uri: walletConnectUri(OTHER_PAIRING_TOPIC),
        approval: vi.fn().mockResolvedValue({
          topic: 'topic-current',
          namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
        }),
      });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const firstConnection = adapter.connect();
    await vi.waitFor(() => expect(firstApproval).toHaveBeenCalledOnce());

    await expect(adapter.connect()).resolves.toMatchObject({ address: MAINNET_ADDRESS });
    expect(mockClient.core.pairing.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: PAIRING_TOPIC })
    );
    await expect(firstConnection).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
    });
  });

  it('can retry after shared pre-initialization rejects during connect', async () => {
    let rejectInitialization!: (error: Error) => void;
    const initialization = new Promise<typeof mockClient>((_resolve, reject) => {
      rejectInitialization = reject;
    });
    SignClientMock.init.mockReturnValueOnce(initialization).mockResolvedValueOnce(mockClient);
    mockClient.connect.mockResolvedValue({
      uri: 'wc:retry',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-retry',
        namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
      }),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const preInitialization = adapter.preInitialize('mainnet');
    await vi.waitFor(() => expect(SignClientMock.init).toHaveBeenCalledOnce());
    const concurrentConnection = adapter.connect();

    rejectInitialization(new Error('SignClient initialization failed'));
    await preInitialization;
    await expect(concurrentConnection).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });

    await expect(adapter.connect()).resolves.toMatchObject({ address: MAINNET_ADDRESS });
    expect(SignClientMock.init).toHaveBeenCalledTimes(2);
  });

  it('disconnects an older late approval after a newer invalid attempt clears adapter state', async () => {
    let approveFirst!: (session: {
      topic: string;
      namespaces: { xrpl: { accounts: string[] } };
    }) => void;
    const firstApproval = new Promise<{
      topic: string;
      namespaces: { xrpl: { accounts: string[] } };
    }>((resolve) => {
      approveFirst = resolve;
    });

    mockClient.connect
      .mockResolvedValueOnce({ uri: 'wc:first', approval: () => firstApproval })
      .mockResolvedValueOnce({
        uri: 'wc:second',
        approval: vi.fn().mockResolvedValue({
          topic: 'topic-invalid',
          namespaces: { xrpl: { accounts: [`xrpl:1:${TESTNET_ADDRESS}`] } },
        }),
      });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const firstConnection = adapter.connect({ network: 'mainnet' });
    await vi.waitFor(() => expect(mockClient.connect).toHaveBeenCalledOnce());

    await expect(adapter.connect({ network: 'mainnet' })).rejects.toMatchObject({
      code: WalletErrorCode.NETWORK_MISMATCH,
    });

    approveFirst({
      topic: 'topic-first',
      namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
    });
    await expect(firstConnection).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
    });

    expect(mockClient.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'topic-invalid' })
    );
    expect(mockClient.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'topic-first' })
    );
  });

  it('replaces a pre-initialized proposal when connect requests another chain', async () => {
    mockClient.connect
      .mockResolvedValueOnce({
        uri: walletConnectUri(PAIRING_TOPIC),
        approval: vi.fn().mockResolvedValue({
          topic: 'topic-mainnet',
          namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
        }),
      })
      .mockResolvedValueOnce({
        uri: walletConnectUri(OTHER_PAIRING_TOPIC),
        approval: vi.fn().mockResolvedValue({
          topic: 'topic-testnet',
          namespaces: { xrpl: { accounts: [`xrpl:1:${TESTNET_ADDRESS}`] } },
        }),
      });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await adapter.preInitialize('mainnet');

    await expect(adapter.connect({ network: 'testnet' })).resolves.toMatchObject({
      address: TESTNET_ADDRESS,
      network: { id: 'testnet' },
    });
    expect(mockClient.core.pairing.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: PAIRING_TOPIC })
    );
    await vi.waitFor(() =>
      expect(mockClient.disconnect).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'topic-mainnet' })
      )
    );
    expect(mockClient.connect).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        requiredNamespaces: expect.objectContaining({
          xrpl: expect.objectContaining({ chains: ['xrpl:1'] }),
        }),
      })
    );
  });

  it('replaces an existing pre-initialized proposal when pre-initializing another chain', async () => {
    mockClient.connect
      .mockResolvedValueOnce({
        uri: walletConnectUri(PAIRING_TOPIC),
        approval: vi.fn().mockRejectedValue(new Error('Proposal cancelled')),
      })
      .mockResolvedValueOnce({
        uri: walletConnectUri(OTHER_PAIRING_TOPIC),
        approval: vi.fn().mockResolvedValue({
          topic: 'topic-testnet',
          namespaces: { xrpl: { accounts: [`xrpl:1:${TESTNET_ADDRESS}`] } },
        }),
      });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await adapter.preInitialize('mainnet');
    await adapter.preInitialize('testnet');

    await expect(adapter.connect({ network: 'testnet' })).resolves.toMatchObject({
      address: TESTNET_ADDRESS,
    });
    expect(mockClient.connect).toHaveBeenCalledTimes(2);
    expect(mockClient.core.pairing.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: PAIRING_TOPIC })
    );
  });

  it('does not reuse a pre-initialized client for another project ID', async () => {
    mockClient.connect.mockResolvedValueOnce({
      uri: walletConnectUri(PAIRING_TOPIC),
      approval: vi.fn().mockRejectedValue(new Error('Proposal cancelled')),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'project-a' });
    await adapter.preInitialize('mainnet');

    await expect(adapter.connect({ projectId: 'project-b' })).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
      originalError: {
        message: 'Cannot change WalletConnect project ID after initialization',
      },
    });
    expect(mockClient.connect).toHaveBeenCalledOnce();
    expect(mockClient.core.pairing.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: PAIRING_TOPIC })
    );
  });

  it('ignores a late session event from a superseded session', async () => {
    mockClient.connect
      .mockResolvedValueOnce({
        uri: 'wc:first',
        approval: vi.fn().mockResolvedValue({
          topic: 'topic-first',
          namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
        }),
      })
      .mockResolvedValueOnce({
        uri: 'wc:second',
        approval: vi.fn().mockResolvedValue({
          topic: 'topic-second',
          namespaces: { xrpl: { accounts: [`xrpl:1:${TESTNET_ADDRESS}`] } },
        }),
      });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await adapter.connect({ network: 'mainnet' });
    const firstSessionDeleteHandler = mockClient.on.mock.calls[0]?.[1] as
      | ((event: { topic: string }) => void)
      | undefined;

    await adapter.connect({ network: 'testnet' });
    firstSessionDeleteHandler?.({ topic: 'topic-first' });

    expect(await adapter.getAccount()).toMatchObject({
      address: TESTNET_ADDRESS,
      network: { id: 'testnet' },
    });
  });

  it('ignores the replaced session event while its replacement approval is pending', async () => {
    let approveReplacement!: (session: {
      topic: string;
      namespaces: { xrpl: { accounts: string[] } };
    }) => void;
    const replacementApproval = new Promise<{
      topic: string;
      namespaces: { xrpl: { accounts: string[] } };
    }>((resolve) => {
      approveReplacement = resolve;
    });
    mockClient.connect
      .mockResolvedValueOnce({
        uri: 'wc:first',
        approval: vi.fn().mockResolvedValue({
          topic: 'topic-first',
          namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
        }),
      })
      .mockResolvedValueOnce({
        uri: walletConnectUri(PAIRING_TOPIC),
        approval: vi.fn(() => replacementApproval),
      });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await adapter.connect({ network: 'mainnet' });
    const firstSessionDeleteHandler = mockClient.on.mock.calls[0]?.[1] as
      | ((event: { topic: string }) => void)
      | undefined;

    const replacement = adapter.connect({ network: 'testnet' });
    await vi.waitFor(() => expect(mockClient.connect).toHaveBeenCalledTimes(2));
    firstSessionDeleteHandler?.({ topic: 'topic-first' });
    approveReplacement({
      topic: 'topic-second',
      namespaces: { xrpl: { accounts: [`xrpl:1:${TESTNET_ADDRESS}`] } },
    });

    await expect(replacement).resolves.toMatchObject({
      address: TESTNET_ADDRESS,
      network: { id: 'testnet' },
    });
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
    ).rejects.toMatchObject({ code: WalletErrorCode.NETWORK_NOT_SUPPORTED });
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
      code:
        accounts.length === 0
          ? WalletErrorCode.CONNECTION_FAILED
          : WalletErrorCode.NETWORK_MISMATCH,
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
      code: WalletErrorCode.NETWORK_MISMATCH,
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

  it('throws a configuration error when no project ID is provided', async () => {
    const adapter = new WalletConnectAdapter();
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONFIGURATION_REQUIRED,
    });
  });

  it('maps message-based user rejection to connection-rejected and retains its cause', async () => {
    const rejection = new Error('User rejected');
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockRejectedValue(rejection),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
      category: WalletErrorCategory.USER_ACTION,
      originalError: rejection,
    });
  });

  it('maps documented structured Reown rejection codes to connection-rejected', async () => {
    const rejection = { code: 5002, message: 'La demande a été refusée.' };
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockRejectedValue(rejection),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
      category: WalletErrorCategory.USER_ACTION,
      originalError: expect.objectContaining({ cause: rejection }),
    });
  });

  it('passes through an existing typed connection error unchanged', async () => {
    const typedError = createWalletError.networkNotSupported('sidechain', 'WalletConnect');
    mockClient.connect.mockRejectedValue(typedError);

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await expect(adapter.connect()).rejects.toBe(typedError);
  });
});

describe('WalletConnectAdapter session changes', () => {
  function approveSession(namespaces: Record<string, unknown>) {
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockResolvedValue({ topic: 'topic-events', namespaces }),
    });
  }

  it('updates the account from an accountsChanged event before signing', async () => {
    approveSession({ xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } });
    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const accountListener = vi.fn();
    adapter.on('accountChanged', accountListener);
    await adapter.connect({ network: 'mainnet' });

    getClientEventHandler('session_event')({
      topic: 'topic-events',
      params: {
        chainId: 'xrpl:0',
        event: { name: 'accountsChanged', data: [TESTNET_ADDRESS] },
      },
    } as never);

    await expect(adapter.getAccount()).resolves.toMatchObject({ address: TESTNET_ADDRESS });
    expect(accountListener).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TESTNET_ADDRESS,
        network: expect.objectContaining({ id: 'mainnet' }),
      })
    );

    mockClient.request.mockResolvedValue({ tx_json: { TransactionType: 'Payment' } });
    await adapter.sign({ TransactionType: 'Payment' } as never);
    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        chainId: 'xrpl:0',
        request: expect.objectContaining({
          params: expect.objectContaining({
            tx_json: expect.objectContaining({ Account: TESTNET_ADDRESS }),
          }),
        }),
      })
    );
  });

  it('updates the standard network and account from a chainChanged event', async () => {
    approveSession({
      xrpl: {
        chains: ['xrpl:0', 'xrpl:1'],
        accounts: [`xrpl:0:${MAINNET_ADDRESS}`, `xrpl:1:${TESTNET_ADDRESS}`],
      },
    });
    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const accountListener = vi.fn();
    const networkListener = vi.fn();
    adapter.on('accountChanged', accountListener);
    adapter.on('networkChanged', networkListener);
    await adapter.connect({ network: 'mainnet' });

    getClientEventHandler('session_event')({
      topic: 'topic-events',
      params: {
        chainId: 'xrpl:1',
        event: { name: 'chainChanged', data: 'xrpl:1' },
      },
    } as never);

    await expect(adapter.getAccount()).resolves.toMatchObject({
      address: TESTNET_ADDRESS,
      network: { id: 'testnet', walletConnectId: 'xrpl:1' },
    });
    expect(accountListener).toHaveBeenCalledOnce();
    expect(networkListener).toHaveBeenCalledWith(STANDARD_NETWORKS.testnet);
  });

  it('reconciles account authorization from a session update', async () => {
    approveSession({ xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } });
    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const accountListener = vi.fn();
    adapter.on('accountChanged', accountListener);
    await adapter.connect({ network: 'mainnet' });

    getClientEventHandler('session_update')({
      topic: 'topic-events',
      params: { namespaces: { xrpl: { accounts: [`xrpl:0:${TESTNET_ADDRESS}`] } } },
    } as never);

    await expect(adapter.getAccount()).resolves.toMatchObject({ address: TESTNET_ADDRESS });
    expect(accountListener).toHaveBeenCalledOnce();
  });

  it('fails closed when a session update removes XRPL authorization', async () => {
    approveSession({ xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } });
    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const disconnectListener = vi.fn();
    adapter.on('disconnect', disconnectListener);
    await adapter.connect({ network: 'mainnet' });

    getClientEventHandler('session_update')({
      topic: 'topic-events',
      params: { namespaces: {} },
    } as never);

    await expect(adapter.getAccount()).resolves.toBeNull();
    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
    expect(mockClient.request).not.toHaveBeenCalled();
    expect(disconnectListener).toHaveBeenCalledOnce();
  });

  it('removes every session listener on disconnect', async () => {
    approveSession({ xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } });
    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await adapter.connect({ network: 'mainnet' });
    const registrations = new Map(mockClient.on.mock.calls);

    await adapter.disconnect();

    for (const event of ['session_delete', 'session_expire', 'session_event', 'session_update']) {
      expect(mockClient.off).toHaveBeenCalledWith(event, registrations.get(event));
    }
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

  it('maps a rejected request to sign-rejected and retains its cause', async () => {
    const adapter = await connected();
    const rejection = new Error('User rejected the request');
    mockClient.request.mockRejectedValue(rejection);

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
      category: WalletErrorCategory.USER_ACTION,
      originalError: rejection,
    });
  });

  it('throws notConnected before any session is established', async () => {
    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
  });

  it('passes through an existing typed signing error unchanged', async () => {
    const adapter = await connected();
    const typedError = createWalletError.unsupportedMethod('Unsupported by the wallet');
    mockClient.request.mockRejectedValue(typedError);

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toBe(typedError);
  });

  it('maps only unknown signing failures to sign-failed and retains their cause', async () => {
    const adapter = await connected();
    const failure = new Error('Transport unavailable');
    mockClient.request.mockRejectedValue(failure);

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
      originalError: failure,
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

  it('maps a structured Reown rejection to sign-rejected', async () => {
    const adapter = await connected();
    const rejection = { code: 5000, message: 'Request declined.' };
    mockClient.request.mockRejectedValue(rejection);

    await expect(
      adapter.signAndSubmit({ TransactionType: 'Payment' } as never)
    ).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
      category: WalletErrorCategory.USER_ACTION,
      originalError: expect.objectContaining({ cause: rejection }),
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

    await expect(connection).rejects.toMatchObject({ code: WalletErrorCode.CONNECTION_REJECTED });
    expect(mockClient.disconnect).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'late-topic' })
    );
    expect(await adapter.getAccount()).toBeNull();
  });

  it('preserves the cancellation error when disconnecting a late session fails', async () => {
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

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const connection = adapter.connect();
    await vi.waitFor(() => expect(mockClient.connect).toHaveBeenCalledOnce());
    await adapter.disconnect();

    mockClient.disconnect.mockRejectedValue(new Error('Relay unavailable'));
    approve({
      topic: 'late-topic',
      namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
    });

    await expect(connection).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_REJECTED,
      originalError: { message: 'WalletConnect connection was cancelled' },
    });
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

  it('does not let an older disconnect clear a newer connected session', async () => {
    mockClient.connect.mockResolvedValueOnce({
      uri: 'wc:first',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-first',
        namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
      }),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await adapter.connect();

    let finishDisconnect!: () => void;
    mockClient.disconnect.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishDisconnect = resolve;
      })
    );
    const disconnection = adapter.disconnect();
    await vi.waitFor(() => expect(mockClient.disconnect).toHaveBeenCalledOnce());

    mockClient.connect.mockResolvedValueOnce({
      uri: 'wc:second',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-second',
        namespaces: { xrpl: { accounts: [`xrpl:0:${MAINNET_ADDRESS}`] } },
      }),
    });
    await expect(adapter.connect()).resolves.toMatchObject({ address: MAINNET_ADDRESS });

    finishDisconnect();
    await disconnection;

    expect(await adapter.getAccount()).toMatchObject({ address: MAINNET_ADDRESS });
  });

  it('is a no-op when no session exists', async () => {
    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await expect(adapter.disconnect()).resolves.toBeUndefined();
    expect(mockClient.disconnect).not.toHaveBeenCalled();
  });
});
