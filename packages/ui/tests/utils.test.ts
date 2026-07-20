import { describe, it, expect, afterEach } from 'vite-plus/test';

import { isMobile } from '../src/utils';

/**
 * `isMobile` is implemented once in `@xrpl-connect/core` (exhaustively unit-tested
 * there, incl. SSR and `maxTouchPoints` edge cases). These cases are a smoke test
 * of the UI re-export against a real (jsdom) `navigator`, covering both code paths:
 * the user-agent match and the iPadOS desktop-mode touch probe (#16).
 *
 * jsdom exposes `navigator.userAgent` / `navigator.maxTouchPoints` as getters, so
 * we redefine the props per case.
 */
function setNavigator(userAgent: string, maxTouchPoints = 0) {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true });
}

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

describe('isMobile (UI re-export)', () => {
  afterEach(() => {
    setNavigator(DESKTOP_MAC, 0);
  });

  it('detects a phone via the user-agent', () => {
    setNavigator(IPHONE);
    expect(isMobile()).toBe(true);
  });

  it('detects iPadOS 13+ in desktop mode (Macintosh UA + touch) — the #16 gap', () => {
    setNavigator(DESKTOP_MAC, 5);
    expect(isMobile()).toBe(true);
  });

  it('returns false for a real desktop Mac (no touch)', () => {
    setNavigator(DESKTOP_MAC, 0);
    expect(isMobile()).toBe(false);
  });
});
