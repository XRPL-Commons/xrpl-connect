/**
 * Verification of signed transactions returned by wallets
 *
 * A wallet response is untrusted input. These checks bind a signed transaction
 * to the connected account, the selected network, and the original signing
 * request, so an adapter never reports a wallet-chosen transaction as the one
 * the application asked to sign.
 */

import { encodeForMultiSigning, verifyKeypairSignature, verifySignature } from 'xrpl';
import type { Transaction } from './types';

const MAX_LEDGER_SEQUENCE = 0xffffffff;
// Fields a wallet produces while signing. A request cannot pre-specify them.
const SIGNING_OUTPUT_FIELDS = new Set(['TxnSignature']);

/**
 * What a signed transaction must be bound to
 */
export interface SignedTransactionExpectation {
  /** Wallet name used in error messages */
  walletName: string;
  /** Connected account: the transaction `Account`, or its entry in `Signers` when multisigning */
  account: string;
  /** XRPL network ID the transaction must be valid for */
  networkId: number;
  /** Whether the connected account contributes to `Signers` instead of signing alone */
  multisign?: boolean;
}

/**
 * How strictly a signed transaction must preserve the requested fields
 */
export interface RequestedTransactionPolicy {
  /** Wallet name used in error messages */
  walletName: string;
  /**
   * Maximum increase the wallet may apply to a requested `LastLedgerSequence`.
   * Defaults to 0 (exact match). Multisigning and Batch requests always match exactly.
   */
  maxLastLedgerSequenceExtension?: number;
}

/**
 * Throw unless a signed transaction is valid for the network, signed for the
 * connected account, and carries cryptographically valid signatures.
 *
 * A single signature is verified against the transaction's own `SigningPubKey`,
 * which may be the account's master key or its RegularKey. Whether that key is
 * authorized for the account is ledger state that the network enforces when
 * the transaction is submitted.
 *
 * @param transaction - The signed transaction, decoded from `blob`
 * @param blob - The serialized signed transaction
 * @param expected - The account and network the transaction must be bound to
 */
export function assertSignedTransaction(
  transaction: Transaction,
  blob: string,
  expected: SignedTransactionExpectation
): void {
  const { walletName, account, networkId, multisign = false } = expected;
  if (
    (networkId > 1024 && transaction.NetworkID !== networkId) ||
    (transaction.NetworkID !== undefined && transaction.NetworkID !== networkId)
  ) {
    throw new Error(`${walletName} signed a transaction for a different network`);
  }

  const signers = transaction.Signers;

  if (!multisign) {
    if (Array.isArray(signers) && signers.length > 0) {
      throw new Error(`${walletName} returned unexpected multi-signatures`);
    }
    if (transaction.Account !== account) {
      throw new Error(`${walletName} signed with an account other than the connected account`);
    }
    if (!verifySignature(blob)) {
      throw new Error(`${walletName} returned an invalid transaction signature`);
    }
    return;
  }

  if (
    transaction.SigningPubKey !== '' ||
    (typeof transaction.TxnSignature === 'string' && transaction.TxnSignature.length > 0) ||
    !Array.isArray(signers) ||
    signers.length === 0
  ) {
    throw new Error(`${walletName} returned an invalid multi-signed transaction`);
  }

  let expectedSignerFound = false;
  for (const signerEntry of signers) {
    const signer = signerEntry.Signer;
    if (
      typeof signer.Account !== 'string' ||
      typeof signer.SigningPubKey !== 'string' ||
      signer.SigningPubKey.length === 0 ||
      typeof signer.TxnSignature !== 'string' ||
      signer.TxnSignature.length === 0
    ) {
      throw new Error(`${walletName} returned malformed multi-signature data`);
    }
    if (
      !verifyKeypairSignature(
        encodeForMultiSigning(transaction, signer.Account),
        signer.TxnSignature,
        signer.SigningPubKey
      )
    ) {
      throw new Error(`${walletName} returned an invalid transaction multi-signature`);
    }
    if (signer.Account === account) expectedSignerFound = true;
  }
  if (!expectedSignerFound) {
    throw new Error(`${walletName} multi-signature did not include the connected account`);
  }
}

/**
 * Throw unless a signed transaction preserves every field of the signing
 * request. The wallet may add fields the request omitted (such as `Fee`,
 * `Sequence`, `LastLedgerSequence`, or `SigningPubKey`) but may not change a
 * requested value, except for the permitted `LastLedgerSequence` extension.
 * Requested `Signers` must all be preserved, in any order.
 *
 * @param requested - Snapshot of the transaction sent to the wallet
 * @param actual - The signed transaction (or wallet-reported request) to compare
 * @param policy - How strictly to compare `LastLedgerSequence`
 */
export function assertRequestedTransaction(
  requested: Transaction,
  actual: Record<string, unknown> | undefined,
  policy: RequestedTransactionPolicy
): void {
  const { walletName, maxLastLedgerSequenceExtension = 0 } = policy;
  if (!actual) {
    throw new Error(`${walletName} returned a transaction that did not match the signing request`);
  }
  let expected = requested;
  const requestedExpiry = requested.LastLedgerSequence;
  if (requestedExpiry !== undefined) {
    const actualExpiry = actual.LastLedgerSequence;
    const maxExtension =
      requested.SigningPubKey === '' || requested.TransactionType === 'Batch'
        ? 0
        : maxLastLedgerSequenceExtension;
    if (
      typeof actualExpiry !== 'number' ||
      !Number.isSafeInteger(actualExpiry) ||
      actualExpiry > MAX_LEDGER_SEQUENCE ||
      actualExpiry < requestedExpiry ||
      actualExpiry - requestedExpiry > maxExtension
    ) {
      throw new Error(
        `${walletName} returned LastLedgerSequence outside the permitted signing expiry range`
      );
    }
    expected = { ...requested, LastLedgerSequence: actualExpiry };
  }
  if (!containsRequestedValue(expected, actual)) {
    throw new Error(`${walletName} returned a transaction that did not match the signing request`);
  }
}

function containsRequestedValue(expected: unknown, actual: unknown, field?: string): boolean {
  if (field && SIGNING_OUTPUT_FIELDS.has(field)) return true;
  if (field === 'Signers') return containsRequestedSigners(expected, actual);
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((value, index) => containsRequestedValue(value, actual[index]))
    );
  }
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
    const actualRecord = actual as Record<string, unknown>;
    return Object.entries(expected).every(([key, value]) =>
      containsRequestedValue(value, actualRecord[key], key)
    );
  }
  return Object.is(expected, actual);
}

function containsRequestedSigners(expected: unknown, actual: unknown): boolean {
  if (!Array.isArray(expected) || !Array.isArray(actual)) return false;
  const matchedIndexes = new Set<number>();
  return expected.every((expectedSigner) => {
    const matchingIndex = actual.findIndex(
      (actualSigner, index) =>
        !matchedIndexes.has(index) && containsRequestedValue(expectedSigner, actualSigner)
    );
    if (matchingIndex === -1) return false;
    matchedIndexes.add(matchingIndex);
    return true;
  });
}
