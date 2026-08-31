const assert = require('node:assert/strict');

require('./runtime-env.cjs');
const api = require('xrpl-connect');

assert.equal(typeof api.XamanAdapter, 'function');
assert.equal(typeof api.MetaMaskSnapAdapter, 'function');
assert.equal(typeof api.XamanSDK.Xumm, 'function');
assert.equal(typeof api.XamanOAuth2.XummPkce, 'function');
assert.equal(typeof api.CrossmarkSDK.default.methods.signInAndWait, 'function');
assert.equal(typeof api.GemWalletAPI.getAddress, 'function');
assert.equal(typeof api.XRPLMethod, 'object');
assert.equal(typeof api.LEDGER_STATE_MESSAGES, 'object');

assert.deepEqual(api.STANDARD_WALLET_IDS, [
  'xaman',
  'crossmark',
  'gemwallet',
  'walletconnect',
  'ledger',
  'xyra',
  'otsu',
  'metamask-snap',
]);
assert.equal(api.ADAPTER_DESCRIPTORS.length, Object.keys(api.Adapters).length);
assert.deepEqual(
  api.ADAPTER_DESCRIPTORS.map(({ id }) => id),
  api.STANDARD_WALLET_IDS
);
for (const descriptor of api.ADAPTER_DESCRIPTORS) {
  assert.equal(descriptor.Adapter, api.Adapters[descriptor.exportKey]);
  assert.equal(new descriptor.Adapter().id, descriptor.id);
}
assert.deepEqual(
  api
    .createAdapters({
      xaman: { apiKey: 'publish-smoke-test' },
      walletconnect: { projectId: 'publish-smoke-test' },
    })
    .map(({ id }) => id),
  api.STANDARD_WALLET_IDS
);

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
