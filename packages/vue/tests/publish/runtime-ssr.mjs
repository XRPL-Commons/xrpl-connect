import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createSSRApp, h } from 'vue';
import { renderToString } from '@vue/server-renderer';

delete globalThis.window;
delete globalThis.document;
delete globalThis.customElements;

const require = createRequire(import.meta.url);
const esm = await import('@xrpl-commons/xrpl-connect-vue');
const cjs = require('@xrpl-commons/xrpl-connect-vue');

for (const api of [esm, cjs]) {
  assert.equal(typeof api.createXrplConnect, 'function');
  assert.equal(typeof api.WalletConnector, 'object');
  assert.equal(typeof api.useWallet, 'function');
  assert.equal(typeof api.useSigner, 'function');
  assert.equal(typeof api.useWalletModal, 'function');

  const app = createSSRApp({ render: () => h('main', null, 'XRPL Connect Vue SSR') });
  app.use(api.createXrplConnect({ adapters: [] }));
  assert.match(await renderToString(app), /XRPL Connect Vue SSR/);
}
