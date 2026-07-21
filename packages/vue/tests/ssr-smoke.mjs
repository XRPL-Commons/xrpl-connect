import assert from 'node:assert/strict';

delete globalThis.window;
delete globalThis.document;
delete globalThis.customElements;

const esm = await import('../dist/index.mjs');
assert.equal(typeof esm.createXrplConnect, 'function');
assert.equal(typeof esm.WalletConnector, 'object');

const cjs = await import('../dist/index.js');
assert.equal(typeof cjs.createXrplConnect, 'function');
assert.equal(typeof cjs.WalletConnector, 'object');
