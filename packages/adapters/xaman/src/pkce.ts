// Synchronous on purpose: the sign-in window must open within the user's click, and
// WebCrypto digests are asynchronous and unavailable on insecure origins.
import { sha256 } from '@noble/hashes/sha2';

/** Hex encoding of `length` cryptographically random bytes. */
export function randomHex(crypto: Pick<Crypto, 'getRandomValues'>, length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** RFC 7636 S256 code challenge: base64url(SHA-256(ASCII(code_verifier))). */
export function codeChallenge(verifier: string): string {
  const digest = sha256(new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...digest))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
