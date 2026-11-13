import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { STANDARD_NETWORKS, WalletErrorCode, isWalletError } from '@xrpl-connect/core';
import type { NetworkInfo, WalletAdapter } from '@xrpl-connect/core';

const mockClient = {
  connect: vi.fn(),
  sign: vi.fn(),
  signAndSubmit: vi.fn(),
};
const constructed: unknown[] = [];

// The real ClaspError, so the adapter's error mapping sees what the SDK throws.
vi.mock('clasp-connect', async (importOriginal) => {
  const actual = await importOriginal<typeof import('clasp-connect')>();
  return {
    ...actual,
    ClaspConnect: vi.fn().mockImplementation(function (options: unknown) {
      constructed.push(options);
      return mockClient;
    }),
  };
});

import { ClaspError } from 'clasp-connect';
import { ClaspAdapter } from '../src/index';
import { CLASP_URL } from '../src/clasp-adapter';

const ADDRESS = 'rEzuT5Grm7tyFYP4QqX58pcvfCaJjKzcnG';
const PUBLIC_KEY = `ED${'AB'.repeat(32)}`;
const HASH = 'C'.repeat(64);
const TX = { TransactionType: 'AccountSet', Account: ADDRESS } as const;

function installWindow(value: unknown) {
  const w = globalThis as unknown as { window?: unknown };
  if (value === undefined) delete w.window;
  else w.window = value;
}

async function rejection(
  p: Promise<unknown>
): Promise<{ code: string; message: string; originalError?: Error }> {
  try {
    await p;
  } catch (e) {
    expect(isWalletError(e)).toBe(true);
    return e as { code: string; message: string; originalError?: Error };
  }
  throw new Error('expected a rejection');
}

async function connected(network: 'mainnet' | 'testnet' = 'testnet') {
  const adapter = new ClaspAdapter();
  mockClient.connect.mockResolvedValueOnce({ address: ADDRESS, publicKey: PUBLIC_KEY, network });
  await adapter.connect({ network });
  return adapter;
}

beforeEach(() => {
  mockClient.connect.mockReset();
  mockClient.sign.mockReset();
  mockClient.signAndSubmit.mockReset();
  constructed.length = 0;
});

afterEach(() => {
  installWindow(undefined);
});

describe('ClaspAdapter metadata', () => {
  it('declares id, name, icon, url and the message-signing gap', () => {
    const adapter: WalletAdapter = new ClaspAdapter();
    expect(adapter.id).toBe('clasp');
    expect(adapter.name).toBe('Clasp');
    expect(adapter.url).toBe('https://claspwallet.com');
    expect(adapter.icon).toMatch(/^data:image\/svg\+xml,/);
    expect(adapter.capabilities).toEqual({ signMessage: false });
  });

  it('always talks to claspwallet.com, and passes the timeout through', () => {
    new ClaspAdapter({ timeoutMs: 30_000 });
    expect(constructed).toEqual([{ walletUrl: CLASP_URL, timeoutMs: 30_000 }]);
  });
});

describe('ClaspAdapter.isAvailable', () => {
  it('returns false in a non-browser environment', async () => {
    installWindow(undefined);
    await expect(new ClaspAdapter().isAvailable()).resolves.toBe(false);
  });

  it('returns true when window.open is available', async () => {
    installWindow({ open: vi.fn() });
    await expect(new ClaspAdapter().isAvailable()).resolves.toBe(true);
  });

  it('returns false when window.open is not a function', async () => {
    installWindow({});
    await expect(new ClaspAdapter().isAvailable()).resolves.toBe(false);
  });
});

