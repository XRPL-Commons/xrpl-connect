import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vite-plus/test';
import { codeChallenge, randomHex } from '../src/pkce';

describe('codeChallenge', () => {
  it('matches the RFC 7636 appendix B S256 example', () => {
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
