/**
 * Storage layer for persisting wallet connection state
 */

import type { StorageAdapter, StoredState } from './types';
import { createLogger } from './logger';

/**
 * Logger instance for storage
 */
const logger = createLogger('[Storage]');

/**
 * Current persisted-state schema version. Bump this whenever the shape of
 * `StoredState` changes in a way that's not safely readable by older code,
 * and add a matching entry to `STATE_MIGRATIONS` that maps the previous
 * version's payload to the new shape.
 */
export const STORED_STATE_VERSION = 1;

/**
 * Versioned envelope written to storage. Older callers that read the raw
 * value will see `{ version, payload }` rather than a `StoredState`, and
 * the load path uses `version` to drive migrations.
 */
export interface StoredStateEnvelope<T = unknown> {
  version: number;
  payload: T;
}

/**
 * Migration function for upgrading a stored payload from version `N` to
 * version `N + 1`. Receives the previous payload as `unknown` so each
 * migration is responsible for reshaping it.
 */
export type StoredStateMigration = (payload: unknown) => unknown;

/**
 * Registered migrations keyed by the source version. The entry at key `N`
 * upgrades a payload from version `N` to version `N + 1`. Migrations run
 * sequentially until the payload reaches the current version.
 *
 * v1 is the first versioned schema, so there are no upgrades yet. Anything
 * written before versioning was introduced is treated as unrecognized and
 * cleared rather than silently coerced.
 */
export const STATE_MIGRATIONS: Record<number, StoredStateMigration> = {};

/**
 * LocalStorage-based storage adapter
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly prefix: string = 'xrpl-connect:';

  async get(key: string): Promise<string | null> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }
      return window.localStorage.getItem(this.prefix + key);
    } catch (error) {
      logger.warn('Failed to read from localStorage:', error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      window.localStorage.setItem(this.prefix + key, value);
    } catch (error) {
      logger.warn('Failed to write to localStorage:', error);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      window.localStorage.removeItem(this.prefix + key);
    } catch (error) {
      logger.warn('Failed to remove from localStorage:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      // Clear only xrpl-connect keys
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(this.prefix)) {
          keys.push(key);
        }
      }
      keys.forEach((key) => window.localStorage.removeItem(key));
    } catch (error) {
      logger.warn('Failed to clear localStorage:', error);
    }
  }
}

/**
 * In-memory storage adapter (for testing or SSR)
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private storage: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  async set(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }
}

/**
 * Optional configuration for {@link Storage}. The `version` and `migrations`
 * fields are overridable primarily to allow unit-testing the migration
 * pipeline without mutating module-level state.
 */
export interface StorageOptions {
  adapter?: StorageAdapter;
  version?: number;
  migrations?: Record<number, StoredStateMigration>;
}

/**
 * Storage manager for wallet state
 */
export class Storage {
  private static readonly STATE_KEY = 'wallet-state';
  private adapter: StorageAdapter;
  private version: number;
  private migrations: Record<number, StoredStateMigration>;

  constructor(adapterOrOptions?: StorageAdapter | StorageOptions) {
    const options = normalizeOptions(adapterOrOptions);

    // Default to localStorage if available, otherwise use memory storage
    this.adapter = options.adapter || createDefaultStorageAdapter();
    this.version = options.version ?? STORED_STATE_VERSION;
    this.migrations = options.migrations ?? STATE_MIGRATIONS;
  }

  /**
   * Save wallet connection state
   */
  async saveState(state: StoredState): Promise<void> {
    try {
      const envelope: StoredStateEnvelope<StoredState> = {
        version: this.version,
        payload: state,
      };
      await this.adapter.set(Storage.STATE_KEY, JSON.stringify(envelope));
    } catch (error) {
      logger.warn('Failed to save state:', error);
    }
  }

  /**
   * Load wallet connection state.
   *
   * Reads the stored envelope, runs any registered migrations to bring the
   * payload up to {@link STORED_STATE_VERSION}, and clears the entry instead
   * of throwing when the data is unrecognized, too new, or un-migratable.
   * Callers (notably `WalletManager.autoConnect`) must never see an
   * exception from this method.
   */
  async loadState(): Promise<StoredState | null> {
    let serialized: string | null = null;
    try {
      serialized = await this.adapter.get(Storage.STATE_KEY);
      if (!serialized) {
        return null;
      }

      const raw = JSON.parse(serialized) as unknown;
      const envelope = parseEnvelope(raw);
      if (!envelope) {
        logger.warn('Stored state is not versioned; discarding');
        await this.safeRemove();
        return null;
      }

      const migrated = this.migrate(envelope);
      if (!migrated) {
        await this.safeRemove();
        return null;
      }
      return migrated;
    } catch (error) {
      logger.warn('Failed to load state:', error);
      await this.safeRemove();
      return null;
    }
  }

  /**
   * Clear wallet connection state
   */
  async clearState(): Promise<void> {
    try {
      await this.adapter.remove(Storage.STATE_KEY);
    } catch (error) {
      logger.warn('Failed to clear state:', error);
    }
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    try {
      await this.adapter.clear();
    } catch (error) {
      logger.warn('Failed to clear storage:', error);
    }
  }

  private migrate(envelope: StoredStateEnvelope): StoredState | null {
    let { version, payload } = envelope;

    if (version > this.version) {
      logger.warn(
        `Stored state version ${version} is newer than supported (${this.version}); discarding`
      );
      return null;
    }

    while (version < this.version) {
      const step = this.migrations[version];
      if (!step) {
        logger.warn(`No migration from version ${version}; discarding stored state`);
        return null;
      }
      try {
        payload = step(payload);
      } catch (error) {
        logger.warn(`Migration from version ${version} failed; discarding stored state`, error);
        return null;
      }
      version += 1;
    }

    return payload as StoredState;
  }

  private async safeRemove(): Promise<void> {
    try {
      await this.adapter.remove(Storage.STATE_KEY);
    } catch (error) {
      logger.warn('Failed to remove invalid stored state:', error);
    }
  }
}

function createDefaultStorageAdapter(): StorageAdapter {
  if (typeof window === 'undefined') return new MemoryStorageAdapter();

  try {
    return window.localStorage ? new LocalStorageAdapter() : new MemoryStorageAdapter();
  } catch {
    return new MemoryStorageAdapter();
  }
}

function normalizeOptions(input?: StorageAdapter | StorageOptions): StorageOptions {
  if (!input) {
    return {};
  }
  // A StorageAdapter exposes `get`/`set`/`remove`/`clear` as functions;
  // a StorageOptions object does not.
  if (typeof (input as StorageAdapter).get === 'function') {
    return { adapter: input as StorageAdapter };
  }
  return input as StorageOptions;
}

function parseEnvelope(raw: unknown): StoredStateEnvelope | null {
  if (
    raw !== null &&
    typeof raw === 'object' &&
    typeof (raw as { version?: unknown }).version === 'number' &&
    'payload' in (raw as Record<string, unknown>)
  ) {
    return raw as StoredStateEnvelope;
  }
  return null;
}
