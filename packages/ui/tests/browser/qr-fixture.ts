import { WalletManager, type WalletAdapter } from '@xrpl-connect/core';
import '../../src/wallet-connector';

const params = new URLSearchParams(location.search);
const uri = 'wc:0123456789abcdef0123456789abcdef@2?relay-protocol=irn&symKey=' + 'ab'.repeat(32);
const inlineLogo =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#2288cc"/></svg>'
  );
const wallet: WalletAdapter = {
  id: 'walletconnect',
  name: 'WalletConnect',
  url: 'https://example.test',
  icon: params.get('logo') === 'inline' ? inlineLogo : new URL('/qr-logo.svg', location.href).href,
  isAvailable: async () => true,
  connect: async () => {
    throw new Error('No live pairing in this fixture');
  },
  disconnect: async () => {},
  getAccount: async () => null,
  getNetwork: async () => null,
  sign: async () => {
    throw new Error('Unused');
  },
  signAndSubmit: async () => {
    throw new Error('Unused');
  },
};
const connector = document.querySelector('#connector') as HTMLElement & {
  setWalletManager(manager: WalletManager): void;
  open(): Promise<void>;
  close(): void;
  preGenerateQRCode(uri: string): Promise<void>;
  preGeneratedQRCode: unknown;
  showQRCodeView(walletId: string, uri?: string): void;
  setQRCode(walletId: string, uri: string): void;
};
connector.setWalletManager(new WalletManager({ adapters: [wallet], autoConnect: false }));
await connector.open();
if (params.get('path') === 'pre-generated') {
  await connector.preGenerateQRCode(uri);
  document.body.dataset.preGenerated = String(!!connector.preGeneratedQRCode);
}
connector.showQRCodeView(wallet.id);
connector.setQRCode(wallet.id, uri);
document.body.dataset.ready = 'true';
