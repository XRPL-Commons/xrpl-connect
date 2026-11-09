import { WalletManager, CrossmarkAdapter, GemWalletAdapter } from 'xrpl-connect';
import { PrivyAdapter } from '@xrpl-commons/xrpl-connect-privy';

const appId = import.meta.env.VITE_PRIVY_APP_ID;
const providers = (import.meta.env.VITE_PRIVY_PROVIDERS || 'google')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const privy = appId
  ? new PrivyAdapter({
      appId,
      clientId: import.meta.env.VITE_PRIVY_CLIENT_ID || undefined,
      redirectUri: `${window.location.origin}/wallet/privy`,
      loginMethods: providers.map((provider) => ({ id: provider, oauthProvider: provider })),
    })
  : undefined;

const manager = new WalletManager({
  adapters: [new CrossmarkAdapter(), new GemWalletAdapter(), ...(privy ? [privy] : [])],
  network: 'testnet',
  autoConnect: false,
});
const connector = document.querySelector('xrpl-wallet-connector');
connector.setWalletManager(manager);
connector.socialLogins = privy
  ? providers.map((provider) => ({
      id: provider,
      label: `Continue with ${provider[0].toUpperCase()}${provider.slice(1)}`,
      adapterId: 'privy',
      connectOptions: { loginMethod: provider },
    }))
  : [];

const result = document.querySelector('#result');
const configuration = document.querySelector('#configuration');
configuration.textContent = privy
  ? 'Social login creates an embedded XRPL wallet. Existing wallets connect through XRPL Connect.'
  : 'Set VITE_PRIVY_APP_ID to enable social login. Existing wallets are available below.';

let busy = false;
function render() {
  document.querySelector('#account').textContent = manager.account
    ? `${manager.wallet.name}: ${manager.account.address} · ${manager.account.network.name}`
    : 'No wallet connected.';
  for (const id of ['fund', 'sign', 'submit']) {
    document.querySelector(`#${id}`).disabled = !manager.connected || busy;
  }
  document.querySelector('#logout').disabled = !manager.connected;
}
manager.on('connect', render);
manager.on('disconnect', render);
manager.on('error', (error) => {
  result.textContent = error.message;
});

async function run(operation) {
  busy = true;
  result.textContent = 'Working…';
  render();
  try {
    result.textContent = JSON.stringify(await operation(), null, 2);
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    busy = false;
    render();
  }
}

document.querySelector('#fund').addEventListener('click', () =>
  run(async () => {
    const address = manager.account.address;
    const response = await fetch('https://faucet.altnet.rippletest.net/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: address }),
    });
    if (!response.ok) throw new Error(`Testnet faucet failed (${response.status})`);
    await response.json();
    return { funded: address, network: 'testnet' };
  })
);
document.querySelector('#sign').addEventListener('click', () =>
  run(() =>
    manager.sign({
      TransactionType: 'AccountSet',
      Account: manager.account.address,
    })
  )
);
document.querySelector('#submit').addEventListener('click', () =>
  run(() =>
    manager.signAndSubmit({
      TransactionType: 'AccountSet',
      Account: manager.account.address,
    })
  )
);
document.querySelector('#logout').addEventListener('click', () => run(() => manager.disconnect()));

// Install UI and listeners before completing an OAuth return or saved connection.
await manager.reconnect();
render();
