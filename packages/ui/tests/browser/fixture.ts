import { WalletManager, type NetworkInfo, type WalletAdapter } from '@xrpl-connect/core';
import '../../src/wallet-connector';

const network: NetworkInfo = {
  id: 'testnet',
  name: 'Testnet',
  wss: 'wss://example.test',
};

function createWallet(index: number, available: boolean): WalletAdapter {
  const id = `wallet-${index}`;
  return {
    id,
    name: `Wallet ${index}`,
    url: `https://example.test/${id}`,
    isAvailable: async () => available,
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

const wallets = Array.from({ length: 12 }, (_, index) => createWallet(index + 1, index === 0));
const connector = document.querySelector('#wallet-connector') as HTMLElement & {
  setWalletManager(manager: WalletManager): void;
  open(): Promise<void>;
};
connector.setAttribute('wallets', wallets.map((wallet) => wallet.id).join(','));
connector.setWalletManager(new WalletManager({ adapters: wallets }));

document.querySelector('#open-wallet-dialog')?.addEventListener('click', () => {
  void connector.open();
});

const accountWallet = createWallet(100, true);
const accountManager = new WalletManager({ adapters: [accountWallet] });
await accountManager.connect(accountWallet.id);
const accountConnector = document.querySelector('#account-connector') as HTMLElement & {
  setWalletManager(manager: WalletManager): void;
};
accountConnector.setWalletManager(accountManager);
