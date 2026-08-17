const assert = require('node:assert/strict');

delete globalThis.window;
delete globalThis.document;
delete globalThis.customElements;

const api = require('xrpl-connect');

assert.equal(typeof api.XyraAdapter, 'function');
assert.equal(typeof api.CrossmarkSDK.default.methods.signInAndWait, 'function');
for (const exportName of ['default', 'modules', 'typings', 'vanilla']) {
  assert(exportName in api.CrossmarkSDK, `CrossmarkSDK is missing ${exportName}`);
}
