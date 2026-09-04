import { Buffer } from 'buffer';
import type { ECDSA } from 'xrpl';
// Default-import + destructure: xrpl, elliptic and bip39 are CommonJS, and named
// imports from them fail under Node's ESM loader for consumers that don't bundle/
// interop first (Vite/webpack/etc. handle this transparently; plain `node --experimental`
// ESM does not).
import XrplPkg from 'xrpl';
import EllipticPkg from 'elliptic';
import Bip39Pkg from 'bip39';

const { ECDSA, Wallet, decodeSeed, deriveAddress, deriveKeypair, encodeSeed, isValidClassicAddress } =
  XrplPkg;
const { eddsa: EllipticEddsa } = EllipticPkg;
const { validateMnemonic, wordlists, generateMnemonic: generateBip39Mnemonic } = Bip39Pkg;

export type AddressAlgorithm = 'ed25519' | 'ecdsa-secp256k1';

export interface GeneratedAddress {
  address: string;
  publicKey: string;
  privateKey: string;
  seed: string;
}

export interface ImportedAddress {
  address: string;
  publicKey: string;
  privateKey: string;
  /** Only present when the import method recovers (or is given) an XRPL family seed. */
  seed?: string;
}

const Ed25519 = new EllipticEddsa('ed25519');

const SEED_PATTERN = /^s[a-zA-Z0-9]{28,}$/;
const HEX_PRIVATE_KEY_PATTERN = /^ED[A-F0-9]{64}$/i;
const MNEMONIC_WORD_COUNTS = [12, 15, 18, 21, 24];
const XAMAN_GROUP_COUNT = 8;
const XAMAN_GROUP_PATTERN = /^\d{6}$/;

export class Address {
  static generate(algorithm: AddressAlgorithm = 'ed25519'): GeneratedAddress {
    const wallet = Wallet.generate(algorithm as ECDSA);

    if (!wallet.seed) {
      throw new Error('Wallet.generate() did not return a seed');
    }

    return {
      address: wallet.address,
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
      seed: wallet.seed,
    };
  }

  /** Restores a wallet from its XRPL family seed (e.g. `sEd...` / `sh...`). */
  static importBySeed(seed: string): ImportedAddress {
    const trimmed = typeof seed === 'string' ? seed.trim() : '';

    if (!SEED_PATTERN.test(trimmed)) {
      throw new Error('Value must be a valid XRPL seed.');
    }

    // The seed's own encoded version byte says which curve it belongs to.
    // Wallet.fromSeed() does NOT read that — it silently defaults to ed25519 unless
    // told otherwise, which derives the wrong keypair for a secp256k1 seed.
    const { type } = decodeSeed(trimmed);
    const algorithm = type === 'secp256k1' ? ECDSA.secp256k1 : ECDSA.ed25519;
    const wallet = Wallet.fromSeed(trimmed, { algorithm });

    return {
      address: wallet.address,
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
      seed: wallet.seed ?? trimmed,
    };
  }

  /** Restores a wallet from a BIP-39 mnemonic, using the standard XRPL path (m/44'/144'/0'/0/0). */
  static importByMnemonic(mnemonic: string | string[]): ImportedAddress {
    const phrase = assertValidMnemonic(mnemonic);
    const wallet = Wallet.fromMnemonic(phrase);

    return {
      address: wallet.address,
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
      seed: wallet.seed,
    };
  }

  /**
   * Restores a wallet from a raw ed25519 private key hex (`ED` + 64 hex chars).
   * This key can't be derived back into an XRPL family seed, so the result has no `seed`.
   */
  static importByHex(privateKeyHex: string): ImportedAddress {
    const trimmed = typeof privateKeyHex === 'string' ? privateKeyHex.trim() : '';

    if (!HEX_PRIVATE_KEY_PATTERN.test(trimmed)) {
      throw new Error('Value must be a valid XRPL hexadecimal private key.');
    }

    const hex = trimmed.toUpperCase();
    const rawHex = hex.slice(2); // strip the "ED" prefix before deriving the public key
    const publicKey = `ED${Ed25519.keyFromSecret(Buffer.from(rawHex, 'hex'))
      .getPublic('hex')
      .toUpperCase()}`;

    return {
      address: deriveAddress(publicKey),
      publicKey,
      privateKey: hex,
    };
  }

