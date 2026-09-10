import { describe, it, expect, afterEach } from 'vite-plus/test';
import { STANDARD_NETWORKS, WalletErrorCode, isWalletError } from '@xrpl-connect/core';
import type { NetworkInfo, WalletAdapter } from '@xrpl-connect/core';
import { GhostsigAdapter } from '../src/index';

interface Message {
  origin: string;
  source: unknown;
  data: unknown;
}
type Listener = (event: Message) => void;

/**
 * The app's window and the popup it opens, wired the way two browsing contexts
 * are: what one posts, the other's `message` listeners see, stamped with the
 * sender's origin and source. The page side scripts GHOSTSIG's replies.
 */
function fakeWindows({ blocked = false } = {}) {
  const listeners = new Set<Listener>();
  const received: Record<string, unknown>[] = [];
  const popup = {
    closed: false,
    close() {
      this.closed = true;
    },
    postMessage(data: Record<string, unknown>) {
      received.push(data);
    },
  };
  const dapp = {
    opened: 0,
    outerWidth: 1440,
    outerHeight: 900,
    screenX: 0,
    screenY: 0,
    screen: { width: 1440, height: 900 },
    addEventListener(type: string, fn: Listener) {
      if (type === 'message') listeners.add(fn);
    },
    removeEventListener(_type: string, fn: Listener) {
      listeners.delete(fn);
    },
    open() {
      dapp.opened += 1;
      if (blocked) return null;
      popup.closed = false;
      return popup;
    },
  };
  const post = (data: unknown) => {
    for (const fn of [...listeners]) fn({ origin: 'https://ghostsig.dev', source: popup, data });
  };
  const page = {
    last: () => received[received.length - 1],
    /** The page says ready, then answers the request it received. */
    answer(result: unknown) {
      post({ ghostsig: 1, type: 'ready' });
      post({ ghostsig: 1, id: page.last().id, type: 'result', result });
    },
    refuse(error: { code: number; message: string }) {
      post({ ghostsig: 1, type: 'ready' });
      post({ ghostsig: 1, id: page.last().id, type: 'error', error });
    },
    close() {
      post({ ghostsig: 1, type: 'ready' });
      popup.closed = true;
    },
  };
  (globalThis as { window?: unknown }).window = dapp;
  return { dapp, page, popup };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

const RAW_KEY = 'ab'.repeat(32);
const ACCOUNT = { address: 'rGHOSTSIGxxxxxxxxxxxxxxxxxxxxxxxxxx', publicKey: RAW_KEY };
const PUBLIC_KEY = `ED${RAW_KEY.toUpperCase()}`;
/** A sign reply in the shape the page returns. */
const SIGNED = {
  ...ACCOUNT,
  hash: 'CAFE',
  blob: '1200',
  signature: 'ff'.repeat(64),
};
const TX = { TransactionType: 'AccountSet', Account: ACCOUNT.address };

async function rejection(p: Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await p;
  } catch (e) {
    expect(isWalletError(e)).toBe(true);
    return e as { code: string; message: string };
  }
  throw new Error('resolved, expected a rejection');
}

async function connected(network: string | NetworkInfo = 'testnet') {
  const windows = fakeWindows();
  const adapter = new GhostsigAdapter();
  const p = adapter.connect({ network });
  windows.page.answer(ACCOUNT);
  await p;
  return { adapter, ...windows };
}

describe('GhostsigAdapter metadata', () => {
  it('declares id, name, icon, url and the message-signing gap', () => {
    const adapter: WalletAdapter = new GhostsigAdapter();
    expect(adapter.id).toBe('ghostsig');
    expect(adapter.name).toBe('GHOSTSIG');
    expect(adapter.url).toBe('https://ghostsig.dev');
    expect(adapter.icon).toMatch(/^data:image\/svg\+xml,/);
    expect(adapter.capabilities).toEqual({ signMessage: false });
  });
});

describe('GhostsigAdapter.isAvailable', () => {
  it('returns false in a non-browser environment', async () => {
    await expect(new GhostsigAdapter().isAvailable()).resolves.toBe(false);
  });

  it('returns true when window.open is available', async () => {
    fakeWindows();
    await expect(new GhostsigAdapter().isAvailable()).resolves.toBe(true);
  });

  it('returns false when window.open is not a function', async () => {
    (globalThis as { window?: unknown }).window = {};
    await expect(new GhostsigAdapter().isAvailable()).resolves.toBe(false);
  });
});

