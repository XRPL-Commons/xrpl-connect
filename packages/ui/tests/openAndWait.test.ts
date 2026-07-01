import { describe, it, expect, afterEach } from 'vitest';
import '../src/wallet-connector'; // registers <xrpl-wallet-connector>
import { WalletManager } from '@xrpl-connect/core';
import type { AccountInfo, NetworkInfo, WalletAdapter } from '@xrpl-connect/core';

const NETWORK: NetworkInfo = { id: 'testnet', name: 'Testnet', wss: 'wss://example' };
const ACCOUNT: AccountInfo = { address: 'rTestAddress00000000000000000000000', network: NETWORK };

function fakeAdapter(): WalletAdapter {
  return {
    id: 'fake',
    name: 'Fake Wallet',
    isAvailable: async () => true,
    connect: async () => ACCOUNT,
    disconnect: async () => {},
    getAccount: async () => ACCOUNT,
    getNetwork: async () => NETWORK,
    sign: async () => ({ hash: '' }),
    signAndSubmit: async () => ({ hash: '' }),
    signMessage: async () => ({ message: '', signature: '', publicKey: '' }),
  };
}

interface ConnectorEl extends HTMLElement {
  setWalletManager(m: WalletManager): void;
  openAndWait(): Promise<AccountInfo>;
  close(): void;
}

function mountConnector(manager: WalletManager): ConnectorEl {
  const el = document.createElement('xrpl-wallet-connector') as ConnectorEl;
  document.body.appendChild(el);
  el.setWalletManager(manager);
  return el;
}

describe('<xrpl-wallet-connector>.openAndWait()', () => {
  afterEach(() => {
    // Remove mounted connectors so disconnectedCallback tears down observers /
    // portals and nothing keeps the test runner alive.
    document
      .querySelectorAll(
        'xrpl-wallet-connector, [data-xrpl-overlay-portal], [data-xrpl-account-modal-portal]'
      )
      .forEach((el) => el.remove());
  });

  it('resolves with the account once a wallet connects', async () => {
    const manager = new WalletManager({ adapters: [fakeAdapter()] });
    const el = mountConnector(manager);

    const promise = el.openAndWait();
    await manager.connect('fake');

    await expect(promise).resolves.toEqual(ACCOUNT);
  });

  it('rejects when the modal is closed before connecting', async () => {
    const manager = new WalletManager({ adapters: [fakeAdapter()] });
    const el = mountConnector(manager);

    const promise = el.openAndWait();
    el.close();

    await expect(promise).rejects.toThrow(/closed/i);
  });
});
