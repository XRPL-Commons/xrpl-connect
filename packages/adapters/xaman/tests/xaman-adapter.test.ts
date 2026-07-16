import { describe, it, expect, expectTypeOf, vi, beforeEach } from 'vitest';
import { WalletErrorCode, type Transaction } from '@xrpl-connect/core';
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

const SIGNED_TX_JSON = {
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
const SIGNED_TX_HEX = encode(SIGNED_TX_JSON as never);

type PayloadEventCallback = (event: {
  data: Record<string, unknown>;
}) => unknown | Promise<unknown>;

function createSubscriptionHarness() {
  let callback: PayloadEventCallback | undefined;
  let resolveOutcome: ((outcome: unknown) => void) | undefined;
  const resolved = new Promise<unknown>((resolve) => {
    resolveOutcome = resolve;
  });
  const close = vi.fn();

  mockXummInstance.payload.createAndSubscribe.mockImplementation(async (_body, onEvent) => {
    callback = onEvent as PayloadEventCallback;
    return {
      created: {
        uuid: 'payload-uuid',
        next: { always: 'https://xaman.app/sign/payload-uuid' },
      },
      resolved,
      resolve: close,
    };
  });

  return {
    close,
    async emit(data: Record<string, unknown>) {
      await vi.waitFor(() => expect(callback).toBeDefined());
      const outcome = await callback?.({ data });
      if (outcome !== undefined) resolveOutcome?.(outcome);
    },
  };
}

function resolvedPayload(
  submit: boolean,
  responseOverrides: Record<string, unknown> = {},
  metaOverrides: Record<string, unknown> = {}
) {
  return {
    meta: {
      resolved: true,
      signed: true,
      submit,
      ...metaOverrides,
    },
    response: {
      hex: SIGNED_TX_HEX,
      txid: 'REALHASH',
      signer_pubkey: SIGNED_TX_JSON.SigningPubKey,
      dispatched_to_node: submit ? true : null,
      dispatched_result: submit ? 'tesSUCCESS' : null,
      ...responseOverrides,
    },
  };
}

beforeEach(() => {
  mockXummInstance.authorize.mockReset();
  mockXummInstance.logout.mockReset();
  mockXummInstance.payload.createAndSubscribe.mockReset();
  mockXummInstance.payload.create.mockReset();
  mockXummInstance.payload.get.mockReset();
});

async function signedAdapter() {
  mockXummInstance.authorize.mockResolvedValue({ me: { account: 'rXamanUser' } });
  const adapter = new XamanAdapter({ apiKey: 'test-key' });
  // Without an onQRCode callback, openSignWindow() falls back to window.open(),
  // which doesn't exist in this (Node) test environment — supply a no-op so
  // signing proceeds straight to the subscription wait, same as a headless caller.
  await adapter.connect({ onQRCode: () => {} });

  return { adapter, subscription: createSubscriptionHarness() };
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
    const { adapter, subscription } = await signedAdapter();
    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_REJECTED,
    });

    await subscription.emit({ signed: false });
    await rejection;
    expect(mockXummInstance.payload.get).not.toHaveBeenCalled();
    expect(subscription.close).toHaveBeenCalledTimes(1);
  });

  it('closes an expired subscription and reports a sign failure', async () => {
    const { adapter, subscription } = await signedAdapter();
    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });

    await subscription.emit({ expired: true, signed: false });
    await rejection;
    expect(mockXummInstance.payload.get).not.toHaveBeenCalled();
    expect(subscription.close).toHaveBeenCalledTimes(1);
  });

  it('uses one SDK subscription and returns authoritative signed data without submitting', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(resolvedPayload(false));

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    await subscription.emit({ opened: true });
    expect(subscription.close).not.toHaveBeenCalled();
    await subscription.emit({ signed: true, txid: 'UNTRUSTED_WEBSOCKET_HASH' });
    const result = await signPromise;

    expect(mockXummInstance.payload.createAndSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ options: { submit: false } }),
      expect.any(Function)
    );
    expect(mockXummInstance.payload.get).toHaveBeenCalledWith('payload-uuid', true);
    expect(result.hash).toBe('REALHASH');
    expect(result.tx_blob).toBe(SIGNED_TX_HEX);
    expect(result.signature).toBe(SIGNED_TX_JSON.TxnSignature);
    expect(result.tx_json).toMatchObject({
      TransactionType: 'Payment',
      TxnSignature: SIGNED_TX_JSON.TxnSignature,
    });
    expect(subscription.close).toHaveBeenCalledTimes(1);
    expectTypeOf(result.tx_blob).toEqualTypeOf<string | undefined>();
    expectTypeOf(result.signature).toEqualTypeOf<string | undefined>();
    expectTypeOf(result.tx_json).toEqualTypeOf<Transaction | undefined>();
  });

  it.each([
    ['a missing resolved payload', null],
    ['an unresolved payload', resolvedPayload(false, {}, { resolved: false })],
    ['a missing signed blob', resolvedPayload(false, { hex: null })],
    ['a malformed signed blob', resolvedPayload(false, { hex: 'NOT_HEX' })],
    ['a missing transaction hash', resolvedPayload(false, { txid: null })],
  ])('fails when payload.get() returns %s', async (_description, resolved) => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(resolved);

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    await subscription.emit({ signed: true });

    await rejection;
    expect(subscription.close).toHaveBeenCalledTimes(1);
  });

  it('fails if Xaman dispatches a sign-only transaction', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(false, { dispatched_to_node: true, dispatched_result: 'tesSUCCESS' })
    );

    const signPromise = adapter.sign({ TransactionType: 'Payment' } as never);
    const rejection = expect(signPromise).rejects.toMatchObject({
      code: WalletErrorCode.SIGN_FAILED,
    });
    await subscription.emit({ signed: true });

    await rejection;
    expect(subscription.close).toHaveBeenCalledTimes(1);
  });
});

