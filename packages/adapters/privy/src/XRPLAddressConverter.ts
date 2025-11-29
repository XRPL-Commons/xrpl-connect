/**
 * XRPL Address Converter
 * Converts public keys from embedded wallets to XRPL addresses
 */

import { encodeAccountID } from 'ripple-address-codec';
import { createHash } from 'crypto';
import type { ChainType } from './types';

/**
 * XRPL Address Converter
 * Handles conversion of secp256k1 and ed25519 public keys to XRPL addresses
 */
export class XRPLAddressConverter {
  /**
   * Convert a secp256k1 public key (from Ethereum wallet) to XRPL address
   *
   * @param publicKey - Hex-encoded public key (with or without 0x prefix)
   * @returns XRPL address (r...)
   */
  static secp256k1ToXRPL(publicKey: string): string {
    // Remove 0x prefix if present
    let pubKeyHex = publicKey.toLowerCase().replace(/^0x/, '');

    // Ensure we have uncompressed public key (65 bytes = 130 hex chars)
    // If compressed (33 bytes = 66 hex chars), we need to decompress
    if (pubKeyHex.length === 66) {
      // Compressed format - we need the full implementation to decompress
      // For now, throw an error as Privy should provide uncompressed keys
      throw new Error('Compressed secp256k1 public keys not yet supported. Please use uncompressed format.');
    }

    if (pubKeyHex.length !== 130) {
      throw new Error(`Invalid secp256k1 public key length: expected 130 hex chars (65 bytes), got ${pubKeyHex.length}`);
    }

    // Remove the 04 prefix if present (indicates uncompressed key)
    if (pubKeyHex.startsWith('04')) {
      pubKeyHex = pubKeyHex.slice(2);
    }

    // Convert hex to buffer
    const pubKeyBuffer = Buffer.from(pubKeyHex, 'hex');

    // Hash with SHA-256
    const sha256Hash = createHash('sha256').update(pubKeyBuffer).digest();

    // Hash with RIPEMD-160
    const ripemd160Hash = createHash('ripemd160').update(sha256Hash).digest();

    // Encode as XRPL address using ripple-address-codec
    const xrplAddress = encodeAccountID(ripemd160Hash);

    return xrplAddress;
  }

  /**
   * Convert an ed25519 public key (from Solana wallet) to XRPL address
   *
   * @param publicKey - Hex-encoded ed25519 public key
   * @returns XRPL address (r...)
   */
  static ed25519ToXRPL(publicKey: string): string {
    // Remove 0x prefix if present
    const pubKeyHex = publicKey.toLowerCase().replace(/^0x/, '');

    // Ed25519 public keys are 32 bytes (64 hex chars)
    if (pubKeyHex.length !== 64) {
      throw new Error(`Invalid ed25519 public key length: expected 64 hex chars (32 bytes), got ${pubKeyHex.length}`);
    }

    // Convert hex to buffer
    const pubKeyBuffer = Buffer.from(pubKeyHex, 'hex');

    // For ed25519, XRPL uses a different account ID derivation
    // We need to prefix with 0xED to indicate ed25519 key type
    const prefixedKey = Buffer.concat([Buffer.from([0xED]), pubKeyBuffer]);

    // Hash with SHA-256
    const sha256Hash = createHash('sha256').update(prefixedKey).digest();

    // Hash with RIPEMD-160
    const ripemd160Hash = createHash('ripemd160').update(sha256Hash).digest();

    // Encode as XRPL address
    const xrplAddress = encodeAccountID(ripemd160Hash);

    return xrplAddress;
  }

  /**
   * Auto-detect chain type and convert to XRPL address
   *
   * @param publicKey - Hex-encoded public key
   * @param chainType - Chain type ('ethereum' for secp256k1, 'solana' for ed25519)
   * @returns XRPL address (r...)
   */
  static convertToXRPL(publicKey: string, chainType: ChainType): string {
    if (chainType === 'ethereum') {
      return this.secp256k1ToXRPL(publicKey);
    } else if (chainType === 'solana') {
      return this.ed25519ToXRPL(publicKey);
    } else {
      throw new Error(`Unsupported chain type: ${chainType}`);
    }
  }

  /**
   * Validate XRPL address format
   *
   * @param address - Address to validate
   * @returns true if valid XRPL address
   */
  static isValidXRPLAddress(address: string): boolean {
    // XRPL addresses start with 'r' and are Base58 encoded
    // Length is typically 25-35 characters
    const xrplAddressRegex = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
    return xrplAddressRegex.test(address);
  }

  /**
   * Get account ID buffer from XRPL address
   * Useful for advanced operations
   *
   * @param address - XRPL address
   * @returns Account ID as Buffer
   */
  static getAccountID(address: string): Buffer {
    if (!this.isValidXRPLAddress(address)) {
      throw new Error(`Invalid XRPL address: ${address}`);
    }

    // This would use decodeAccountID from ripple-address-codec
    // but we'll implement it when needed
    throw new Error('Not yet implemented');
  }
}
