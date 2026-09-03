import { describe, it, expect } from 'vite-plus/test';
import {
  MemoryStorageAdapter,
  Storage,
  STORED_STATE_VERSION,
  type StoredStateEnvelope,
  type StoredStateMigration,
} from './storage';
import type { StoredState } from './types';

const STATE_KEY = 'wallet-state';

const NETWORK = {
  id: 'mainnet',
  name: 'Mainnet',
  wss: 'wss://example',
};

function makeState(overrides: Partial<StoredState> = {}): StoredState {
  return {
    walletId: 'crossmark',
    account: {
      address: 'rExampleAddress',
      network: NETWORK,
    },
    network: NETWORK,
    timestamp: 1_700_000_000_000,
    ...overrides,
  };
}

describe('Storage versioning', () => {
  it('writes a versioned envelope and reads it back', async () => {
    const adapter = new MemoryStorageAdapter();
    const storage = new Storage(adapter);
    const state = makeState();

    await storage.saveState(state);

    const raw = await adapter.get(STATE_KEY);
    expect(raw).not.toBeNull();
    const envelope = JSON.parse(raw!) as StoredStateEnvelope<StoredState>;
    expect(envelope.version).toBe(STORED_STATE_VERSION);
    expect(envelope.payload).toEqual(state);

    const loaded = await storage.loadState();
    expect(loaded).toEqual(state);
  });

  it('migrates a v1 payload to v2 via a registered migration', async () => {
    const adapter = new MemoryStorageAdapter();
    const v1State = makeState({ walletId: 'legacy-id' });
    await adapter.set(STATE_KEY, JSON.stringify({ version: 1, payload: v1State }));

    const renameWalletId: StoredStateMigration = (payload) => {
      const p = payload as StoredState & { walletId: string };
      return { ...p, walletId: `migrated:${p.walletId}` };
    };

    const storage = new Storage({
      adapter,
      version: 2,
      migrations: { 1: renameWalletId },
    });

    const loaded = await storage.loadState();
    expect(loaded?.walletId).toBe('migrated:legacy-id');
    expect(loaded?.account).toEqual(v1State.account);
  });

  it('discards a stored state without an envelope (pre-versioning data)', async () => {
    const adapter = new MemoryStorageAdapter();
    // Simulate data written by an older release: raw StoredState, no envelope.
    await adapter.set(STATE_KEY, JSON.stringify(makeState()));

    const storage = new Storage(adapter);
    const loaded = await storage.loadState();

    expect(loaded).toBeNull();
    expect(await adapter.get(STATE_KEY)).toBeNull();
  });

  it('discards a stored state with a version newer than supported', async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set(
      STATE_KEY,
      JSON.stringify({ version: STORED_STATE_VERSION + 1, payload: makeState() })
    );

    const storage = new Storage(adapter);
    const loaded = await storage.loadState();

    expect(loaded).toBeNull();
    expect(await adapter.get(STATE_KEY)).toBeNull();
  });

  it('discards a stored state when no migration path is registered', async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set(STATE_KEY, JSON.stringify({ version: 1, payload: makeState() }));

    // Bump to v3 with no migrations: load must clear, not throw.
    const storage = new Storage({ adapter, version: 3, migrations: {} });
    const loaded = await storage.loadState();

    expect(loaded).toBeNull();
    expect(await adapter.get(STATE_KEY)).toBeNull();
  });

  it('discards a stored state when migration throws', async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set(STATE_KEY, JSON.stringify({ version: 1, payload: makeState() }));

    const storage = new Storage({
      adapter,
      version: 2,
      migrations: {
        1: () => {
          throw new Error('boom');
        },
      },
    });

    const loaded = await storage.loadState();
    expect(loaded).toBeNull();
    expect(await adapter.get(STATE_KEY)).toBeNull();
  });

  it('returns null and clears storage when the value is malformed JSON', async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set(STATE_KEY, 'not-json{');

    const storage = new Storage(adapter);
    const loaded = await storage.loadState();

    expect(loaded).toBeNull();
    expect(await adapter.get(STATE_KEY)).toBeNull();
  });
});

describe('Storage defaults', () => {
  it('falls back to memory when the localStorage getter throws', async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const restrictedWindow = {} as Window;
    Object.defineProperty(restrictedWindow, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: restrictedWindow,
    });

    try {
      const storage = new Storage();
      const state = makeState();
      await storage.saveState(state);
      await expect(storage.loadState()).resolves.toEqual(state);
    } finally {
      if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  });
});