describe('XamanAdapter.signAndSubmit', () => {
  it('returns signed data only after Xaman reports a successful node dispatch', async () => {
    const { adapter, subscription } = await signedAdapter();
    mockXummInstance.payload.get.mockResolvedValue(
      resolvedPayload(true, { txid: 'SUBMITTEDHASH' })
    );

    const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
    await subscription.emit({ signed: true, txid: 'UNTRUSTED_WEBSOCKET_HASH' });
    const result = await submitPromise;

    expect(mockXummInstance.payload.createAndSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({ options: { submit: true } }),
      expect.any(Function)
    );
    expect(result.hash).toBe('SUBMITTEDHASH');
    expect(result.tx_blob).toBe(SIGNED_TX_HEX);
    expect(result.signature).toBe(SIGNED_TX_JSON.TxnSignature);
    expect(result.tx_json).toMatchObject({ TransactionType: 'Payment' });
    expect(subscription.close).toHaveBeenCalledTimes(1);
    expectTypeOf(result.tx_blob).toEqualTypeOf<string | undefined>();
    expectTypeOf(result.signature).toEqualTypeOf<string | undefined>();
    expectTypeOf(result.tx_json).toEqualTypeOf<Transaction | undefined>();
  });

  it.each(['terQUEUED', 'tecPATH_DRY'])(
    'preserves the transaction hash for an accepted %s result',
    async (dispatchResult) => {
      const { adapter, subscription } = await signedAdapter();
      mockXummInstance.payload.get.mockResolvedValue(
        resolvedPayload(true, { dispatched_result: dispatchResult })
      );

      const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
      await subscription.emit({ signed: true });

      await expect(submitPromise).resolves.toMatchObject({ hash: 'REALHASH' });
      expect(subscription.close).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    ['no node dispatch', false, null],
    ['a tef failure', true, 'tefPAST_SEQ'],
    ['a malformed transaction', true, 'temBAD_FEE'],
    ['a non-queued retry result', true, 'terPRE_SEQ'],
  ])(
    'fails submission after %s even when a txid exists',
    async (_description, dispatched, result) => {
      const { adapter, subscription } = await signedAdapter();
      mockXummInstance.payload.get.mockResolvedValue(
        resolvedPayload(true, {
          dispatched_to_node: dispatched,
          dispatched_result: result,
        })
      );

      const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as never);
      const rejection = expect(submitPromise).rejects.toMatchObject({
        code: WalletErrorCode.SIGN_FAILED,
      });
      await subscription.emit({ signed: true });

      await rejection;
      expect(subscription.close).toHaveBeenCalledTimes(1);
    }
  );
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
