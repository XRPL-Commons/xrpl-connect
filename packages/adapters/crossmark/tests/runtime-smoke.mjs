import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

delete globalThis.window;
delete globalThis.document;

const esm = await import('../dist/index.mjs');
const cjs = createRequire(import.meta.url)('../dist/index.js');

for (const api of [esm, cjs]) {
  assert.equal(typeof api.CrossmarkAdapter, 'function');
  assert.equal(typeof api.CrossmarkSDK.default.methods.signInAndWait, 'function');
  assert.equal(typeof api.CrossmarkSDK.modules, 'object');
  assert.equal(typeof api.CrossmarkSDK.typings, 'object');
  assert.equal(typeof api.CrossmarkSDK.vanilla, 'function');
}
process.exit(0);
