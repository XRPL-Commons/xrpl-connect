// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { webcrypto } from 'node:crypto';
import { secp256k1 } from '@noble/curves/secp256k1';
import {
  decode,
  deriveAddress,
  encodeForSigningBatch,
  hashes,
  verifyKeypairSignature,
} from 'xrpl';
import type { Transaction } from 'xrpl-connect';
import {
  prepareBatchSignerInput,
  signPreparedBatchSignerTransaction,
} from '../src/batch-signing';

const privateKey = '1'.padStart(64, '0');
const publicKey = Array.from(secp256k1.getPublicKey(privateKey), (value) =>
  value.toString(16).padStart(2, '0')
)
  .join('')
  .toUpperCase();
const wallet = {
  id: 'wallet-1',
  userId: 'did:privy:one',
  publicKey,
  address: deriveAddress(publicKey),
};

const innerTransaction = {
  TransactionType: 'AccountSet',
  Account: wallet.address,
  Fee: '0',
  Sequence: 1,
  Flags: 0x40000000,
  SigningPubKey: '',
};
const batch: Transaction = {
  TransactionType: 'Batch',
  Account: wallet.address,
  Fee: '12',
  Sequence: 7,
  Flags: 0,
  RawTransactions: [{ RawTransaction: innerTransaction }],
} as Transaction;

afterEach(() => vi.unstubAllGlobals());

async function sign(hash: `0x${string}`): Promise<string> {
  return `0x${secp256k1.sign(hash.slice(2), privateKey).toCompactHex()}`;
}

describe('Privy XLS-56 BatchSigner serialization', () => {
  it('matches the public xrpl.js Batch preimage and returns one regular contribution', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const prepared = prepareBatchSignerInput(batch, wallet);
    const signed = await signPreparedBatchSignerTransaction(prepared, wallet, sign);
    const decoded = decode(signed.tx_blob!);
    const expectedPreimage = encodeForSigningBatch({
      account: batch.Account,
      sequence: batch.Sequence,
      flags: batch.Flags,
      txIDs: [hashes.hashSignedTx(innerTransaction)],
      batchAccount: wallet.address,
    });

    expect(signed.hash).toBe('');
    expect(decoded.BatchSigners).toEqual([
      {
        BatchSigner: {
          Account: wallet.address,
          SigningPubKey: wallet.publicKey,
          TxnSignature: signed.signature,
        },
      },
    ]);
    expect(verifyKeypairSignature(expectedPreimage, signed.signature!, publicKey)).toBe(true);
  });

  it('creates nested multisign BatchSigner entries with the canonical signer account', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const otherPublicKey = Array.from(secp256k1.getPublicKey('2'.padStart(64, '0')), (value) =>
      value.toString(16).padStart(2, '0')
    )
      .join('')
      .toUpperCase();
    const otherBatchAccount = deriveAddress(otherPublicKey);
    const prepared = prepareBatchSignerInput(
      {
        ...batch,
        RawTransactions: [
          {
            RawTransaction: {
              ...innerTransaction,
              Account: otherBatchAccount,
            },
          },
        ],
      } as Transaction,
      wallet,
      { batchAccount: otherBatchAccount, multisign: true }
    );
    const signed = await signPreparedBatchSignerTransaction(prepared, wallet, sign);
    const decoded = decode(signed.tx_blob!);
    const expectedPreimage = encodeForSigningBatch({
      account: batch.Account,
      sequence: batch.Sequence,
      flags: batch.Flags,
      txIDs: [hashes.hashSignedTx((prepared.transaction as never as { RawTransactions: [{ RawTransaction: Transaction }] }).RawTransactions[0].RawTransaction)],
      batchAccount: otherBatchAccount,
      signerAccount: wallet.address,
    });

    expect(decoded.BatchSigners).toEqual([
      {
        BatchSigner: {
          Account: otherBatchAccount,
          Signers: [
            {
              Signer: {
                Account: wallet.address,
                SigningPubKey: wallet.publicKey,
                TxnSignature: signed.signature,
              },
            },
          ],
        },
      },
    ]);
    expect(verifyKeypairSignature(expectedPreimage, signed.signature!, publicKey)).toBe(true);
  });

  it('rejects malformed, unprepared, pre-signed, and ambiguous batches', () => {
    expect(() => prepareBatchSignerInput({ ...batch, Fee: undefined }, wallet)).toThrow(
      'prepared transaction'
    );
    expect(() => prepareBatchSignerInput({ ...batch, Sequence: undefined }, wallet)).toThrow(
      '32-bit unsigned integer'
    );
    expect(() => prepareBatchSignerInput({ ...batch, BatchSigners: [] }, wallet)).toThrow(
      'existing BatchSigners'
    );
    expect(() =>
      prepareBatchSignerInput(
        {
          ...batch,
          RawTransactions: [{ RawTransaction: { ...innerTransaction, TxnSignature: '01' } }],
        } as Transaction,
        wallet
      )
    ).toThrow('must not contain signatures');
    expect(() =>
      prepareBatchSignerInput(
        { ...batch, Sequence: 1, TicketSequence: 2 } as Transaction,
        wallet
      )
    ).toThrow('Sequence must be 0 when TicketSequence is provided');
    expect(() => prepareBatchSignerInput(batch, wallet, { batchAccount: null } as never)).toThrow(
      'BatchSigner Account'
    );
    expect(() => prepareBatchSignerInput(batch, wallet, { multisign: 1 } as never)).toThrow(
      'Batch multisign must be a boolean'
    );
  });

  it('preserves a valid zero Sequence with TicketSequence in the signing preimage', () => {
    const ticketBatch = {
      ...batch,
      Sequence: 0,
      TicketSequence: 19,
    } as Transaction;
    const prepared = prepareBatchSignerInput(ticketBatch, wallet);
    expect(prepared.transaction).toMatchObject({ Sequence: 0, TicketSequence: 19 });
  });
});

