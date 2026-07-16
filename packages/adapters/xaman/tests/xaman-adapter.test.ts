import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletErrorCode } from '@xrpl-connect/core';
import { encode } from 'xrpl';

const mockXummInstance = {
  authorize: vi.fn(),
  logout: vi.fn(),
  payload: {
    createAndSubscribe: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
  },
};

vi.mock('xumm', () => ({
  Xumm: vi.fn().mockImplementation(() => mockXummInstance),
}));

import { XamanAdapter } from '../src/xaman-adapter';

/**
 * Minimal fake of the browser WebSocket API used by waitForSignature(). Xaman's
 * real websocket push only ever carries `{ signed, txid, ... }` — no tx_blob/hex —
 * so tests drive it with exactly that shape and let the adapter's payload.get()
 * follow-up (also mocked) supply the actual signed data.
 */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  close() {}
  emit(data: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

beforeEach(() => {
  mockXummInstance.authorize.mockReset();
  mockXummInstance.logout.mockReset();
  mockXummInstance.payload.createAndSubscribe.mockReset();
  mockXummInstance.payload.create.mockReset();
  mockXummInstance.payload.get.mockReset();
  FakeWebSocket.instances = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).WebSocket = FakeWebSocket;
});

/** Connect an adapter and stand up a payload whose websocket push resolves `signed`. */
async function signedAdapter() {
  mockXummInstance.authorize.mockResolvedValue({ me: { account: 'rXamanUser' } });
  const adapter = new XamanAdapter({ apiKey: 'test-key' });
  // Without an onQRCode callback, openSignWindow() falls back to window.open(),
  // which doesn't exist in this (Node) test environment — supply a no-op so
  // signing proceeds straight to the websocket wait, same as a headless caller.
  await adapter.connect({ onQRCode: () => {} });

  mockXummInstance.payload.createAndSubscribe.mockImplementation(async () => ({
    created: { uuid: 'payload-uuid', next: { always: 'https://xaman.app/sign/payload-uuid' } },
    websocket: { url: 'wss://fake.xaman/payload-uuid' },
  }));

  return adapter;
}

describe('XamanAdapter.isAvailable', () => {
  it('is always available regardless of options', async () => {
    await expect(new XamanAdapter().isAvailable()).resolves.toBe(true);
    await expect(new XamanAdapter({ apiKey: 'key' }).isAvailable()).resolves.toBe(true);
  });
});

describe('XamanAdapter.connect', () => {
  it('returns account info on a successful authorize', async () => {
    mockXummInstance.authorize.mockResolvedValue({ me: { account: 'rXamanUser' } });
    const adapter = new XamanAdapter({ apiKey: 'test-key' });

    const account = await adapter.connect();

    expect(account.address).toBe('rXamanUser');
    expect(account.network.id).toBe('mainnet');
  });

  it('throws a wrapped connection error when no API key is given', async () => {
    const adapter = new XamanAdapter();
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
    expect(mockXummInstance.authorize).not.toHaveBeenCalled();
  });

  it('wraps an authorization error returned by the SDK', async () => {
    mockXummInstance.authorize.mockResolvedValue(new Error('User rejected'));
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await expect(adapter.connect()).rejects.toMatchObject({
      code: WalletErrorCode.CONNECTION_FAILED,
    });
  });
});

describe('XamanAdapter.sign', () => {
  it('rejects when called before connect (wrapped as a sign failure)', async () => {
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
  });

  it('maps a rejected payload to a sign-rejected error', async () => {
    mockXummInstance.authorize.mockResolvedValue({ me: { account: 'rXamanUser' } });
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await adapter.connect();

    // Spy on the private waitForSignature step indirectly by faking the payload result
    mockXummInstance.payload.createAndSubscribe.mockImplementation(async (_tx, _cb) => {
      // Simulate the SDK invoking the subscription with a rejection.
      // The adapter then awaits a websocket; we short-circuit by throwing.
      throw new Error('Sign rejected by user');
    });

    await expect(adapter.sign({ TransactionType: 'Payment' } as never)).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });
  });

  it('requests options.submit: false, so Xaman does not submit on sign()', async () => {
    const adapter = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue({ response: { hex: null, txid: null } });

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBe(1));
    FakeWebSocket.instances[0].emit({ signed: true, txid: 'ABC123' });
    await signPromise.catch(() => {});

    expect(mockXummInstance.payload.createAndSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ options: { submit: false } })
    );
  });

  it('returns the decoded tx_json/signature/tx_blob from payload.get(), not the websocket push', async () => {
    const adapter = await signedAdapter();
    const signedTxJson = {
      TransactionType: 'Payment',
      Account: 'rG31cLyErnqeVj2eomEjBZtq7PYaupGYzL',
      Destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
      Amount: '1000000',
      Fee: '10',
      Sequence: 1,
      Flags: 0,
      SigningPubKey: 'EDA57EBBCB502C2009EFE17229E8DC865DCCB192C52D7888D624DC9EBADDB815F0',
      TxnSignature:
        'CF299AC2C61FA6093198E3CA5D72EE4C6C77757FC7F7B6D6E1F07AAE66BE064A537DD2AD2D0A9C8B3E95ED66E4AFE71ED0B2F3EB9365AF7F7EBCD763A20A7106',
    };
    const hex = encode(signedTxJson as never);
    mockXummInstance.payload.get.mockResolvedValue({
      response: { hex, txid: 'REALHASH', signer_pubkey: signedTxJson.SigningPubKey },
    });

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBe(1));
    // The websocket push never carries tx_blob/hex — only signed + txid.
    FakeWebSocket.instances[0].emit({ signed: true, txid: 'ABC123' });
    const result = await signPromise;

    expect(mockXummInstance.payload.get).toHaveBeenCalledWith('payload-uuid');
    expect(result.tx_blob).toBe(hex);
    expect(result.signature).toBe(signedTxJson.TxnSignature);
    expect(result.tx_json).toMatchObject({
      TransactionType: 'Payment',
      TxnSignature: signedTxJson.TxnSignature,
    });
    expect(result.hash).toBe(''); // sign() never reports a ledger hash
  });
});

describe('XamanAdapter.signAndSubmit', () => {
  it('requests options.submit: true and reports the ledger hash', async () => {
    const adapter = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue({
      response: { hex: null, txid: 'SUBMITTEDHASH' },
    });

    const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
    await vi.waitFor(() => expect(FakeWebSocket.instances.length).toBe(1));
    FakeWebSocket.instances[0].emit({ signed: true, txid: 'SUBMITTEDHASH' });
    const result = await submitPromise;

    expect(mockXummInstance.payload.createAndSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ options: { submit: true } })
    );
    expect(result.hash).toBe('SUBMITTEDHASH');
  });
});

describe('XamanAdapter.disconnect', () => {
  it('logs out and clears local state', async () => {
    mockXummInstance.authorize.mockResolvedValue({ me: { account: 'rXamanUser' } });
    mockXummInstance.logout.mockResolvedValue(undefined);
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await adapter.connect();
    expect(await adapter.getAccount()).not.toBeNull();

    await adapter.disconnect();

    expect(mockXummInstance.logout).toHaveBeenCalled();
    expect(await adapter.getAccount()).toBeNull();
  });

  it('still clears state when logout throws', async () => {
    mockXummInstance.authorize.mockResolvedValue({ me: { account: 'rXamanUser' } });
    mockXummInstance.logout.mockRejectedValue(new Error('already logged out'));
    const adapter = new XamanAdapter({ apiKey: 'test-key' });
    await adapter.connect();

    await adapter.disconnect();

    expect(await adapter.getAccount()).toBeNull();
  });
});
