import { WalletManager, type NetworkInfo, type WalletAdapter } from '@xrpl-connect/core';
import '../../src/wallet-connector';

const STRICT_CSP_NONCE = 'strict-csp-test-nonce';
const network: NetworkInfo = {
  id: 'testnet',
  name: 'Testnet',
  wss: 'wss://example.test',
};

function createWallet(id: string, name: string, address: string): WalletAdapter {
  return {
    id,
    name,
    url: `https://example.test/${id}`,
    isAvailable: async () => true,
    connect: async () => ({ address, network }),
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

const wallet = createWallet('wallet-1', 'Wallet 1', 'rWallet1');
const walletManager = new WalletManager({ adapters: [wallet] });
const htmlConnector = document.querySelector('#html-connector') as HTMLElement & {
  setWalletManager(manager: WalletManager): void;
  open(): Promise<void>;
  showLoadingView(walletId: string, walletName: string, walletIcon?: string): void;
};
htmlConnector.setAttribute('wallets', wallet.id);
htmlConnector.setWalletManager(walletManager);

document.querySelector('#open-wallet-dialog')?.addEventListener('click', () => {
  void htmlConnector.open();
});

const accountWallet = createWallet('account-wallet', 'Account Wallet', 'rAccountWallet');
const accountManager = new WalletManager({ adapters: [accountWallet] });
await accountManager.connect(accountWallet.id);

// Assign the native nonce before appending so the first connectedCallback render
// can authorize its shadow-root stylesheet under the enforced policy.
const jsConnector = document.createElement('xrpl-wallet-connector') as HTMLElement & {
  nonce: string;
  setWalletManager(manager: WalletManager): void;
};
jsConnector.id = 'js-connector';
jsConnector.nonce = STRICT_CSP_NONCE;
document.body.append(jsConnector);
jsConnector.setWalletManager(accountManager);

document.body.dataset.ready = 'true';
