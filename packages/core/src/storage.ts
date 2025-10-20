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
 * Storage manager for wallet state
 */
export class Storage {
  private static readonly STATE_KEY = 'wallet-state';
  private adapter: StorageAdapter;

  constructor(adapter?: StorageAdapter) {
    // Default to localStorage if available, otherwise use memory storage
    this.adapter =
      adapter ||
      (typeof window !== 'undefined' && window.localStorage
        ? new LocalStorageAdapter()
        : new MemoryStorageAdapter());
  }

  /**
   * Save wallet connection state
   */
  async saveState(state: StoredState): Promise<void> {
    try {
      const serialized = JSON.stringify(state);
      await this.adapter.set(Storage.STATE_KEY, serialized);
    } catch (error) {
      logger.warn('Failed to save state:', error);
    }
  }

  /**
   * Load wallet connection state
   */
  async loadState(): Promise<StoredState | null> {
    try {
      const serialized = await this.adapter.get(Storage.STATE_KEY);
      if (!serialized) {
        return null;
      }
      return JSON.parse(serialized) as StoredState;
    } catch (error) {
      logger.warn('Failed to load state:', error);
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
}
