const assert = require('node:assert/strict');

async function main() {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.customElements;

  const api = require('@xrpl-commons/xrpl-connect-privy');
  assert.equal(typeof api.PrivyAdapter, 'function');

  const adapter = new api.PrivyAdapter({
    appId: 'publish-smoke-test',
    redirectUri: 'https://example.test/wallet/privy',
    loginMethods: [{ id: 'google', oauthProvider: 'google' }],
  });
  assert.equal(await adapter.isAvailable(), false);
  assert.throws(() => require.resolve('react'), /Cannot find module/);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
