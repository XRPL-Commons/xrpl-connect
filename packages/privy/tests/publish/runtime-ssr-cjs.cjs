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
  });
  assert.equal(await adapter.isAvailable(), false);
  assert.deepEqual(adapter.getMissingConfiguration(), []);
  assert.equal(typeof adapter.getLoginMethods, 'function');
  assert.equal(typeof adapter.onAuthPrompt, 'function');
  assert.throws(() => require.resolve('react'), /Cannot find module/);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