  /** Restores a wallet from a Xaman app "Secret Numbers" backup (8 groups of 6 digits). */
  static importByXaman(secretNumbers: string[]): ImportedAddress {
    if (
      !Array.isArray(secretNumbers) ||
      secretNumbers.length !== XAMAN_GROUP_COUNT ||
      !secretNumbers.every((group) => typeof group === 'string' && XAMAN_GROUP_PATTERN.test(group))
    ) {
      throw new Error('Value must be an array of exactly 8 six-digit numeric strings.');
    }

    const entropy = secretNumbersToEntropy(secretNumbers);
    const seed = encodeSeed(entropy, 'secp256k1');
    const { publicKey, privateKey } = deriveKeypair(seed);

    return {
      address: deriveAddress(publicKey),
      publicKey,
      privateKey,
      seed,
    };
  }

  // --- Validators + generators for building a form UI around the methods above,
  // without a frontend needing its own copy of any of this — see `examples/facade`. ---

  static isValidSeed(value: unknown): value is string {
    return typeof value === 'string' && SEED_PATTERN.test(value.trim());
  }

  static isValidHex(value: unknown): value is string {
    return typeof value === 'string' && HEX_PRIVATE_KEY_PATTERN.test(value.trim());
  }

  static isValidMnemonic(value: unknown): value is string | string[] {
    if (typeof value !== 'string' && !Array.isArray(value)) return false;
    try {
      assertValidMnemonic(value);
      return true;
    } catch {
      return false;
    }
  }

  /** A fresh, valid, random 12-word BIP-39 mnemonic — for a form's "generate" action. */
  static generateMnemonic(): string {
    return generateBip39Mnemonic();
  }

  static isValidClassicAddress(value: unknown): value is string {
    return typeof value === 'string' && isValidClassicAddress(value.trim());
  }

  /** Whether `group` is a valid Xaman Secret Numbers group at 0-indexed `position`. */
  static isValidXamanGroup(group: unknown, position: number): boolean {
    if (typeof group !== 'string' || !XAMAN_GROUP_PATTERN.test(group)) return false;
    const value = Number(group.slice(0, 5));
    const checksum = Number(group.slice(5));
    return secretNumberChecksum(position, value) === checksum;
  }

  static isValidXamanSecretNumbers(value: unknown): value is string[] {
    return (
      Array.isArray(value) &&
      value.length === XAMAN_GROUP_COUNT &&
      value.every((group, index) => Address.isValidXamanGroup(group, index))
    );
  }

  /** A fresh, checksum-valid, random Xaman Secret Numbers backup — for a form's "generate" action. */
  static generateXamanSecretNumbers(): string[] {
    return Array.from({ length: XAMAN_GROUP_COUNT }, (_, position) => {
      const value = Math.floor(Math.random() * 100000);
      const checksum = secretNumberChecksum(position, value);
      return `${String(value).padStart(5, '0')}${checksum}`;
    });
  }
}

/** Checksum digit baked into the Xaman Secret Numbers format itself. */
function secretNumberChecksum(position: number, value: number): number {
  return (value * (position * 2 + 1)) % 9;
}

function secretNumbersToEntropy(groups: string[]): Buffer {
  const chunks = groups.map((group, index) => {
    const trimmed = group.trim();
    const value = Number(trimmed.slice(0, 5));
    const checksum = Number(trimmed.slice(5));

    if (secretNumberChecksum(index, value) !== checksum) {
      throw new Error(`Invalid checksum in Xaman Secret Numbers group #${index + 1}.`);
    }

    return Buffer.from(value.toString(16).padStart(4, '0'), 'hex');
  });

  return Buffer.concat(chunks);
}

/** Throws a specific message for the first thing wrong with `mnemonic`; returns the normalized phrase if none. */
function assertValidMnemonic(mnemonic: string | string[]): string {
  const words = Array.isArray(mnemonic)
    ? mnemonic
    : (typeof mnemonic === 'string' ? mnemonic.trim() : '').split(/\s+/).filter(Boolean);

  if (!MNEMONIC_WORD_COUNTS.includes(words.length)) {
    throw new Error('Mnemonic must contain exactly 12, 15, 18, 21, or 24 words.');
  }

  if (!words.every((word) => typeof word === 'string' && word.trim().length > 0)) {
    throw new Error('Every mnemonic word must be a non-empty string.');
  }

  const normalized = words.map((word) => word.trim().toLowerCase());
  const englishWordSet = new Set(wordlists.english);
  const unknownWords = [...new Set(normalized.filter((word) => !englishWordSet.has(word)))];

  if (unknownWords.length > 0) {
    throw new Error(
      `Mnemonic contains words that are not in the BIP-39 English wordlist: ${unknownWords.join(', ')}.`
    );
  }

  const phrase = normalized.join(' ');

  if (!validateMnemonic(phrase, wordlists.english)) {
    throw new Error('Mnemonic words are valid, but the BIP-39 checksum is invalid.');
  }

  return phrase;
}
