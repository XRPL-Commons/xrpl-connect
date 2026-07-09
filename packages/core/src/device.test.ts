import { describe, it, expect, afterEach, vi } from 'vitest';

import { isMobile } from './device';

/**
 * `isMobile()` reads the global `navigator`. The core test runs in a `node`
 * environment, so we stub the global per-case (and restore it afterwards).
 */
function setNavigator(userAgent: string, maxTouchPoints = 0) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints });
}

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const DESKTOP_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const DESKTOP_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
// iPadOS 13+ default ("desktop") mode: reports a Macintosh UA, but is a touch device.
const IPAD_DESKTOP_MODE = DESKTOP_MAC;

describe('isMobile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects iPhone', () => {
    setNavigator(IPHONE);
    expect(isMobile()).toBe(true);
  });

  it('detects Android phones', () => {
    setNavigator(ANDROID);
    expect(isMobile()).toBe(true);
  });

  it('returns false for a real desktop Mac (no touch)', () => {
    setNavigator(DESKTOP_MAC, 0);
    expect(isMobile()).toBe(false);
  });

  it('returns false for desktop Windows', () => {
    setNavigator(DESKTOP_WINDOWS, 0);
    expect(isMobile()).toBe(false);
  });

  it('detects iPadOS 13+ in desktop mode (Macintosh UA + touch) — the #16 gap', () => {
    setNavigator(IPAD_DESKTOP_MODE, 5);
    expect(isMobile()).toBe(true);
  });

  it('does not treat a Mac UA with maxTouchPoints <= 1 as mobile', () => {
    setNavigator(DESKTOP_MAC, 1);
    expect(isMobile()).toBe(false);
  });

  it('returns false when navigator is unavailable (SSR / non-DOM)', () => {
    vi.stubGlobal('navigator', undefined);
    expect(isMobile()).toBe(false);
  });
});
