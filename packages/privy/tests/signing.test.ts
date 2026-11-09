// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { webcrypto } from 'node:crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import { Wallet, decode, deriveAddress, verifyKeypairSignature, encodeForSigning } from 'xrpl';
import type { Transaction } from 'xrpl-connect';
import { prepareSigningInput, signPreparedTransaction, validateWallet } from '../src/signing';

const privateKey = '1'.padStart(64, '0');
const publicKey = Array.from(secp256k1.getPublicKey(privateKey), (v) =>
  v.toString(16).padStart(2, '0')
)
  .join('')
  .toUpperCase();
const wallet = {
  id: 'wallet-1',
  userId: 'did:privy:one',
  publicKey,
  address: deriveAddress(publicKey),
};
const transaction: Transaction = {
  TransactionType: 'AccountSet',
  Account: wallet.address,
  Fee: '12',
  Sequence: 1,
  LastLedgerSequence: 100,
  Domain: '6578616D706C652E636F6D',
};

afterEach(() => vi.unstubAllGlobals());

async function sign(hash: `0x${string}`): Promise<string> {
  return `0x${secp256k1.sign(hash.slice(2), privateKey).toCompactHex()}`;
}

describe('Privy XRPL serialization', () => {
  it('matches xrpl.js signing and produces a verified, submit-ready blob', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const input = prepareSigningInput(transaction, wallet);
    const signed = await signPreparedTransaction(input, wallet, sign);
    const expected = new Wallet(publicKey, `00${privateKey}`).sign(transaction);
    expect(signed.tx_blob).toBe(expected.tx_blob);
    expect(signed.hash).toBe(expected.hash);
    expect(signed.signerAddress).toBe(wallet.address);
    expect(decode(signed.tx_blob!)).toEqual(signed.tx_json);
    expect(verifyKeypairSignature(encodeForSigning(input), signed.signature!, publicKey)).toBe(
      true
    );
  });

  it('canonicalizes high-S compact signatures', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const signed = await signPreparedTransaction(
      prepareSigningInput(transaction, wallet),
      wallet,
      async (hash) => {
        const signature = secp256k1.sign(hash.slice(2), privateKey);
        return `0x${new secp256k1.Signature(signature.r, secp256k1.CURVE.n - signature.s).toCompactHex()}`;
      }
    );
    expect(signed.tx_blob).toBe(new Wallet(publicKey, `00${privateKey}`).sign(transaction).tx_blob);
  });

  it('rejects a signature from a different wallet and malformed SDK signatures', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const input = prepareSigningInput(transaction, wallet);
    await expect(
      signPreparedTransaction(
        input,
        wallet,
        async (hash) => `0x${secp256k1.sign(hash.slice(2), '2'.padStart(64, '0')).toCompactHex()}`
      )
    ).rejects.toThrow('does not match');
    await expect(signPreparedTransaction(input, wallet, async () => '0x1234')).rejects.toThrow(
      'invalid compact signature'
    );
  });

  it('validates native XRPL identity and the public key/account pair', () => {
    expect(() => validateWallet(wallet)).not.toThrow();
    expect(() => validateWallet({ ...wallet, address: '0xEthereumAddress' })).toThrow();
    expect(() => validateWallet({ ...wallet, publicKey: `04${publicKey.slice(2)}` })).toThrow();
    expect(() => validateWallet({ ...wallet, address: Wallet.generate().classicAddress })).toThrow(
      'does not match'
    );
  });

  it('rejects pre-signed transactions, other accounts, and unsupported multisigning', () => {
    expect(() => prepareSigningInput({ ...transaction, TxnSignature: '01' }, wallet)).toThrow(
      'signatures'
    );
    expect(() => prepareSigningInput({ ...transaction, Signers: [] }, wallet)).toThrow(
      'signatures'
    );
    expect(() => prepareSigningInput({ ...transaction, SigningPubKey: '' }, wallet)).toThrow(
      'multisigning'
    );
    expect(() =>
      prepareSigningInput({ ...transaction, Account: Wallet.generate().address }, wallet)
    ).toThrow('Account');
    expect(() => prepareSigningInput({ ...transaction, SigningPubKey: '02' }, wallet)).toThrow(
      'SigningPubKey'
    );
  });

  it('snapshots nested transaction fields without mutating the caller', () => {
    const original = { ...transaction, Memos: [{ Memo: { MemoData: '01' } }] };
    const input = prepareSigningInput(original, wallet);
    original.Memos[0].Memo.MemoData = '02';
    expect(input.Memos?.[0].Memo.MemoData).toBe('01');
    expect(original).not.toHaveProperty('SigningPubKey');
  });
});
