import { describe, it, expect, vi, afterEach } from 'vite-plus/test';
import { withTimeout } from './async';

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the promise value when it settles in time', async () => {
    const result = await withTimeout(() => Promise.resolve('ok'), 1000, 'fallback');
    expect(result).toBe('ok');
  });

  it('resolves with the fallback when the promise never settles', async () => {
    vi.useFakeTimers();
    // A promise that never resolves — models a hung isAvailable().
    const pending = new Promise<string>(() => {});
    const raced = withTimeout(() => pending, 1000, 'fallback');

    await vi.advanceTimersByTimeAsync(1000);

    await expect(raced).resolves.toBe('fallback');
  });

  it('resolves with the fallback when the promise rejects', async () => {
    const result = await withTimeout(() => Promise.reject(new Error('boom')), 1000, false);
    expect(result).toBe(false);
  });

  it('resolves with the fallback when the operation throws synchronously', async () => {
    const result = await withTimeout<string>(
      () => {
        throw new Error('boom');
      },
      1000,
      'fallback'
    );

    expect(result).toBe('fallback');
  });

  it('does not override the value if the promise settles just before timeout', async () => {
    vi.useFakeTimers();
    let resolveInner!: (v: string) => void;
    const inner = new Promise<string>((resolve) => {
      resolveInner = resolve;
    });
    const raced = withTimeout(() => inner, 1000, 'fallback');

    resolveInner('value');
    await vi.advanceTimersByTimeAsync(2000);

    await expect(raced).resolves.toBe('value');
  });
});
