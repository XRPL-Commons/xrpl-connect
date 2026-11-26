import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as xrplModule from 'xrpl';

const { decode, ECDSA, encodeForSigningBatch, hashes, verifyKeypairSignature, Wallet } =
  xrplModule.default ?? xrplModule;

delete globalThis.window;
delete globalThis.document;
delete globalThis.customElements;

const api = await import('@xrpl-commons/xrpl-connect-privy');
const { MockPrivyAdapter } = await import('@xrpl-commons/xrpl-connect-privy/testing');
const signer = Wallet.generate(ECDSA.secp256k1);
const owner = Wallet.generate();
const mock = new MockPrivyAdapter({
  privateKey: Buffer.from(signer.privateKey.slice(-64), 'hex'),
  transactionReview: 'none',
});
assert.equal((await mock.connect()).address, signer.address);
const prepared = {
  TransactionType: 'AccountSet',
  Account: owner.address,
  Fee: '30',
  Sequence: 5,
  SigningPubKey: '',
};
const contribution = await mock.sign(prepared);
assert.equal(contribution.tx_blob, signer.sign(prepared, true).tx_blob);

const batch = {
  TransactionType: 'Batch',
  Account: owner.address,
  Fee: '60',
  Sequence: 10,
  Flags: 0x00010000,
  RawTransactions: [owner, signer].map((wallet, index) => ({
    RawTransaction: {
      TransactionType: 'AccountSet',
      Account: wallet.address,
      SetFlag: 8,
      Sequence: 16 + index,
      Fee: '0',
      Flags: 0x40000000,
      SigningPubKey: '',
    },
  })),
};
const signedBatch = decode((await mock.signBatch(batch)).tx_blob);
const entry = signedBatch.BatchSigners[0].BatchSigner;
assert.equal(entry.Account, signer.address);
const preimage = encodeForSigningBatch({
  account: owner.address,
  sequence: batch.Sequence,
  flags: batch.Flags,
  txIDs: batch.RawTransactions.map(({ RawTransaction }) => hashes.hashSignedTx(RawTransaction)),
  batchAccount: signer.address,
});
assert.ok(verifyKeypairSignature(preimage, entry.TxnSignature, signer.publicKey));
await mock.disconnect();
assert.equal(typeof api.PrivyAdapter, 'function');

const adapter = new api.PrivyAdapter({
  appId: 'publish-smoke-test',
  redirectUri: 'https://example.test/wallet/privy',
});
assert.equal(await adapter.isAvailable(), false);
assert.deepEqual(adapter.getMissingConfiguration(), []);
assert.equal(typeof adapter.getLoginMethods, 'function');
assert.equal(typeof adapter.onAuthPrompt, 'function');

const require = createRequire(import.meta.url);
assert.throws(() => require.resolve('react'), /Cannot find module/);
