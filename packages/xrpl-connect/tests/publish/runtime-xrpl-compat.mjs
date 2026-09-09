import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('./runtime-env.cjs');
const commonjs = process.argv[2] === 'cjs';
const api = commonjs ? require('xrpl-connect') : await import('xrpl-connect');
const xrpl = commonjs ? require('xrpl') : await import('xrpl');

// Public test-vector keys only; no wallet service or ledger is contacted.
const wallet = new xrpl.Wallet(
  '030E58CDD076E798C84755590AAF6237CA8FAE821070A59F648B517A30DC6F589D',
  '00141BA006D3363D2FB2785E8DF4E44D3A49908780CB4FB51F6D217C08C021429F'
);
const account = {
  address: wallet.classicAddress,
  publicKey: wallet.publicKey,
  network: {
    id: 'testnet',
    name: 'Testnet',
    wss: 'wss://testnet.xrpl-labs.com',
    walletConnectId: 'xrpl:1',
  },
};
const transaction = {
  TransactionType: 'Payment',
  Account: account.address,
  Destination: 'rQ3PTWGLCbPz8ZCicV5tCX3xuymojTng5r',
  Amount: '20000000',
  Sequence: 1,
  Fee: '12',
};
const manager = new api.WalletManager({
  network: 'testnet',
  autoConnect: false,
  storage: new api.MemoryStorageAdapter(),
  adapters: [
    {
      id: 'crossmark',
      name: 'Test vector signer',
      icon: '',
      isAvailable: async () => true,
      connect: async () => account,
      disconnect: async () => {},
      sign: async (tx) => wallet.sign(tx),
    },
  ],
});
try {
  await manager.connect('crossmark');
  const signed = await manager.sign(transaction);
  assert.equal(signed.signerAddress, account.address);
  assert.equal(xrpl.verifySignature(signed.tx_blob), true);
  assert.equal(xrpl.hashes.hashSignedTx(signed.tx_blob), signed.hash);
  const decoded = xrpl.decode(signed.tx_blob);
  assert.equal(decoded.Account, transaction.Account);
  assert.equal(decoded.Amount, transaction.Amount);
  assert.equal(xrpl.encode(decoded), signed.tx_blob);
} finally {
  await manager.disconnect();
}
console.log(`✓ Packed ${commonjs ? 'CommonJS' : 'ESM'} signing/codec compatibility`);
process.exit(0);
