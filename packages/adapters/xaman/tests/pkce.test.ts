import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vite-plus/test';
import { codeChallenge, randomHex, sha256, toHex } from '../src/pkce';

describe('sha256', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
  ])('matches the FIPS 180-4 vector for %j', (message, digest) => {
    expect(toHex(sha256(new TextEncoder().encode(message)))).toBe(digest);
  });

  it('matches node:crypto across padding and block boundaries', () => {
    for (const length of [1, 55, 56, 63, 64, 65, 119, 120, 128, 1000, 4096]) {
      const message = randomBytes(length);
      expect(toHex(sha256(message))).toBe(createHash('sha256').update(message).digest('hex'));
    }
  });
});

describe('codeChallenge', () => {
  it('matches the RFC 7636 S256 example', () => {
    expect(codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    );
  });

  it('hashes a 128-character verifier as base64url without padding', () => {
    const verifier = randomHex(globalThis.crypto, 64);
    expect(verifier).toMatch(/^[0-9a-f]{128}$/);
    expect(codeChallenge(verifier)).toBe(createHash('sha256').update(verifier).digest('base64url'));
  });
});
