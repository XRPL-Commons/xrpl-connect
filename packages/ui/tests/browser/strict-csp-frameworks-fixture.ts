import React from 'react';
import { createRoot } from 'react-dom/client';
import { WalletConnector as ReactWalletConnector } from '../../../react/src/WalletConnector';
import { XrplConnectProvider } from '../../../react/src/provider';
import { createApp, h } from 'vue';
import { createXrplConnect } from '../../../vue/src/context';
import { WalletConnector as VueWalletConnector } from '../../../vue/src/WalletConnector';
import { type NetworkInfo, type WalletAdapter } from '@xrpl-connect/core';
import '../../src/wallet-connector';

const STRICT_CSP_NONCE = 'strict-csp-test-nonce';
const network: NetworkInfo = {
  id: 'testnet',
  name: 'Testnet',
  wss: 'wss://example.test',
};
const wallet: WalletAdapter = {
  id: 'framework-wallet',
  name: 'Framework Wallet',
  url: 'https://example.test/framework-wallet',
  isAvailable: async () => true,
  connect: async () => ({ address: 'rFrameworkWallet', network }),
  disconnect: async () => {},
  getAccount: async () => null,
  getNetwork: async () => network,
  sign: async () => {
    throw new Error('Signing is not used by browser tests.');
  },
  signAndSubmit: async () => {
    throw new Error('Submission is not used by browser tests.');
  },
  signMessage: async () => {
    throw new Error('Message signing is not used by browser tests.');
  },
};

createRoot(document.querySelector('#react-root')!).render(
  React.createElement(XrplConnectProvider, {
    config: { adapters: [wallet], autoConnect: false },
    children: React.createElement(ReactWalletConnector, {
      id: 'react-connector',
      nonce: STRICT_CSP_NONCE,
      theme: 'light',
      cssVars: { '--xc-connect-button-background': '#112233' },
    }),
  })
);

const vueApp = createApp({
  render: () =>
    h(VueWalletConnector, {
      id: 'vue-connector',
      nonce: STRICT_CSP_NONCE,
      theme: 'light',
      cssVars: { '--xc-connect-button-background': '#112233' },
    }),
});
vueApp.use(createXrplConnect({ adapters: [wallet], autoConnect: false }));
vueApp.mount('#vue-root');

document.body.dataset.ready = 'true';