describe('ClaspAdapter.connect', () => {
  it('asks Clasp for the account on the requested network and returns it', async () => {
    const adapter = new ClaspAdapter();
    const events: unknown[] = [];
    adapter.on('connect', (account) => events.push(account));
    mockClient.connect.mockResolvedValueOnce({
      address: ADDRESS,
      publicKey: PUBLIC_KEY,
      network: 'testnet',
    });

    const account = await adapter.connect({ network: 'testnet' });

    expect(mockClient.connect).toHaveBeenCalledWith({ network: 'testnet' });
    expect(account).toEqual({
      address: ADDRESS,
      publicKey: PUBLIC_KEY,
      network: STANDARD_NETWORKS.testnet,
    });
    expect(events).toEqual([account]);
    await expect(adapter.getAccount()).resolves.toEqual(account);
    await expect(adapter.getNetwork()).resolves.toEqual(STANDARD_NETWORKS.testnet);
  });

  it('defaults to mainnet and accepts a standard NetworkInfo', async () => {
    const adapter = new ClaspAdapter();
    mockClient.connect.mockResolvedValueOnce({
      address: ADDRESS,
      publicKey: PUBLIC_KEY,
      network: 'mainnet',
    });
    await adapter.connect();
    expect(mockClient.connect).toHaveBeenLastCalledWith({ network: 'mainnet' });

    mockClient.connect.mockResolvedValueOnce({
      address: ADDRESS,
      publicKey: PUBLIC_KEY,
      network: 'testnet',
    });
    const account = await adapter.connect({ network: STANDARD_NETWORKS.testnet });
    expect(account.network).toEqual(STANDARD_NETWORKS.testnet);
  });

  it('refuses devnet and custom endpoints before opening a popup', async () => {
    const adapter = new ClaspAdapter();
    const custom: NetworkInfo = { id: 'local', name: 'Local', wss: 'ws://localhost:6006' };
    for (const network of ['devnet', custom] as const) {
      await expect(adapter.connect({ network })).rejects.toMatchObject({
        code: WalletErrorCode.NETWORK_NOT_SUPPORTED,
      });
    }
    expect(mockClient.connect).not.toHaveBeenCalled();
  });

  it('rejects an answer for a different network than the one asked for', async () => {
    const adapter = new ClaspAdapter();
    mockClient.connect.mockResolvedValueOnce({
      address: ADDRESS,
      publicKey: PUBLIC_KEY,
      network: 'mainnet',
    });
    const error = await rejection(adapter.connect({ network: 'testnet' }));
    expect(error.code).toBe(WalletErrorCode.NETWORK_MISMATCH);
    await expect(adapter.getAccount()).resolves.toBeNull();
  });

  it('restores a stored account without a popup and serializes it back', async () => {
    const adapter = new ClaspAdapter();
    const account = await adapter.connect({
      network: 'testnet',
      clasp: { address: ADDRESS, publicKey: PUBLIC_KEY },
    });
    expect(mockClient.connect).not.toHaveBeenCalled();
    expect(account).toEqual({
      address: ADDRESS,
      publicKey: PUBLIC_KEY,
      network: STANDARD_NETWORKS.testnet,
    });
    expect(adapter.serializeReconnectOptions({})).toEqual({
      clasp: { address: ADDRESS, publicKey: PUBLIC_KEY },
    });
  });

  it('opens the popup when the stored account is malformed', async () => {
    const adapter = new ClaspAdapter();
    mockClient.connect.mockResolvedValueOnce({
      address: ADDRESS,
      publicKey: PUBLIC_KEY,
      network: 'testnet',
    });
    await adapter.connect({
      network: 'testnet',
      clasp: { address: 'not-an-address', publicKey: PUBLIC_KEY },
    });
    expect(mockClient.connect).toHaveBeenCalledTimes(1);
  });

  it('serializes nothing before a connection', () => {
    expect(new ClaspAdapter().serializeReconnectOptions({})).toBeUndefined();
  });

  it('maps a declined prompt or a closed popup to CONNECTION_REJECTED', async () => {
    const adapter = new ClaspAdapter();
    mockClient.connect.mockRejectedValueOnce(
      new ClaspError('user_rejected', 'The Clasp window was closed.')
    );
    const error = await rejection(adapter.connect({ network: 'testnet' }));
    expect(error.code).toBe(WalletErrorCode.CONNECTION_REJECTED);
  });

  it('maps a blocked popup to WALLET_NOT_AVAILABLE', async () => {
    const adapter = new ClaspAdapter();
    mockClient.connect.mockRejectedValueOnce(new ClaspError('popup_blocked', 'Popup blocked.'));
    const error = await rejection(adapter.connect({ network: 'testnet' }));
    expect(error.code).toBe(WalletErrorCode.WALLET_NOT_AVAILABLE);
  });

  it('maps a timeout to OPERATION_TIMEOUT', async () => {
    const adapter = new ClaspAdapter();
    mockClient.connect.mockRejectedValueOnce(new ClaspError('timeout', 'No answer.'));
    const error = await rejection(adapter.connect({ network: 'testnet' }));
    expect(error.code).toBe(WalletErrorCode.OPERATION_TIMEOUT);
  });

  it('maps mainnet switched off in the wallet to NETWORK_NOT_SUPPORTED', async () => {
    const adapter = new ClaspAdapter();
    mockClient.connect.mockRejectedValueOnce(
      new ClaspError('network_unavailable', 'Mainnet is off.')
    );
    const error = await rejection(adapter.connect({ network: 'mainnet' }));
    expect(error.code).toBe(WalletErrorCode.NETWORK_NOT_SUPPORTED);
  });

  it('maps anything else to CONNECTION_FAILED with the cause', async () => {
    const adapter = new ClaspAdapter();
    const cause = new ClaspError('busy', 'Another Clasp request is already in flight.');
    mockClient.connect.mockRejectedValueOnce(cause);
    const error = await rejection(adapter.connect({ network: 'testnet' }));
    expect(error.code).toBe(WalletErrorCode.CONNECTION_FAILED);
    expect(error.originalError).toBe(cause);
  });

  it('drops an answer that arrives after disconnect', async () => {
    const adapter = new ClaspAdapter();
    let answer!: (value: unknown) => void;
    mockClient.connect.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const pending = adapter.connect({ network: 'testnet' });
    await adapter.disconnect();
    answer({ address: ADDRESS, publicKey: PUBLIC_KEY, network: 'testnet' });
    const error = await rejection(pending);
    expect(error.code).toBe(WalletErrorCode.NOT_CONNECTED);
    await expect(adapter.getAccount()).resolves.toBeNull();
  });

  it('emits mapped errors, survives a throwing listener, and stops after off', async () => {
    const adapter = new ClaspAdapter();
    const seen: unknown[] = [];
    const listener = (e: unknown) => seen.push(e);
    adapter.on('error', () => {
      throw new Error('listener bug');
    });
    adapter.on('error', listener);
    mockClient.connect.mockRejectedValueOnce(new ClaspError('user_rejected', 'No.'));
    await rejection(adapter.connect({ network: 'testnet' }));
    expect(seen).toHaveLength(1);

    adapter.off('error', listener);
    mockClient.connect.mockRejectedValueOnce(new ClaspError('user_rejected', 'No.'));
    await rejection(adapter.connect({ network: 'testnet' }));
    expect(seen).toHaveLength(1);
  });
});

