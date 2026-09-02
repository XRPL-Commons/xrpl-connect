import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  pretendToBeVisual: true,
  url: 'https://example.com',
});
dom.window.matchMedia = () => ({
  matches: false,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
});

for (const key of [
  'CSSStyleSheet',
  'CustomEvent',
  'Document',
  'Element',
  'Event',
  'HTMLElement',
  'Node',
  'ShadowRoot',
  'customElements',
]) {
  globalThis[key] = dom.window[key];
}
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.window.navigator,
});

class StubWalletConnector extends HTMLElement {
  manager = null;

  setWalletManager(manager) {
    this.manager = manager;
  }

  async open() {}

  async openAndWait() {
    throw new Error('No account selected');
  }

  close() {}

  toggle() {}
}

customElements.define('xrpl-wallet-connector', StubWalletConnector);

const [{ act, createElement }, { createRoot }, reactApi] = await Promise.all([
  import('react'),
  import('react-dom/client'),
  import('@xrpl-commons/xrpl-connect-react'),
]);
const connectingWallets = [];
const connectedAccounts = [];
const reportedErrors = [];
const root = createRoot(document.querySelector('#root'));

await act(async () => {
  root.render(
    createElement(
      reactApi.XrplConnectProvider,
      { config: { adapters: [], autoConnect: false } },
      createElement(reactApi.WalletConnector, {
        primaryWallet: 'xaman',
        onConnecting: (walletId) => connectingWallets.push(walletId),
        onConnect: (account) => connectedAccounts.push(account),
        onError: (error) => reportedErrors.push(error),
      })
    )
  );
  await Promise.resolve();
});

const connector = document.querySelector('xrpl-wallet-connector');
assert(connector instanceof StubWalletConnector, 'React did not mount the connector element');
assert(connector.manager, 'React did not bind the provider manager to the connector element');

await act(async () => {
  connector.dispatchEvent(
    new CustomEvent('connecting', { detail: { walletId: 'xaman', connectionAttemptId: 1 } })
  );
});
assert.deepEqual(connectingWallets, ['xaman']);

await act(async () => {
  connector.dispatchEvent(
    new CustomEvent('error', {
      detail: {
        error: new Error('Connection rejected'),
        errorType: 'rejected',
        walletId: 'xaman',
        connectionAttemptId: 1,
      },
    })
  );
});
assert.equal(reportedErrors.length, 1);
assert.equal(reportedErrors[0].code, reactApi.WalletErrorCode.CONNECTION_REJECTED);

const account = {
  address: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
  network: { id: 'testnet', name: 'Testnet', wss: 'wss://s.altnet.rippletest.net:51233' },
};
await act(async () => {
  connector.manager.emit('connect', account);
});
assert.deepEqual(connectedAccounts, [account]);

await act(async () => root.unmount());
dom.window.close();
