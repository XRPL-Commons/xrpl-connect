import { WalletManager, type Transaction } from '@xrpl-connect/core';
import { MockPrivyAdapter } from '../../../privy/src/testing';
import '../../src/wallet-connector';

const PRIVATE_KEY = new Uint8Array(32);
PRIVATE_KEY[31] = 1;
const ACCOUNT = 'rBgGZ9tc4him9KBzD8fKFiQz3fSZpaSwMH';
const DESTINATION = 'rcM6pp3HTU5AS3Z122kH3w3AzerJRnZ1P';
const ISSUER = 'rU74NBjYiU8pyrSd57Mo62K75hAFPspaLb';

type Outcome =
  | { status: 'pending' }
  | { status: 'signed'; transaction: Transaction | undefined }
  | { status: 'error'; code: string };

let signatureCount = 0;
let nextSequence = 1;
const outcomes: Outcome[] = [];

const privy = new MockPrivyAdapter({
  privateKey: PRIVATE_KEY,
  onSign: () => signatureCount++,
});

const manager = new WalletManager({ adapters: [privy], network: 'testnet', autoConnect: false });
const connector = document.querySelector('#wallet-connector') as HTMLElement & {
  setWalletManager(walletManager: WalletManager): void;
};
connector.setWalletManager(manager);

function track(signing: Promise<{ tx_json?: Transaction }>): number {
  const index = outcomes.push({ status: 'pending' }) - 1;
  signing.then(
    (signed) => {
      outcomes[index] = { status: 'signed', transaction: signed.tx_json };
    },
    (error: { code?: string }) => {
      outcomes[index] = { status: 'error', code: error?.code ?? String(error) };
    }
  );
  return index;
}

function signPayment(amount = '1500000'): number {
  return track(
    manager.sign({
      TransactionType: 'Payment',
      Account: ACCOUNT,
      Destination: DESTINATION,
      DestinationTag: 42,
      Amount: amount,
      Fee: '12',
      Sequence: nextSequence++,
      LastLedgerSequence: 1000,
    })
  );
}

function signOffer(): number {
  return track(
    manager.sign({
      TransactionType: 'OfferCreate',
      Account: ACCOUNT,
      TakerGets: '25000000',
      TakerPays: { currency: 'USD', issuer: ISSUER, value: '10' },
      Memos: [{ Memo: { MemoData: '68656C6C6F' } }],
      Fee: '15',
      Sequence: nextSequence++,
      LastLedgerSequence: 1000,
    })
  );
}

document.querySelector('#sign-payment')?.addEventListener('click', () => void signPayment());
document.querySelector('#sign-offer')?.addEventListener('click', () => void signOffer());

declare global {
  interface Window {
    disconnectWallet(): Promise<void>;
    getOutcomes(): Outcome[];
    getSignatureCount(): number;
    signPayment(amount?: string): number;
  }
}

window.disconnectWallet = () => manager.disconnect();
window.getOutcomes = () => outcomes.map((outcome) => ({ ...outcome }));
window.getSignatureCount = () => signatureCount;
window.signPayment = signPayment;

void manager.connect('privy').then(() => {
  document.body.dataset.ready = 'true';
});