describe('GhostsigAdapter.connect', () => {
  it('opens the wallet page and returns the account with the ED-prefixed key', async () => {
    const { dapp, page } = fakeWindows();
    const adapter = new GhostsigAdapter();
    const events: unknown[] = [];
    adapter.on('connect', (account) => events.push(account));

    const p = adapter.connect({ network: 'testnet' });
    expect(dapp.opened).toBe(1);
    page.answer(ACCOUNT);
    const account = await p;

    expect(page.last()).toMatchObject({
      ghostsig: 1,
      type: 'request',
      method: 'connect',
      chain: 'xrpl',
      network: 'testnet',
    });
    expect(account).toEqual({
      address: ACCOUNT.address,
      publicKey: PUBLIC_KEY,
      network: STANDARD_NETWORKS.testnet,
    });
    expect(events).toEqual([account]);
    await expect(adapter.getAccount()).resolves.toBe(account);
    await expect(adapter.getNetwork()).resolves.toBe(STANDARD_NETWORKS.testnet);
  });

  it('defaults to mainnet and accepts a standard NetworkInfo', async () => {
    const { page } = fakeWindows();
    const p = new GhostsigAdapter().connect();
    page.answer(ACCOUNT);
    expect((await p).network).toBe(STANDARD_NETWORKS.mainnet);

    const { adapter } = await connected(STANDARD_NETWORKS.devnet);
    await expect(adapter.getNetwork()).resolves.toBe(STANDARD_NETWORKS.devnet);
  });

  it('refuses a custom endpoint before opening a popup', async () => {
    const { dapp } = fakeWindows();
    const e = await rejection(
      new GhostsigAdapter().connect({
        network: { id: 'xahau', name: 'Xahau', wss: 'wss://xahau.example' },
      })
    );
    expect(e.code).toBe(WalletErrorCode.NETWORK_NOT_SUPPORTED);
    expect(dapp.opened).toBe(0);
  });

  it('restores a stored account without a popup and serializes it back', async () => {
    const { adapter } = await connected();
    const stored = adapter.serializeReconnectOptions({ network: 'testnet' });
    expect(stored).toEqual({ ghostsig: { address: ACCOUNT.address, publicKey: PUBLIC_KEY } });

    const { dapp } = fakeWindows();
    const again = new GhostsigAdapter();
    const account = await again.connect({ network: 'testnet', ...stored });
    expect(dapp.opened).toBe(0);
    expect(account.address).toBe(ACCOUNT.address);
    expect(new GhostsigAdapter().serializeReconnectOptions({})).toBeUndefined();
  });

  it('maps a declined prompt to CONNECTION_REJECTED', async () => {
    const { page } = fakeWindows();
    const p = new GhostsigAdapter().connect();
    page.refuse({ code: -4, message: 'declined' });
    expect((await rejection(p)).code).toBe(WalletErrorCode.CONNECTION_REJECTED);
  });

  it('maps a closed popup to CONNECTION_REJECTED', async () => {
    const { page } = fakeWindows();
    const p = new GhostsigAdapter().connect();
    page.close();
    expect((await rejection(p)).code).toBe(WalletErrorCode.CONNECTION_REJECTED);
  });

  it('maps a page refusal to CONNECTION_FAILED with the reason', async () => {
    const { page } = fakeWindows();
    const p = new GhostsigAdapter().connect();
    page.refuse({ code: -3, message: 'unknown network' });
    const e = await rejection(p);
    expect(e.code).toBe(WalletErrorCode.CONNECTION_FAILED);
    expect(e.message).toContain('unknown network');
  });

  it('maps a blocked popup to WALLET_NOT_AVAILABLE', async () => {
    fakeWindows({ blocked: true });
    const e = await rejection(new GhostsigAdapter().connect());
    expect(e.code).toBe(WalletErrorCode.WALLET_NOT_AVAILABLE);
  });

  it('drops an answer that arrives after disconnect', async () => {
    const { page } = fakeWindows();
    const adapter = new GhostsigAdapter();
    const events: string[] = [];
    adapter.on('connect', () => events.push('connect'));
    adapter.on('disconnect', () => events.push('disconnect'));
    const p = adapter.connect();
    await adapter.disconnect();
    page.answer(ACCOUNT);
    expect((await rejection(p)).code).toBe(WalletErrorCode.NOT_CONNECTED);
    expect(events).toEqual(['disconnect']);
    await expect(adapter.getAccount()).resolves.toBeNull();
  });

  it('emits mapped errors, survives a throwing listener, and stops after off', async () => {
    const adapter = new GhostsigAdapter();
    const errors: unknown[] = [];
    const throwing = () => {
      throw new Error('listener');
    };
    const record = (e: unknown) => errors.push(e);
    adapter.on('error', throwing);
    adapter.on('error', record);
    fakeWindows({ blocked: true });
    const first = await rejection(adapter.connect());
    expect(errors).toEqual([first]);

    adapter.off('error', record);
    await rejection(adapter.connect());
    expect(errors).toEqual([first]);
  });
});

