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
  loginMethods: [{ id: 'google', oauthProvider: 'google' }],
});
assert.equal(await adapter.isAvailable(), false);

const require = createRequire(import.meta.url);
assert.throws(() => require.resolve('react'), /Cannot find module/);
