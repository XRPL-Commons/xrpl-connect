import { describe, expect, it } from 'vite-plus/test';
import { decode, ECDSA, encode, Wallet } from 'xrpl';
import { assertRequestedTransaction, assertSignedTransaction } from './transaction-verification';
import type { Transaction } from './types';

const ACCOUNT_WALLET = Wallet.generate(ECDSA.secp256k1);
const OTHER_WALLET = Wallet.generate(ECDSA.secp256k1);
const MULTISIGN_SOURCE = Wallet.generate();
const ACCOUNT = ACCOUNT_WALLET.address;

const REQUEST = {
  TransactionType: 'Payment',
  Account: ACCOUNT,
  Destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
  Amount: '1000000',
} as Transaction;
const AUTOFILLED = { ...REQUEST, Fee: '12', Sequence: 7, LastLedgerSequence: 100_000 };
const MULTISIGN_REQUEST = {
  ...AUTOFILLED,
  Account: MULTISIGN_SOURCE.address,
  SigningPubKey: '',
} as Transaction;

const EXPECTED = { walletName: 'Test Wallet', account: ACCOUNT, networkId: 0 };
const POLICY = { walletName: 'Test Wallet' };

function signed(wallet: Wallet, transaction: Transaction, multisign = false) {
  return serialized(decode(wallet.sign(transaction, multisign).tx_blob) as Transaction);
}

function serialized(transaction: Transaction) {
  const blob = encode(transaction);
  return { blob, transaction: decode(blob) as Transaction };
}

describe('assertSignedTransaction', () => {
  it('accepts a transaction single-signed for the connected account', () => {
    const { transaction, blob } = signed(ACCOUNT_WALLET, AUTOFILLED);

    expect(() => assertSignedTransaction(transaction, blob, EXPECTED)).not.toThrow();
  });

  it('accepts a valid signature from a key other than the master key', () => {
    // A RegularKey signature: whether the key is authorized is ledger state,
    // enforced by the network when the transaction is submitted.
    const { transaction, blob } = signed(OTHER_WALLET, AUTOFILLED);

    expect(transaction.SigningPubKey).toBe(OTHER_WALLET.publicKey);
    expect(() => assertSignedTransaction(transaction, blob, EXPECTED)).not.toThrow();
  });

  it('rejects a signature made by a key other than the declared SigningPubKey', () => {
    const forged = serialized({
      ...signed(OTHER_WALLET, AUTOFILLED).transaction,
      SigningPubKey: ACCOUNT_WALLET.publicKey,
    });

    expect(() => assertSignedTransaction(forged.transaction, forged.blob, EXPECTED)).toThrow(
      'Test Wallet returned an invalid transaction signature'
    );
  });

  it('rejects a corrupted signature', () => {
    const valid = signed(ACCOUNT_WALLET, AUTOFILLED).transaction;
    const signature = valid.TxnSignature as string;
    const corrupted = serialized({
      ...valid,
      TxnSignature: `${signature.slice(0, -1)}${signature.endsWith('0') ? '1' : '0'}`,
    });

    expect(() => assertSignedTransaction(corrupted.transaction, corrupted.blob, EXPECTED)).toThrow(
      'Test Wallet returned an invalid transaction signature'
    );
  });

  it('rejects a transaction signed for another account', () => {
    const { transaction, blob } = signed(OTHER_WALLET, {
      ...AUTOFILLED,
      Account: OTHER_WALLET.address,
    });

    expect(() => assertSignedTransaction(transaction, blob, EXPECTED)).toThrow(
      'Test Wallet signed with an account other than the connected account'
    );
  });

  it('rejects an unsigned transaction', () => {
    const { transaction, blob } = serialized(AUTOFILLED as Transaction);

    expect(() => assertSignedTransaction(transaction, blob, EXPECTED)).toThrow();
  });

  it('rejects multi-signatures when a single signature was requested', () => {
    const { transaction, blob } = signed(ACCOUNT_WALLET, AUTOFILLED, true);

    expect(() => assertSignedTransaction(transaction, blob, EXPECTED)).toThrow(
      'Test Wallet returned unexpected multi-signatures'
    );
  });

  it.each([
    ['a NetworkID of another network', 0, 1],
    ['a missing NetworkID above 1024', 21338, undefined],
    ['a NetworkID of another network above 1024', 21338, 21337],
  ])('rejects %s', (_description, networkId, NetworkID) => {
    const { transaction, blob } = signed(ACCOUNT_WALLET, { ...AUTOFILLED, NetworkID });

    expect(() => assertSignedTransaction(transaction, blob, { ...EXPECTED, networkId })).toThrow(
      'Test Wallet signed a transaction for a different network'
    );
  });

  it('accepts the NetworkID required above 1024', () => {
    const { transaction, blob } = signed(ACCOUNT_WALLET, { ...AUTOFILLED, NetworkID: 21338 });

    expect(() =>
      assertSignedTransaction(transaction, blob, { ...EXPECTED, networkId: 21338 })
    ).not.toThrow();
  });

  describe('when multisigning', () => {
    const MULTISIGN_EXPECTED = { ...EXPECTED, multisign: true };

    it('accepts a valid contribution from the connected account', () => {
      const { transaction, blob } = signed(ACCOUNT_WALLET, MULTISIGN_REQUEST, true);

      expect(() => assertSignedTransaction(transaction, blob, MULTISIGN_EXPECTED)).not.toThrow();
    });

    it('rejects contributions that omit the connected account', () => {
      const { transaction, blob } = signed(OTHER_WALLET, MULTISIGN_REQUEST, true);

      expect(() => assertSignedTransaction(transaction, blob, MULTISIGN_EXPECTED)).toThrow(
        'Test Wallet multi-signature did not include the connected account'
      );
    });

    it('rejects a corrupted multi-signature', () => {
      const valid = signed(ACCOUNT_WALLET, MULTISIGN_REQUEST, true).transaction;
      const [{ Signer }] = valid.Signers!;
      const corrupted = serialized({
        ...valid,
        Signers: [
          {
            Signer: {
              ...Signer,
              TxnSignature: `${Signer.TxnSignature.slice(0, -1)}${
                Signer.TxnSignature.endsWith('0') ? '1' : '0'
              }`,
            },
          },
        ],
      });

      expect(() =>
        assertSignedTransaction(corrupted.transaction, corrupted.blob, MULTISIGN_EXPECTED)
      ).toThrow('Test Wallet returned an invalid transaction multi-signature');
    });

    it('rejects a single signature', () => {
      const { transaction, blob } = signed(ACCOUNT_WALLET, AUTOFILLED);

      expect(() => assertSignedTransaction(transaction, blob, MULTISIGN_EXPECTED)).toThrow(
        'Test Wallet returned an invalid multi-signed transaction'
      );
    });
  });
});

