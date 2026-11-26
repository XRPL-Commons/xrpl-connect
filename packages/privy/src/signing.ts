import { secp256k1 } from '@noble/curves/secp256k1';
import {
  deriveAddress,
  encode,
  encodeForMultiSigning,
  encodeForSigning,
  hashes,
  isValidClassicAddress,
  validate,
  verifyKeypairSignature,
  xrpToDrops,
} from 'xrpl';
import { createWalletError, type SignedTransaction, type Transaction } from 'xrpl-connect/core';
import type { PrivyWallet } from './session-types';

export type SignHash = (hash: `0x${string}`) => Promise<string>;

/**
 * Highest fee the adapter signs: xrpl.js's default autofill cap, which the
 * adapter's ledger client also uses for the fees it computes.
 */
export const MAX_FEE_XRP = '2';
const MAX_FEE_DROPS = BigInt(xrpToDrops(MAX_FEE_XRP));
/** Types whose cost is the owner reserve; xrpl.js does not cap their fee either. */
const RESERVE_COST_TYPES: ReadonlySet<string> = new Set([
  'AccountDelete',
  'AMMCreate',
  'VaultCreate',
]);

/** Apply the autofill fee cap to every fee, including one the application supplied. */
export function assertFeeWithinLimit(transaction: Transaction): void {
  const fee = transaction.Fee;
  if (typeof fee !== 'string' || !/^[0-9]+$/.test(fee)) {
    throw new Error('Transaction Fee must be a whole number of drops');
  }
  if (!RESERVE_COST_TYPES.has(transaction.TransactionType) && BigInt(fee) > MAX_FEE_DROPS) {
    throw new Error(`Transaction Fee of ${fee} drops exceeds the ${MAX_FEE_XRP} XRP limit`);
  }
}

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

/**
 * Snapshot a prepared transaction for an ordinary XRPL multisign contribution.
 *
 * Unlike a single-signature request, a multisigned transaction must be
 * prepared once for every signer. In particular, the adapter must not
 * autofill `Fee`, `Sequence`, or `LastLedgerSequence` independently for each
 * contribution.
 */
export function prepareMultisigningInput(
  transaction: Transaction,
  _wallet: PrivyWallet
): Transaction {
  if (transaction.TxnSignature !== undefined || transaction.Signers !== undefined) {
    throw new Error('Multisigning input must not contain signatures');
  }
  if (transaction.TransactionType === 'Batch') {
    throw new Error('Use the BatchSigner path for Batch transactions');
  }
  if (typeof transaction.Account !== 'string' || !isValidClassicAddress(transaction.Account)) {
    throw new Error('Multisigning requires a valid source Account');
  }
  if (transaction.SigningPubKey !== undefined && transaction.SigningPubKey !== '') {
    throw new Error('Multisigning requires SigningPubKey to be empty');
  }
  assertPreparedTransaction(transaction, 'Multisigning');

  const tx: Transaction = JSON.parse(JSON.stringify(transaction));
  tx.SigningPubKey = '';
  validate(tx);
  return tx;
}

function assertPreparedTransaction(transaction: Transaction, label: string): void {
  if (typeof transaction.Fee !== 'string' || !/^[0-9]+$/.test(transaction.Fee)) {
    throw new Error(`${label} requires a prepared transaction with Fee and Sequence`);
  }
  if (
    typeof transaction.Sequence !== 'number' ||
    !Number.isSafeInteger(transaction.Sequence) ||
    transaction.Sequence < 0
  ) {
    throw new Error(`${label} requires a prepared transaction with Fee and Sequence`);
  }
}

function decodeHex(value: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) {
    throw new Error('XRPL signing payload must be an even-length hexadecimal string');
  }
  return Uint8Array.from(value.match(/../g) ?? [], (part) => parseInt(part, 16));
}

/** Sign an XRPL binary-codec preimage with Privy's raw hash signer. */
export async function signEncodedPayload(
  signingBytes: string,
  wallet: PrivyWallet,
  signHash: SignHash
): Promise<string> {
  const bytes = decodeHex(signingBytes);
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-512', bytes as unknown as BufferSource)
  ).slice(0, 32);
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
  return signature;
}

function contributionResult(
  tx_json: Transaction,
  signature: string,
  wallet: PrivyWallet
): SignedTransaction {
  const tx_blob = encode(tx_json);
  return {
    // A contribution is not a final transaction and therefore has no hash to
    // track. The combined blob receives its hash after all signatures exist.
    hash: '',
    tx_blob,
    tx_json,
    signature,
    signerAddress: wallet.address,
  };
}

/** Sign a prepared ordinary XRPL multisign preimage and return one contribution. */
export async function signPreparedMultisignedTransaction(
  transaction: Transaction,
  wallet: PrivyWallet,
  signHash: SignHash
): Promise<SignedTransaction> {
  const signingBytes = encodeForMultiSigning(transaction, wallet.address);
  const signature = await signEncodedPayload(signingBytes, wallet, signHash);
  const tx_json = {
    ...transaction,
    SigningPubKey: '',
    Signers: [
      {
        Signer: {
          Account: wallet.address,
          SigningPubKey: wallet.publicKey.toUpperCase(),
          TxnSignature: signature,
        },
      },
    ],
  } as Transaction;
  return contributionResult(tx_json, signature, wallet);
}

export async function signPreparedTransaction(
  transaction: Transaction,
  wallet: PrivyWallet,
  signHash: SignHash
): Promise<SignedTransaction> {
  const signingBytes = encodeForSigning(transaction);
  const signature = await signEncodedPayload(signingBytes, wallet, signHash);
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
