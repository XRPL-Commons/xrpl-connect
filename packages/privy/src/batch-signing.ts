import * as xrpl from 'xrpl';
import {
  encode,
  hashes,
  isValidClassicAddress,
  validate,
} from 'xrpl';
import type { SignedTransaction, Transaction } from 'xrpl-connect/core';
import type { PrivyWallet } from './session-types';
import { signEncodedPayload, type SignHash } from './signing';

/** Options for one XLS-56 BatchSigner contribution. */
export interface PrivyBatchSigningOptions {
  /** Account whose inner transaction is being authorized. */
  batchAccount?: string;
  /**
   * Set to `true` to add the connected account as a nested multisign entry.
   * Pass a classic address when the connected Privy key is a regular key for
   * another account. Omit it for a regular-key BatchSigner entry.
   */
  multisign?: boolean | string;
}

/** Prepared Batch contribution data kept separate from the review result. */
export interface PreparedBatchSigner {
  readonly transaction: Transaction;
  readonly batchAccount: string;
  readonly signerAccount?: string;
  readonly signingBytes: string;
}

const BATCH_SIGNING_PREFIX = '42434800';
const UINT32_MAX = 0xffffffff;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireUInt32(value: unknown, label: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > UINT32_MAX
  ) {
    throw new Error(`${label} must be a 32-bit unsigned integer`);
  }
  return value;
}

function requireAddress(value: unknown, label: string): string {
  if (typeof value !== 'string' || !isValidClassicAddress(value)) {
    throw new Error(`${label} must be a valid classic XRPL address`);
  }
  return value;
}

function requireFee(value: unknown): void {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) {
    throw new Error('BatchSigner requires a prepared transaction with Fee and Sequence');
  }
}

function encodeLegacyBatchSigningPayload(flags: number, txIDs: readonly string[]): string {
  const ids = txIDs.map((txID, index) => {
    if (!/^[0-9a-f]{64}$/i.test(txID)) {
      throw new Error(`Batch RawTransactions[${index}] produced an invalid transaction hash`);
    }
    return txID.toUpperCase();
  });
  return [
    BATCH_SIGNING_PREFIX,
    flags.toString(16).padStart(8, '0'),
    ids.length.toString(16).padStart(8, '0'),
    ...ids,
  ].join('');
}

function encodeBatchSigningPayload(
  transaction: Transaction,
  batchAccount: string,
  signerAccount: string | undefined,
  flags: number,
  sequence: number,
  txIDs: readonly string[]
): string {
  // `encodeForSigningBatch` was added to xrpl's public utility exports after
  // the initial XLS-56 release. Keep the old, public XRPL v4 codec payload as
  // a capability fallback rather than importing ripple-binary-codec directly.
  const encodeForSigningBatch = (
    xrpl as unknown as {
      encodeForSigningBatch?: (fields: Record<string, unknown>) => string;
    }
  ).encodeForSigningBatch;
  if (typeof encodeForSigningBatch !== 'function') {
    return encodeLegacyBatchSigningPayload(flags, txIDs);
  }
  return encodeForSigningBatch({
    account: transaction.Account,
    sequence,
    flags,
    txIDs,
    batchAccount,
    ...(signerAccount === undefined ? {} : { signerAccount }),
  });
}