describe('assertRequestedTransaction', () => {
  const SIGNED = signed(ACCOUNT_WALLET, AUTOFILLED).transaction;

  it('accepts fields the wallet added to the request', () => {
    expect(() => assertRequestedTransaction(REQUEST, SIGNED, POLICY)).not.toThrow();
  });

  it.each([
    ['Destination', { Destination: OTHER_WALLET.address }],
    ['Amount', { Amount: '1' }],
    ['Account', { Account: OTHER_WALLET.address }],
  ])('rejects a changed %s', (_field, change) => {
    expect(() => assertRequestedTransaction(REQUEST, { ...SIGNED, ...change }, POLICY)).toThrow(
      'Test Wallet returned a transaction that did not match the signing request'
    );
  });

  it('compares nested requested values', () => {
    const issued = { currency: 'USD', issuer: OTHER_WALLET.address, value: '10' };
    const requested = { ...REQUEST, Amount: issued } as Transaction;

    expect(() =>
      assertRequestedTransaction(requested, { ...SIGNED, Amount: issued }, POLICY)
    ).not.toThrow();
    expect(() =>
      assertRequestedTransaction(
        requested,
        { ...SIGNED, Amount: { ...issued, value: '1' } },
        POLICY
      )
    ).toThrow('Test Wallet returned a transaction that did not match the signing request');
  });

  it('rejects a missing transaction', () => {
    expect(() => assertRequestedTransaction(REQUEST, undefined, POLICY)).toThrow(
      'Test Wallet returned a transaction that did not match the signing request'
    );
  });

  it('ignores a requested signature, which the wallet produces', () => {
    const requested = { ...REQUEST, TxnSignature: 'STALE' } as Transaction;

    expect(() => assertRequestedTransaction(requested, SIGNED, POLICY)).not.toThrow();
  });

  it('requires an exact requested LastLedgerSequence by default', () => {
    const requested = { ...REQUEST, LastLedgerSequence: 100_000 } as Transaction;

    expect(() => assertRequestedTransaction(requested, SIGNED, POLICY)).not.toThrow();
    expect(() =>
      assertRequestedTransaction(requested, { ...SIGNED, LastLedgerSequence: 100_001 }, POLICY)
    ).toThrow('Test Wallet returned LastLedgerSequence outside the permitted signing expiry range');
  });

  it.each([
    [100_005, true],
    [100_006, false],
    [99_999, false],
    [undefined, false],
  ])('bounds an extended LastLedgerSequence of %s (accepted: %s)', (actual, accepted) => {
    const requested = { ...REQUEST, LastLedgerSequence: 100_000 } as Transaction;
    const check = () =>
      assertRequestedTransaction(
        requested,
        { ...SIGNED, LastLedgerSequence: actual },
        { ...POLICY, maxLastLedgerSequenceExtension: 5 }
      );

    if (accepted) expect(check).not.toThrow();
    else expect(check).toThrow('outside the permitted signing expiry range');
  });

  it.each([
    ['multisigning', { SigningPubKey: '' }],
    ['Batch', { TransactionType: 'Batch' }],
  ])('requires an exact LastLedgerSequence when %s', (_description, fields) => {
    const requested = { ...REQUEST, ...fields, LastLedgerSequence: 100_000 } as Transaction;

    expect(() =>
      assertRequestedTransaction(
        requested,
        { ...SIGNED, ...fields, LastLedgerSequence: 100_001 },
        { ...POLICY, maxLastLedgerSequenceExtension: 5 }
      )
    ).toThrow('outside the permitted signing expiry range');
  });

  it('requires every requested signer, in any order', () => {
    const first = { Signer: { Account: ACCOUNT, SigningPubKey: 'A', TxnSignature: 'A1' } };
    const second = { Signer: { Account: ACCOUNT, SigningPubKey: 'B', TxnSignature: 'B1' } };
    const added = { Signer: { Account: ACCOUNT, SigningPubKey: 'C', TxnSignature: 'C1' } };
    const requested = { ...REQUEST, Signers: [first, second] } as Transaction;

    expect(() =>
      assertRequestedTransaction(requested, { ...SIGNED, Signers: [added, second, first] }, POLICY)
    ).not.toThrow();
    expect(() =>
      assertRequestedTransaction(requested, { ...SIGNED, Signers: [first, added] }, POLICY)
    ).toThrow('Test Wallet returned a transaction that did not match the signing request');
  });
});
