import { WalletManager, type NetworkInfo, type WalletAdapter } from '@xrpl-connect/core';
import '../../src/wallet-connector';

const network: NetworkInfo = {
  id: 'testnet',
  name: 'Testnet',
  wss: 'wss://example.test',
};

function createWallet(
  id: string,
  name: string,
  isAvailable: WalletAdapter['isAvailable']
): WalletAdapter {
  return {
    id,
    name,
    url: `https://example.test/${id}`,
    isAvailable,
    connect: async () => ({ address: `r${id}`, network }),
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

let resolveInitialAvailability!: (available: boolean) => void;
const initialAvailability = new Promise<boolean>((resolve) => {
  resolveInitialAvailability = resolve;
});
let initialProbeCount = 0;
let injectedProbeCount = 0;
let openEventCount = 0;

const installedWallet = createWallet('installed-wallet', 'Installed Wallet', async () => {
  initialProbeCount += 1;
  return initialProbeCount === 1 ? initialAvailability : true;
});
const injectedWallet = createWallet('injected-wallet', 'Injected Wallet', async () => {
  injectedProbeCount += 1;
  return true;
});

const manager = new WalletManager({ adapters: [installedWallet] });
const connector = document.querySelector('#wallet-connector') as HTMLElement & {
  setWalletManager(walletManager: WalletManager): void;
  open(): Promise<void>;
};
connector.addEventListener('open', () => {
  openEventCount += 1;
});
connector.setWalletManager(manager);

document.querySelector('#open-wallet-dialog')?.addEventListener('click', () => {
  void connector.open();
});

declare global {
  interface Window {
    getAvailabilityProbeCounts(): { initial: number; injected: number };
    getOpenEventCount(): number;
    injectWallet(): void;
    resolveInitialAvailability(available?: boolean): void;
  }
}

window.getAvailabilityProbeCounts = () => ({
  initial: initialProbeCount,
  injected: injectedProbeCount,
});
window.getOpenEventCount = () => openEventCount;
window.injectWallet = () => {
  manager.adapters.set(injectedWallet.id, injectedWallet);
};
window.resolveInitialAvailability = (available = true) => {
  resolveInitialAvailability(available);
};

document.body.dataset.ready = 'true';
