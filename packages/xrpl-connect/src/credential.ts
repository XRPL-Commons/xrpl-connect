// Default-import + destructure: xrpl is CommonJS — see address.ts for why.
import XrplPkg from 'xrpl';

const { Wallet, decodeSeed, ECDSA } = XrplPkg;

/**
 * Whatever `Address.generate()` / `Address.importBySeed()` / `Address.importByMnemonic()`
 * (→ `{ seed }`) or `Address.importByHex()` (→ `{ publicKey, privateKey }`, no seed) returned.
 */
export type SigningCredential = { seed: string } | { publicKey: string; privateKey: string };

export function walletFromCredential(credential: SigningCredential): InstanceType<typeof Wallet> {
  if ('seed' in credential) {
    // The seed's own encoded version byte says which curve it belongs to — see
    // Address.importBySeed() for why this can't just be left to the default.
    const { type } = decodeSeed(credential.seed);
    const algorithm = type === 'secp256k1' ? ECDSA.secp256k1 : ECDSA.ed25519;
    return Wallet.fromSeed(credential.seed, { algorithm });
  }
  return new Wallet(credential.publicKey, credential.privateKey);
}
