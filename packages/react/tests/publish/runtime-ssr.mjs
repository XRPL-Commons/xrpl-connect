import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import * as reactEsm from '@xrpl-connect/react';

const require = createRequire(import.meta.url);
const reactCjs = require('@xrpl-connect/react');
const publicExports = [
  'XrplConnectProvider',
  'WalletConnector',
  'useWallet',
  'useSigner',
  'useWalletModal',
];

for (const api of [reactEsm, reactCjs]) {
  for (const exportName of publicExports) {
    assert.equal(typeof api[exportName], 'function', `React package is missing ${exportName}`);
  }

  const html = renderToString(
    createElement(
      api.XrplConnectProvider,
      { config: { adapters: [] } },
      createElement('main', null, 'XRPL Connect SSR')
    )
  );
  assert.match(html, /XRPL Connect SSR/);
}

const umbrella = await import('xrpl-connect');
const error = new umbrella.WalletError(
  umbrella.WalletErrorCode.SIGN_REJECTED,
  'Signing was rejected'
);

for (const api of [reactEsm, reactCjs]) {
  assert.equal(api.isWalletError(error), true, 'React did not recognize an umbrella WalletError');
  assert.equal(
    error instanceof api.WalletError,
    true,
    'WalletError failed cross-bundle instanceof'
  );

  const reactError = new api.WalletError(api.WalletErrorCode.SIGN_REJECTED, 'Signing was rejected');
  assert.equal(
    umbrella.isWalletError(reactError),
    true,
    'Umbrella package did not recognize a React WalletError'
  );
  assert.equal(
    reactError instanceof umbrella.WalletError,
    true,
    'React WalletError failed umbrella instanceof'
  );
}