describe('ClaspAdapter.sign', () => {
  it('asks Clasp to sign for the connected account and returns the blob, unsubmitted', async () => {
    const adapter = await connected();
    mockClient.sign.mockResolvedValueOnce({ tx_blob: '1200', hash: HASH });

    const signed = await adapter.sign(TX);

    expect(mockClient.sign).toHaveBeenCalledWith({ network: 'testnet', address: ADDRESS, tx: TX });
    expect(mockClient.signAndSubmit).not.toHaveBeenCalled();
    expect(signed).toEqual({ hash: HASH, tx_blob: '1200', signerAddress: ADDRESS });
  });

  it('throws NOT_CONNECTED before connect', async () => {
    await expect(new ClaspAdapter().sign(TX)).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
    expect(mockClient.sign).not.toHaveBeenCalled();
  });

  it('maps a declined prompt to SIGN_REJECTED', async () => {
    const adapter = await connected();
    mockClient.sign.mockRejectedValueOnce(new ClaspError('user_rejected', 'No.'));
    const error = await rejection(adapter.sign(TX));
    expect(error.code).toBe(WalletErrorCode.SIGN_REJECTED);
  });

  it('maps a passkey for another account to SIGN_FAILED, nothing signed', async () => {
    const adapter = await connected();
    mockClient.sign.mockRejectedValueOnce(
      new ClaspError(
        'wrong_wallet',
        'The approving passkey derives another account. Nothing was signed.'
      )
    );
    const error = await rejection(adapter.sign(TX));
    expect(error.code).toBe(WalletErrorCode.SIGN_FAILED);
    expect(error.originalError?.message).toContain('Nothing was signed');
  });
});

