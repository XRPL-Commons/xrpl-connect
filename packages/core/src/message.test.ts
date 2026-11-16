import { describe, expect, it } from 'vite-plus/test';
import { decodeMessage } from './message';
import { WalletErrorCategory, WalletErrorCode } from './types';

describe('decodeMessage', () => {
  it('returns string messages unchanged', () => {
    expect(decodeMessage('hello')).toBe('hello');
  });

  it('decodes valid UTF-8 bytes to the text that re-encodes to the same bytes', () => {
    const bytes = new TextEncoder().encode('﻿sign in ✓');

    const decoded = decodeMessage(bytes);

    expect(decoded).toBe('﻿sign in ✓');
    expect(new TextEncoder().encode(decoded)).toEqual(bytes);
  });

  it.each([
    ['a truncated sequence', [0xc3]],
    ['an invalid continuation byte', [0xc3, 0x28]],
    ['an overlong encoding', [0xc0, 0xaf]],
    ['an encoded surrogate', [0xed, 0xa0, 0x80]],
  ])('rejects %s as invalid input instead of substituting U+FFFD', (_label, bytes) => {
    expect(() => decodeMessage(Uint8Array.from(bytes))).toThrow(
      expect.objectContaining({
        code: WalletErrorCode.INVALID_MESSAGE,
        category: WalletErrorCategory.INVALID_INPUT,
      })
    );
  });
});
