import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletErrorCode } from '@xrpl-connect/core';

const mockClient = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  request: vi.fn(),
  on: vi.fn(),
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
        namespaces: { xrpl: { accounts: ['xrpl:0:rWCAddress'] } },
      }),
    });
    const adapter = new WalletConnectAdapter({ projectId: 'proj-id' });
    await adapter.connect();
    return adapter;
  }

  it('returns a signed tx blob on success', async () => {
    const adapter = await connected();
    mockClient.request.mockResolvedValue({ tx_json: { TxnSignature: 'SIG' } });

    const result = await adapter.sign({ TransactionType: 'Payment' } as never);

    expect(result.tx_blob).toBe('SIG');
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

describe('WalletConnectAdapter.disconnect', () => {
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