describe('ClaspAdapter.signAndSubmit', () => {
  it('resolves with the validated hash', async () => {
    const adapter = await connected();
    mockClient.signAndSubmit.mockResolvedValueOnce({ hash: HASH, engineResult: 'tesSUCCESS' });

    const submitted = await adapter.signAndSubmit(TX);

    expect(mockClient.signAndSubmit).toHaveBeenCalledWith({
      network: 'testnet',
      address: ADDRESS,
      tx: TX,
    });
    expect(submitted).toEqual({ hash: HASH, engineResult: 'tesSUCCESS' });
  });

  it('rejects a transaction the ledger applied as a tec, naming the hash and the code', async () => {
    const adapter = await connected();
    mockClient.signAndSubmit.mockRejectedValueOnce(
      new ClaspError('tx_failed', 'Not enough XRP.', {
        hash: HASH,
        engineResult: 'tecUNFUNDED_PAYMENT',
      })
    );
    const error = await rejection(adapter.signAndSubmit(TX));
    expect(error.code).toBe(WalletErrorCode.SIGN_FAILED);
    expect(error.originalError?.message).toBe(
      `The transaction failed: tecUNFUNDED_PAYMENT Transaction hash: ${HASH}`
    );
    expect((error.originalError as Error & { transaction?: unknown }).transaction).toEqual({
      hash: HASH,
      engineResult: 'tecUNFUNDED_PAYMENT',
    });
  });

  it('rejects an unconfirmed submission, asking to check the hash before retrying', async () => {
    const adapter = await connected();
    mockClient.signAndSubmit.mockRejectedValueOnce(
      new ClaspError('not_confirmed', 'Not confirmed yet.', { hash: HASH })
    );
    const error = await rejection(adapter.signAndSubmit(TX));
    expect(error.code).toBe(WalletErrorCode.SIGN_FAILED);
    expect(error.originalError?.message).toBe(
      `Submission could not be confirmed. Check the transaction hash before retrying. Transaction hash: ${HASH}`
    );
  });

  it('rejects a refusal that never reached the network as SIGN_FAILED with the reason', async () => {
    const adapter = await connected();
    const cause = new ClaspError(
      'unsupported_tx',
      'Refused unsigned: a field the ledger does not know (Gift).'
    );
    mockClient.signAndSubmit.mockRejectedValueOnce(cause);
    const error = await rejection(adapter.signAndSubmit(TX));
    expect(error.code).toBe(WalletErrorCode.SIGN_FAILED);
    expect(error.originalError).toBe(cause);
  });
});

describe('ClaspAdapter.signMessage', () => {
  it('is unsupported', async () => {
    const adapter = await connected();
    await expect(adapter.signMessage('hello')).rejects.toMatchObject({
      code: WalletErrorCode.UNSUPPORTED_METHOD,
    });
  });
});

describe('ClaspAdapter.disconnect', () => {
  it('drops the account and emits', async () => {
    const adapter = await connected();
    const events: string[] = [];
    adapter.on('disconnect', () => events.push('disconnect'));
    await adapter.disconnect();
    expect(events).toEqual(['disconnect']);
    await expect(adapter.getAccount()).resolves.toBeNull();
    await expect(adapter.getNetwork()).rejects.toMatchObject({
      code: WalletErrorCode.NOT_CONNECTED,
    });
  });
});
