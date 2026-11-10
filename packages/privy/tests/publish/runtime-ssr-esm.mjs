import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

delete globalThis.window;
delete globalThis.document;
delete globalThis.customElements;

const api = await import('@xrpl-commons/xrpl-connect-privy');
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
