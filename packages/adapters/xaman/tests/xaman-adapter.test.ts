import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { XamanAdapter } from '../src/xaman-adapter';

type WsMessage = { signed: boolean; txid?: string; tx_blob?: string; signature?: string };

const flushAsync = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

class FakeWebSocket {
  public static last: FakeWebSocket | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    FakeWebSocket.last = this;
  }

  close() {
    this.closed = true;
    this.onclose?.();
  }

  emit(message: WsMessage) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const createMockPayload = () => ({
  created: { next: { always: 'https://xaman.app/sign/abc' } },
  websocket: { url: 'wss://xaman.app/sign/abc' },
});

const xummMocks = vi.hoisted(() => ({
  createAndSubscribe: vi.fn(),
  authorize: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('xumm', () => {
  return {
    Xumm: vi.fn().mockImplementation(() => ({
      payload: { createAndSubscribe: xummMocks.createAndSubscribe },
      authorize: xummMocks.authorize,
      logout: xummMocks.logout,
    })),
  };
});

const seedConnectedAccount = (adapter: XamanAdapter) => {
  // Bypass OAuth — directly seed the connected-account state the sign* methods need.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const internal = adapter as any;
  internal.client = {
    payload: { createAndSubscribe: xummMocks.createAndSubscribe },
  };
  internal.currentAccount = {
    address: 'rTestAccount',
    publicKey: undefined,
    network: { id: 'mainnet', name: 'Mainnet', wss: 'wss://xrplcluster.com' },
  };
};

describe('XamanAdapter sign popup lifecycle', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;
  let popupClose: ReturnType<typeof vi.fn>;
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeEach(() => {
    popupClose = vi.fn();
    const popup = { close: popupClose, closed: false } as unknown as Window;
    openSpy = vi.spyOn(window, 'open').mockReturnValue(popup);

    originalWebSocket = globalThis.WebSocket;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocket = FakeWebSocket;
    FakeWebSocket.last = null;

    xummMocks.createAndSubscribe.mockReset();
    xummMocks.authorize.mockReset();
    xummMocks.logout.mockReset();
  });

  afterEach(() => {
    openSpy.mockRestore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocket = originalWebSocket;
  });

  it('closes the sign popup after a successful signAndSubmit', async () => {
    xummMocks.createAndSubscribe.mockResolvedValue(createMockPayload());

    const adapter = new XamanAdapter({ apiKey: 'test' });
    seedConnectedAccount(adapter);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as any);

    // Wait a tick so the adapter opens the popup and subscribes to the WS
    await flushAsync();

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.last).not.toBeNull();

    FakeWebSocket.last!.emit({
      signed: true,
      txid: 'TX123',
      tx_blob: 'BLOB',
      signature: 'SIG',
    });

    const result = await submitPromise;
    expect(result.hash).toBe('TX123');
    expect(popupClose).toHaveBeenCalledTimes(1);
  });

  it('closes the sign popup when the user rejects', async () => {
    xummMocks.createAndSubscribe.mockResolvedValue(createMockPayload());

    const adapter = new XamanAdapter({ apiKey: 'test' });
    seedConnectedAccount(adapter);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signPromise = adapter.sign({ TransactionType: 'Payment' } as any);

    await flushAsync();

    expect(FakeWebSocket.last).not.toBeNull();
    FakeWebSocket.last!.emit({ signed: false });

    await expect(signPromise).rejects.toThrow();
    expect(popupClose).toHaveBeenCalledTimes(1);
  });

  it('closes the sign popup after signMessage settles', async () => {
    xummMocks.createAndSubscribe.mockResolvedValue(createMockPayload());

    const adapter = new XamanAdapter({ apiKey: 'test' });
    seedConnectedAccount(adapter);

    const signMessagePromise = adapter.signMessage('hello');

    await flushAsync();

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.last).not.toBeNull();

    FakeWebSocket.last!.emit({
      signed: true,
      txid: 'TX_SIGNIN',
      tx_blob: 'SIGNIN_BLOB',
      signature: 'SIGNIN_SIG',
    });

    const result = await signMessagePromise;
    expect(result.signature).toBe('SIGNIN_SIG');
    expect(popupClose).toHaveBeenCalledTimes(1);
  });

  it('does not open a popup when an onQRCode callback is provided', async () => {
    const onQRCode = vi.fn();
    xummMocks.createAndSubscribe.mockResolvedValue(createMockPayload());

    const adapter = new XamanAdapter({ apiKey: 'test', onQRCode });
    seedConnectedAccount(adapter);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as any);

    await flushAsync();

    expect(openSpy).not.toHaveBeenCalled();
    expect(onQRCode).toHaveBeenCalledWith('https://xaman.app/sign/abc');

    FakeWebSocket.last!.emit({ signed: true, txid: 'T', tx_blob: 'B', signature: 'S' });
    await submitPromise;

    expect(popupClose).not.toHaveBeenCalled();
  });

  it('does not throw if window.open returns null (popup blocked)', async () => {
    openSpy.mockReturnValue(null);
    xummMocks.createAndSubscribe.mockResolvedValue(createMockPayload());

    const adapter = new XamanAdapter({ apiKey: 'test' });
    seedConnectedAccount(adapter);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const submitPromise = adapter.signAndSubmit({ TransactionType: 'Payment' } as any);
    await flushAsync();

    FakeWebSocket.last!.emit({ signed: true, txid: 'T', tx_blob: 'B', signature: 'S' });
    await expect(submitPromise).resolves.toBeDefined();
  });
});
