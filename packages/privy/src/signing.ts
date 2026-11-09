import { secp256k1 } from '@noble/curves/secp256k1';
import {
  deriveAddress,
  encode,
  encodeForSigning,
  hashes,
  isValidClassicAddress,
  validate,
  verifyKeypairSignature,
} from 'xrpl';
import { createWalletError, type SignedTransaction, type Transaction } from 'xrpl-connect';
import type { PrivyWallet } from './session-types';

export function validateWallet(wallet: PrivyWallet): void {
  if (!wallet.id || !wallet.userId || !isValidClassicAddress(wallet.address)) {
    throw new Error('Privy did not return an embedded XRPL wallet');
  }
  if (!/^(02|03)[a-f0-9]{64}$/i.test(wallet.publicKey)) {
    throw new Error('Privy did not return a compressed XRPL public key');
  }
  secp256k1.ProjectivePoint.fromHex(wallet.publicKey).assertValidity();
  if (deriveAddress(wallet.publicKey) !== wallet.address) {
    throw new Error('Privy public key does not match the XRPL account');
  }
}

/** Snapshot the request before any asynchronous wallet or network operation. */
export function prepareSigningInput(transaction: Transaction, wallet: PrivyWallet): Transaction {
  if (transaction.TxnSignature !== undefined || transaction.Signers !== undefined) {
    throw new Error('Signing input must not contain signatures');
  }
  if (transaction.SigningPubKey === '') {
    throw createWalletError.unsupportedMethod('Privy does not support multisigning');
  }
  if (transaction.Account && transaction.Account !== wallet.address) {
    throw new Error('Transaction Account must match the connected Privy wallet');
  }
  if (
    transaction.SigningPubKey &&
    transaction.SigningPubKey.toUpperCase() !== wallet.publicKey.toUpperCase()
  ) {
    throw new Error('Transaction SigningPubKey must match the connected Privy wallet');
  }
  const tx: Transaction = JSON.parse(JSON.stringify(transaction));
  tx.Account = wallet.address;
  tx.SigningPubKey = wallet.publicKey.toUpperCase();
  validate(tx);
  return tx;
}

export async function signPreparedTransaction(
  transaction: Transaction,
  wallet: PrivyWallet,
  signHash: (hash: `0x${string}`) => Promise<string>
): Promise<SignedTransaction> {
  const signingBytes = encodeForSigning(transaction);
  const bytes = Uint8Array.from(signingBytes.match(/../g) ?? [], (value) => parseInt(value, 16));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-512', bytes)).slice(0, 32);
  const hash =
    `0x${Array.from(digest, (value) => value.toString(16).padStart(2, '0')).join('')}` as const;
  const compact = await signHash(hash);
  if (!/^0x[a-f0-9]{128}$/i.test(compact)) {
    throw new Error('Privy returned an invalid compact signature');
  }
  // XRPL requires canonical, DER-encoded secp256k1 signatures, not compact r || s.
  const signature = secp256k1.Signature.fromCompact(compact.slice(2))
    .normalizeS()
    .toDERHex()
    .toUpperCase();
  if (!verifyKeypairSignature(signingBytes, signature, wallet.publicKey)) {
    throw new Error('Privy signature does not match the connected XRPL account');
  }
  const tx_json = { ...transaction, TxnSignature: signature } as Transaction;
  const tx_blob = encode(tx_json);
  return {
    hash: hashes.hashSignedTx(tx_blob),
    tx_blob,
    tx_json,
    signature,
    signerAddress: wallet.address,
  };
}
