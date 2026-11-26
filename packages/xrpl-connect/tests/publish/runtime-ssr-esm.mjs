import assert from 'node:assert/strict';

delete globalThis.window;
delete globalThis.document;
delete globalThis.customElements;

const api = await import('xrpl-connect');

// Reading the fetch globals before import would initialize Node 20's lazy constructors.
assert.equal(typeof new Response().blob, 'function');
assert.ok(new Response().headers instanceof Headers);
assert.ok(new Request('data:,').headers instanceof Headers);

assert.equal(typeof api.XyraAdapter, 'function');
assert.equal(typeof api.CrossmarkSDK.default.methods.signInAndWait, 'function');
for (const exportName of ['default', 'modules', 'typings', 'vanilla']) {
  assert(exportName in api.CrossmarkSDK, `CrossmarkSDK is missing ${exportName}`);
}
