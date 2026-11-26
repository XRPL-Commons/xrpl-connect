import { secp256k1 } from '@noble/curves/secp256k1';
import { WalletManager, type Transaction } from '@xrpl-connect/core';
import { PrivyAdapter } from '../../../privy/src/privy-adapter';
import '../../src/register';

// Deterministic test keys: private keys 1 and 2 on secp256k1.
const PRIVATE_KEY = '1'.padStart(64, '0');
const PUBLIC_KEY = '0279BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798';
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

// The real adapter performs the review, fee limit, and signature checks; only
// the Privy network session is replaced by a local signer.
const privy = new PrivyAdapter({
  appId: 'transaction-review-fixture',
  redirectUri: `${location.origin}/wallet/privy`,
});
const localSession = {
  connect: async () => ({
    id: 'wallet-1',
    userId: 'did:privy:fixture',
    address: ACCOUNT,
    publicKey: PUBLIC_KEY,
  }),
  disconnect: async () => {},
  hasPendingConnection: () => false,
  getLoginMethods: async () => [],
  onAuthPrompt: () => () => {},
  onSessionLost: () => () => {},
  signHash: async (_wallet: unknown, hash: `0x${string}`) => {
    signatureCount += 1;
    return `0x${secp256k1.sign(hash.slice(2), PRIVATE_KEY).toCompactHex()}`;
  },
};
(privy as unknown as { session: typeof localSession }).session = localSession;

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