/** Validate and snapshot a prepared XLS-56 Batch before any asynchronous work. */
export function prepareBatchSignerInput(
  transaction: Transaction,
  wallet: PrivyWallet,
  options: PrivyBatchSigningOptions = {}
): PreparedBatchSigner {
  const optionRecord = asRecord(options, 'BatchSigner options');
  const input = asRecord(transaction, 'Batch signing input');
  if (input.TransactionType !== 'Batch') {
    throw new Error('BatchSigner requires a Batch transaction');
  }
  if (input.TxnSignature !== undefined || input.Signers !== undefined) {
    throw new Error('BatchSigner input must not contain signatures');
  }
  if (input.SigningPubKey !== undefined) {
    throw new Error('BatchSigner input must not contain SigningPubKey');
  }
  if (input.BatchSigners !== undefined) {
    throw new Error('BatchSigner input must not contain existing BatchSigners');
  }
  requireAddress(input.Account, 'Batch Account');
  requireFee(input.Fee);

  const sequence =
    input.Sequence === undefined
      ? input.TicketSequence
      : input.TicketSequence === undefined
        ? input.Sequence
        : (() => {
            throw new Error('Batch transaction must contain only Sequence or TicketSequence');
          })();
  const sequenceNumber = requireUInt32(sequence, 'Batch Sequence');
  const flags = input.Flags === undefined ? 0 : requireUInt32(input.Flags, 'Batch Flags');

  const rawTransactions = input.RawTransactions;
  if (!Array.isArray(rawTransactions) || rawTransactions.length === 0) {
    throw new Error('Batch transaction requires at least one RawTransaction');
  }
  for (const [index, raw] of rawTransactions.entries()) {
    const rawRecord = asRecord(raw, `Batch RawTransactions[${index}]`);
    const inner = asRecord(rawRecord.RawTransaction, `Batch RawTransactions[${index}].RawTransaction`);
    if (inner.TxnSignature !== undefined || inner.Signers !== undefined) {
      throw new Error(`Batch RawTransactions[${index}] must not contain signatures`);
    }
  }

  const batchAccount = requireAddress(
    optionRecord.batchAccount === undefined ? wallet.address : optionRecord.batchAccount,
    'BatchSigner Account'
  );
  const involvedAccounts = new Set(
    rawTransactions.map((raw, index) => {
      const inner = asRecord(
        asRecord(raw, `Batch RawTransactions[${index}]`).RawTransaction,
        `Batch RawTransactions[${index}].RawTransaction`
      );
      return requireAddress(inner.Account, `Batch RawTransactions[${index}].RawTransaction.Account`);
    })
  );
  if (!involvedAccounts.has(batchAccount)) {
    throw new Error('BatchSigner Account must be an account in RawTransactions');
  }

  const signerOption = optionRecord.multisign;
  if (
    signerOption !== undefined &&
    signerOption !== true &&
    signerOption !== false &&
    typeof signerOption !== 'string'
  ) {
    throw new Error('Batch multisign must be a boolean or a classic XRPL address');
  }
  if (typeof signerOption === 'string' && signerOption.length === 0) {
    throw new Error('Batch multisign Account must not be empty');
  }
  const signerAccount =
    signerOption === true
      ? wallet.address
      : typeof signerOption === 'string'
        ? requireAddress(signerOption, 'Batch multisign Account')
        : undefined;

  const snapshot = JSON.parse(JSON.stringify(transaction)) as Transaction;
  // xrpl.js validates the complete Batch shape, including each inner
  // transaction's `tfInnerBatchTxn` and zero fee requirements.
  validate(snapshot);
  const snapshotRecord = asRecord(snapshot, 'Batch signing input');
  const snapshotRawTransactions = snapshotRecord.RawTransactions as unknown[];
  const txIDs = snapshotRawTransactions.map((raw, index) => {
    const inner = asRecord(
      asRecord(raw, `Batch RawTransactions[${index}]`).RawTransaction,
      `Batch RawTransactions[${index}].RawTransaction`
    );
    return hashes.hashSignedTx(inner as never);
  });
  const signingBytes = encodeBatchSigningPayload(
    snapshot,
    batchAccount,
    signerAccount,
    flags,
    sequenceNumber,
    txIDs
  );
  return { transaction: snapshot, batchAccount, signerAccount, signingBytes };
}

/** Sign a validated Batch preimage and return one independent BatchSigner contribution. */
export async function signPreparedBatchSignerTransaction(
  prepared: PreparedBatchSigner,
  wallet: PrivyWallet,
  signHash: SignHash
): Promise<SignedTransaction> {
  const signature = await signEncodedPayload(prepared.signingBytes, wallet, signHash);
  const batchSigner = prepared.signerAccount
    ? {
        Account: prepared.batchAccount,
        Signers: [
          {
            Signer: {
              Account: prepared.signerAccount,
              SigningPubKey: wallet.publicKey.toUpperCase(),
              TxnSignature: signature,
            },
          },
        ],
      }
    : {
        Account: prepared.batchAccount,
        SigningPubKey: wallet.publicKey.toUpperCase(),
        TxnSignature: signature,
      };
  const tx_json = {
    ...prepared.transaction,
    BatchSigners: [{ BatchSigner: batchSigner }],
  } as Transaction;
  return {
    hash: '',
    tx_blob: encode(tx_json),
    tx_json,
    signature,
    signerAddress: wallet.address,
  };
}

