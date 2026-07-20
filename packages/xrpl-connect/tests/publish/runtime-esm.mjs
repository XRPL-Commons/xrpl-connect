import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

createRequire(import.meta.url)('./runtime-env.cjs');
const api = await import('xrpl-connect');

assert.equal(typeof api.XamanAdapter, 'function');
assert.equal(typeof api.XamanSDK.Xumm, 'function');
assert.equal(typeof api.XamanOAuth2.XummPkce, 'function');
assert.equal(typeof api.CrossmarkSDK.default.methods.signInAndWait, 'function');
assert.equal(typeof api.GemWalletAPI.getAddress, 'function');
assert.equal(typeof api.XRPLMethod, 'object');
assert.equal(typeof api.LEDGER_STATE_MESSAGES, 'object');

for (const exportName of ['XummPkce', 'XummPkceThread']) {
  assert(exportName in api.XamanOAuth2, `XamanOAuth2 is missing ${exportName}`);
}
for (const exportName of ['default', 'modules', 'typings', 'vanilla']) {
  assert(exportName in api.CrossmarkSDK, `CrossmarkSDK is missing ${exportName}`);
}
for (const exportName of [
  'acceptNFTOffer',
  'burnNFT',
  'cancelNFTOffer',
  'cancelOffer',
  'createNFTOffer',
  'createOffer',
  'getAddress',
  'getNFT',
  'getNetwork',
  'getPublicKey',
  'isInstalled',
  'mintNFT',
  'on',
  'sendPayment',
  'setAccount',
  'setHook',
  'setRegularKey',
  'setTrustline',
  'signMessage',
  'signTransaction',
  'submitBulkTransactions',
  'submitTransaction',
]) {
  assert(exportName in api.GemWalletAPI, `GemWalletAPI is missing ${exportName}`);
}

process.exit(0);
