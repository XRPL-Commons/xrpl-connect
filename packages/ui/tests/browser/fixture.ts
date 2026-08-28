import { WalletManager, type NetworkInfo, type WalletAdapter } from '@xrpl-connect/core';
import '../../src/wallet-connector';

const network: NetworkInfo = {
  id: 'testnet',
  name: 'Testnet',
  wss: 'wss://example.test',
};

function createUnavailableWallet(index: number): WalletAdapter {
  const id = `wallet-${index}`;
  return {
    id,
    name: `Wallet ${index}`,
    url: `https://example.test/${id}`,
    isAvailable: async () => false,
    connect: async () => ({ address: `rWallet${index}`, network }),
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
}

const wallets = Array.from({ length: 12 }, (_, index) => createUnavailableWallet(index + 1));
const connector = document.querySelector('#wallet-connector') as HTMLElement & {
  setWalletManager(manager: WalletManager): void;
  open(): Promise<void>;
};
connector.setAttribute('wallets', wallets.map((wallet) => wallet.id).join(','));
connector.setWalletManager(new WalletManager({ adapters: wallets }));

document.querySelector('#open-wallet-dialog')?.addEventListener('click', () => {
  void connector.open();
});