describe('GhostsigAdapter.sign', () => {
  it('posts the transaction as JSON with the account filled and submit false, and maps the reply', async () => {
    const { adapter, page, dapp } = await connected();
    const p = adapter.sign({ TransactionType: 'AccountSet' });
    page.answer({ ...SIGNED, handOver: 'below quorum' });
    const signed = await p;

    const request = page.last() as {
      method: string;
      params: { payload: string; submit: boolean; address: string };
    };
    expect(request.method).toBe('sign');
    expect(request.params.submit).toBe(false);
    expect(request.params.address).toBe(ACCOUNT.address);
    expect(JSON.parse(request.params.payload)).toEqual(TX);
    expect(signed).toEqual({
      hash: 'CAFE',
      tx_blob: '1200',
      signature: SIGNED.signature,
      signerAddress: ACCOUNT.address,
      handOver: 'below quorum',
    });
    expect(dapp.opened, 'a signature after a connect reuses the popup').toBe(1);
  });

  it('throws NOT_CONNECTED before connect', async () => {
    fakeWindows();
    expect((await rejection(new GhostsigAdapter().sign(TX))).code).toBe(
      WalletErrorCode.NOT_CONNECTED
    );
  });

  it('maps a declined prompt to SIGN_REJECTED', async () => {
    const { adapter, page } = await connected();
    const p = adapter.sign(TX);
    page.refuse({ code: -4, message: 'declined' });
    expect((await rejection(p)).code).toBe(WalletErrorCode.SIGN_REJECTED);
  });

  it('refuses a signature for another account', async () => {
    const { adapter, page } = await connected();
    const p = adapter.sign(TX);
    page.answer({ ...SIGNED, address: 'rSOMEONE' });
    expect((await rejection(p)).code).toBe(WalletErrorCode.SIGN_FAILED);
  });
});

describe('GhostsigAdapter.signAndSubmit', () => {
  it('posts submit true and reports the ledger outcome', async () => {
    const { adapter, page } = await connected();
    const p = adapter.signAndSubmit(TX);
    page.answer({ ...SIGNED, submitted: { kind: 'validated', ledger: 101, ok: true } });
    const out = await p;
    expect((page.last() as { params: { submit: boolean } }).params.submit).toBe(true);
    expect(out).toMatchObject({
      hash: 'CAFE',
      tx_blob: '1200',
      signerAddress: ACCOUNT.address,
      submitted: { kind: 'validated', ok: true },
    });
  });

  it('turns a refused submission into SIGN_FAILED with the result code', async () => {
    const { adapter, page } = await connected();
    const p = adapter.signAndSubmit(TX);
    page.answer({ ...SIGNED, submitted: { kind: 'refused', code: 'temBAD_FEE', ok: false } });
    const e = await rejection(p);
    expect(e.code).toBe(WalletErrorCode.SIGN_FAILED);
    expect(e.message).toContain('temBAD_FEE');
  });
});

describe('GhostsigAdapter.signMessage', () => {
  it('is unsupported', async () => {
    const { adapter } = await connected();
    expect((await rejection(adapter.signMessage('hi'))).code).toBe(
      WalletErrorCode.UNSUPPORTED_METHOD
    );
  });
});

describe('GhostsigAdapter.disconnect', () => {
  it('drops the account and emits', async () => {
    const { adapter } = await connected();
    let gone = 0;
    adapter.on('disconnect', () => {
      gone += 1;
    });
    await adapter.disconnect();
    expect(gone).toBe(1);
    await expect(adapter.getAccount()).resolves.toBeNull();
    expect((await rejection(adapter.getNetwork())).code).toBe(WalletErrorCode.NOT_CONNECTED);
  });
});
