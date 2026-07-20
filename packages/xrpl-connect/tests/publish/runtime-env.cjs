const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html>', { url: 'https://example.com' });
dom.window.matchMedia = () => ({
  matches: false,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
});

for (const key of ['HTMLElement', 'customElements', 'Document', 'CSSStyleSheet', 'ShadowRoot']) {
  globalThis[key] = dom.window[key];
}
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.window.navigator,
});
