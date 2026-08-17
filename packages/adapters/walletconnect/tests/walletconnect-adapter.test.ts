import { describe, it, expect, expectTypeOf, vi, beforeEach } from 'vite-plus/test';
import {
  createWalletError,
  WalletErrorCategory,
  WalletErrorCode,
  type Transaction,
} from '@xrpl-connect/core';

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

beforeEach(() => {
  SignClientMock.init.mockReset();
  mockClient.connect.mockReset();
  mockClient.disconnect.mockReset();
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
        namespaces: { xrpl: { accounts: ['xrpl:0:rWCAddress'] } },
      }),
    });

    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    const account = await adapter.connect();

    expect(account.address).toBe('rWCAddress');
    expect(account.network.id).toBe('mainnet');
  });

  it('throws a wrapped error when no project ID is provided', async () => {
    const adapter = new WalletConnectAdapter();
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
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

describe('WalletConnectAdapter.sign', () => {
  async function connected() {
    mockClient.connect.mockResolvedValue({
      uri: 'wc:example',
      approval: vi.fn().mockResolvedValue({
        topic: 'topic-1',
        namespaces: { xrpl: { accounts: ['xrpl:0:rWCAddress'] } },
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
        namespaces: { xrpl: { accounts: ['xrpl:0:rWCAddress'] } },
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
      namespaces: { xrpl: { accounts: ['xrpl:0:rLateAddress'] } },
    });

    await expect(connection).rejects.toMatchObject({ code: WalletErrorCode.CONNECTION_REJECTED });
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
        namespaces: { xrpl: { accounts: ['xrpl:0:rWCAddress'] } },
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
