import { secp256k1 } from '@noble/curves/secp256k1';
import { deriveAddress } from 'xrpl';
import {
  createWalletError,
  type SignedTransaction,
  type Transaction,
  type WalletAuthPrompt,
} from 'xrpl-connect/core';
import { PrivyWalletAdapter, type PrivyTransactionReviewOption } from './privy-adapter';
import type { PrivyWallet } from './session-types';

export interface MockPrivyAdapterOptions {
  /** Use the same test-only key when recreating a fixture across page loads. */
  privateKey?: Uint8Array;
  /** Observe when the offline signer is actually invoked, after review. */
  onSign?: (hash: `0x${string}`) => void;
  transactionReview?: PrivyTransactionReviewOption;
}

/** Offline adapter for testing connection, transaction review and prepared signing. */
export class MockPrivyAdapter extends PrivyWalletAdapter {
  override readonly capabilities = {
    sign: true,
    signAndSubmit: false,
    signMessage: false,
  } as const;

  constructor(options: MockPrivyAdapterOptions = {}) {
    super(
      { appId: 'offline-test', transactionReview: options.transactionReview },
      new OfflineSession(options)
    );
  }

  override async isAvailable(): Promise<boolean> {
    return true;
  }

  override async sign(transaction: Transaction): Promise<SignedTransaction> {
    if (transaction.Fee === undefined || transaction.Sequence === undefined) {
      throw createWalletError.unsupportedMethod('Supply Fee and Sequence to sign offline');
    }
    return super.sign(transaction);
  }

  override async signAndSubmit(): Promise<never> {
    throw createWalletError.unsupportedMethod('The offline test wallet cannot submit transactions');
  }
}

class OfflineSession {
  private readonly privateKey: Uint8Array;
  private readonly wallet: PrivyWallet;
  private readonly listeners = new Set<(prompt: WalletAuthPrompt | null) => void>();
  private connected = false;
  readonly mfa = {
    status: async () => ({ credentialIds: [], enrolled: false }),
    linkPasskey: async (): Promise<never> => {
      throw createWalletError.unsupportedMethod('The offline wallet has no passkeys');
    },
    enrollPasskey: async (): Promise<never> => {
      throw createWalletError.unsupportedMethod('The offline wallet has no passkeys');
    },
  };

  constructor(private readonly options: MockPrivyAdapterOptions) {
    this.privateKey = options.privateKey?.slice() ?? secp256k1.utils.randomPrivateKey();
    const publicKey = Array.from(secp256k1.getPublicKey(this.privateKey), (byte) =>
      byte.toString(16).padStart(2, '0')
    )
      .join('')
      .toUpperCase();
    const address = deriveAddress(publicKey);
    this.wallet = {
      id: `mock-${address}`,
      userId: `did:privy:mock-${address}`,
      address,
      publicKey,
    };
  }

  hasPendingConnection(): boolean {
    return false;
  }

  async getLoginMethods() {
    return [{ id: 'email', label: 'Email', connectOptions: { loginMethod: 'email' } }];
  }

  onAuthPrompt(listener: (prompt: WalletAuthPrompt | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onSessionLost(): () => void {
    return () => {};
  }

  async connect(
    method: string | undefined,
    signal: AbortSignal,
    restore?: { walletId: string; userId: string }
  ) {
    if (restore && (restore.walletId !== this.wallet.id || restore.userId !== this.wallet.userId)) {
      throw createWalletError.notConnected();
    }
    if (!restore && method !== undefined) {
      if (method !== 'email')
        throw createWalletError.unsupportedMethod('Unknown offline login method');
      await this.requestCode(signal);
    }
    if (signal.aborted) throw createWalletError.notConnected();
    this.connected = true;
    return { ...this.wallet };
  }

  private async requestCode(signal: AbortSignal): Promise<void> {
    if (!this.listeners.size)
      throw createWalletError.connectionFailed(
        'Offline email',
        new Error('An authentication prompt listener is required')
      );
    let active = true;
    let onAbort: () => void = () => {};
    try {
      await new Promise<void>((resolve, reject) => {
        onAbort = () => reject(createWalletError.notConnected());
        if (signal.aborted) return onAbort();
        signal.addEventListener('abort', onAbort, { once: true });
        const prompt: WalletAuthPrompt = {
          title: 'Enter the test verification code',
          fields: [
            {
              name: 'code',
              label: 'Verification code',
              type: 'text',
              inputMode: 'numeric',
              codeLength: 6,
            },
          ],
          submitLabel: 'Verify',
          submit: async ({ code }) => {
            if (!active || signal.aborted) throw createWalletError.notConnected();
            if (code !== '000000') throw new Error('Use 000000 for the offline test wallet');
            active = false;
            resolve();
          },
          cancel: () => {
            active = false;
            reject(createWalletError.connectionRejected('Offline email'));
          },
        };
        for (const listener of this.listeners) listener(prompt);
      });
    } finally {
      active = false;
      signal.removeEventListener('abort', onAbort);
      for (const listener of this.listeners) listener(null);
    }
  }

  async signHash(wallet: PrivyWallet, hash: `0x${string}`, signal: AbortSignal) {
    if (signal.aborted || !this.connected || wallet.id !== this.wallet.id)
      throw createWalletError.notConnected();
    this.options.onSign?.(hash);
    return `0x${secp256k1.sign(hash.slice(2), this.privateKey).toCompactHex()}`;
  }

  async disconnect() {
    this.connected = false;
  }
  async getAccessToken() {
    return null;
  }
}
