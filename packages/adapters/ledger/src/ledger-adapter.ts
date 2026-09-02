/**
 * Ledger Hardware Wallet Adapter for XRPL
 */
import type Transport from '@ledgerhq/hw-transport';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import Xrp from '@ledgerhq/hw-app-xrp';
import {
  encode,
  encodeForMultiSigning,
  encodeForSigning,
  verifyKeypairSignature,
  Client,
} from 'xrpl';

import type {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  Transaction,
  SignedTransaction,
  SignedMessage,
  SubmittedTransaction,
  SupportsFetchAccount,
  SupportsReconnectOptions,
  ReconnectOptions,
} from '@xrpl-connect/core';
import { createWalletError, isWalletError, resolveNetwork } from '@xrpl-connect/core';

import type { LedgerAdapterOptions, LedgerConnectOptions } from './types';
import { LedgerDeviceState } from './types';
import {
  parseLedgerError,
  isBrowserSupported,
  formatLedgerError,
  isLedgerUserCancelled,
} from './errors';
import iconSvg from './assets/icon.svg';

const ICON_DATA_URL = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;

function formattedLedgerError(error: unknown): Error {
  const formatted = new Error(formatLedgerError(error));
  (formatted as Error & { cause?: unknown }).cause = error;
  return formatted;
}

/**
 * Default timeout for Ledger operations (60 seconds)
 * Users need time to confirm on device
 */
const DEFAULT_TIMEOUT = 60000;

interface LedgerSignedTransaction {
  tx_blob: string;
  tx_json: Transaction;
  signature: string;
}

/**
 * Ledger adapter implementation
 */
export class LedgerAdapter
  implements WalletAdapter, SupportsFetchAccount, SupportsReconnectOptions
{
  readonly id = 'ledger';
  readonly name = 'Ledger';
  readonly icon = ICON_DATA_URL;
  readonly url = 'https://www.ledger.com';

  private transport: Transport | null = null;
  private xrpApp: Xrp | null = null;
  private currentAccount: AccountInfo | null = null;
  private derivationPath: string;
  private timeout: number;
  private preferWebHID: boolean;

  constructor(options: LedgerAdapterOptions = {}) {
    if (options.derivationPath) {
      this.derivationPath = options.derivationPath;
    } else {
      const accountIndex = options.accountIndex ?? 0;
      this.derivationPath = `44'/144'/${accountIndex}'/0/0`;
    }
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.preferWebHID = options.preferWebHID !== false;
  }

  /**
   * Check if Ledger is available (browser supports WebHID/WebUSB)
   */
  async isAvailable(): Promise<boolean> {
    const browserSupport = isBrowserSupported();
    return browserSupport.supported;
  }

  /** Persist the effective path used to derive the connected Ledger address. */
  serializeReconnectOptions(_options: ConnectOptions<LedgerConnectOptions>): ReconnectOptions {
    return { derivationPath: this.derivationPath };
  }

  /**
   * Get the current device state
   */
  async getDeviceState(): Promise<LedgerDeviceState> {
    try {
      const transport = await this.createTransport();
      const xrpApp = new Xrp(transport);
      await xrpApp.getAddress(this.derivationPath, false, false);
      await transport.close();
      return LedgerDeviceState.READY;
    } catch (error) {
      const { state } = parseLedgerError(error);
      return state;
    }
  }

  /**
   * Connect to Ledger device
   */
  async connect(options?: ConnectOptions<LedgerConnectOptions>): Promise<AccountInfo> {
    try {
      const browserSupport = isBrowserSupported();
      if (!browserSupport.supported) {
        throw createWalletError.unknown(
          browserSupport.message || 'Browser does not support Ledger'
        );
      }

      if (options?.derivationPath && typeof options.derivationPath === 'string') {
        this.derivationPath = options.derivationPath;
      } else if (options?.accountIndex !== undefined && typeof options.accountIndex === 'number') {
        this.derivationPath = `44'/144'/${options.accountIndex}'/0/0`;
      }

      const network = resolveNetwork(options?.network);
      this.transport = await this.createTransport();
      this.xrpApp = new Xrp(this.transport);

      const result = await this.withTimeout(
        this.xrpApp.getAddress(this.derivationPath, false, false),
        'Connection timeout. Please check your Ledger device.'
      );

      if (!result || !result.address) {
        throw new Error('Failed to get address from Ledger device');
      }

      const { address, publicKey } = result;

      this.currentAccount = {
        address,
        publicKey,
        network,
      };

      return this.currentAccount;
    } catch (error) {
      await this.cleanup();
      if (isWalletError(error)) throw error;

      const { state, message } = parseLedgerError(error);

      if (
        isLedgerUserCancelled(error) ||
        (state === LedgerDeviceState.READY && message.includes('rejected'))
      ) {
        throw createWalletError.connectionRejected(
          this.name,
          error instanceof Error ? error : new Error(message)
        );
      } else if (state === LedgerDeviceState.NOT_CONNECTED) {
        throw createWalletError.notInstalled(
          'Ledger device not found. Please connect your Ledger via USB.'
        );
      } else if (state === LedgerDeviceState.LOCKED) {
        throw createWalletError.connectionFailed(
          this.name,
          new Error('Ledger is locked. Please unlock your Ledger by entering your PIN.')
        );
      } else if (state === LedgerDeviceState.APP_NOT_OPEN) {
        throw createWalletError.connectionFailed(
          this.name,
          new Error('XRP app is not open. Please open the XRP application on your Ledger device.')
        );
      } else {
        throw createWalletError.connectionFailed(this.name, formattedLedgerError(error));
      }
    }
  }

  /**
   * Disconnect from Ledger
   */
  async disconnect(): Promise<void> {
    this.currentAccount = null;
    await this.cleanup();
  }

  /**
   * Get current account
   */
  async getAccount(): Promise<AccountInfo | null> {
    return this.currentAccount;
  }

  /**
   * Re-read the configured derivation path from the connected Ledger device.
   */
  async fetchAccount(): Promise<AccountInfo | null> {
    if (!this.currentAccount) return null;
    if (!this.xrpApp) throw createWalletError.notConnected();

    const xrpApp = this.xrpApp;
    const network = this.currentAccount.network;

    try {
      const result = await this.withTimeout(
        xrpApp.getAddress(this.derivationPath, false, false),
        'Account refresh timeout. Please check your Ledger device.'
      );

      if (!result?.address) {
        throw new Error('Failed to get address from Ledger device');
      }
      if (this.xrpApp !== xrpApp || !this.currentAccount) {
        throw createWalletError.notConnected();
      }

      this.currentAccount = {
        address: result.address,
        publicKey: result.publicKey,
        network,
      };
      return this.currentAccount;
    } catch (error) {
      if (isWalletError(error)) throw error;

      const { state, message } = parseLedgerError(error);
      if (state === LedgerDeviceState.NOT_CONNECTED) {
        throw createWalletError.notInstalled(
          'Ledger device not found. Please connect your Ledger via USB.'
        );
      }
      if (state === LedgerDeviceState.LOCKED) {
        throw createWalletError.connectionFailed(
          this.name,
          new Error('Ledger is locked. Please unlock your Ledger by entering your PIN.')
        );
      }
      if (state === LedgerDeviceState.APP_NOT_OPEN) {
        throw createWalletError.connectionFailed(
          this.name,
          new Error('XRP app is not open. Please open the XRP application on your Ledger device.')
        );
      }
      throw createWalletError.connectionFailed(
        this.name,
        new Error(message || (error as Error).message)
      );
    }
  }

  /**
   * Get current network
   */
  async getNetwork(): Promise<NetworkInfo> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }
    return this.currentAccount.network;
  }

  /** Encode and sign a prepared transaction with the Ledger device. */
  private async signPreparedTransaction(
    transaction: Transaction,
    account: AccountInfo,
    xrpApp: Xrp,
    multisigned: boolean
  ): Promise<LedgerSignedTransaction> {
    const txForSigning = { ...transaction };
    const publicKey = account.publicKey?.toUpperCase();
    if (!publicKey) throw new Error('Ledger did not provide a public key for signing');

    txForSigning.SigningPubKey = multisigned ? '' : publicKey;

    // Ledger firmware detects an empty SigningPubKey and applies the XRPL
    // multisigning prefix and device AccountID itself. It must receive the
    // ordinary unsigned transaction serialization in both signing modes.
    const txBlob = encode(txForSigning).toUpperCase();
    const signature = await this.withTimeout(
      xrpApp.signTransaction(this.derivationPath, txBlob),
      'Signing timeout. Please confirm the transaction on your Ledger device.'
    );

    if (!signature) {
      throw new Error('Failed to sign transaction with Ledger');
    }

    const normalizedSignature = signature.toUpperCase();
    const signingBlob = multisigned
      ? encodeForMultiSigning(txForSigning, account.address)
      : encodeForSigning(txForSigning);
    if (!verifyKeypairSignature(signingBlob, normalizedSignature, publicKey)) {
      throw new Error('Ledger returned a signature that does not match the connected account');
    }

    const tx_json = (
      multisigned
        ? {
            ...txForSigning,
            Signers: [
              {
                Signer: {
                  Account: account.address,
                  SigningPubKey: publicKey,
                  TxnSignature: normalizedSignature,
                },
              },
            ],
          }
        : {
            ...txForSigning,
            TxnSignature: normalizedSignature,
          }
    ) as Transaction;

    return {
      tx_blob: encode(tx_json),
      tx_json,
      signature: normalizedSignature,
    };
  }

  private getSigningContext(): { account: AccountInfo; xrpApp: Xrp } {
    if (!this.currentAccount) throw createWalletError.notConnected();
    if (!this.xrpApp) throw createWalletError.unknown('Ledger XRP app not initialized');
    return { account: this.currentAccount, xrpApp: this.xrpApp };
  }

  private validateSigningInput(transaction: Transaction): boolean {
    if (transaction.TxnSignature !== undefined || transaction.Signers !== undefined) {
      throw new Error('Ledger signing input must not contain TxnSignature or Signers');
    }

    const multisigned = transaction.SigningPubKey === '';
    if (multisigned) {
      if (typeof transaction.Account !== 'string' || transaction.Account.length === 0) {
        throw new Error('Ledger multisigning requires the source Account');
      }
      if (
        typeof transaction.Fee !== 'string' ||
        transaction.Fee.length === 0 ||
        typeof transaction.Sequence !== 'number'
      ) {
        throw new Error(
          'Ledger multisigning requires a prepared transaction with Fee and Sequence'
        );
      }
    }
    return multisigned;
  }

  private async withClient<T>(
    network: NetworkInfo,
    operation: (client: Client) => Promise<T>
  ): Promise<T> {
    const client = new Client(network.wss);
    await client.connect();
    try {
      return await operation(client);
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Sign a transaction without submitting it to the ledger
   */
  async sign(transaction: Transaction): Promise<SignedTransaction> {
    try {
      const { account, xrpApp } = this.getSigningContext();
      const multisigned = this.validateSigningInput(transaction);
      const tx = {
        ...transaction,
        Account: transaction.Account || account.address,
      } as Transaction;
      const signed = multisigned
        ? await this.signPreparedTransaction(tx, account, xrpApp, true)
        : await this.withClient(account.network, async (client) => {
            const prepared = await client.autofill(tx);
            return this.signPreparedTransaction(prepared, account, xrpApp, false);
          });

      return {
        hash: '',
        tx_blob: signed.tx_blob,
        tx_json: signed.tx_json,
        signature: signed.signature,
        signerAddress: account.address,
      };
    } catch (error) {
      if (isWalletError(error)) throw error;

      const { state, message } = parseLedgerError(error);

      if (
        isLedgerUserCancelled(error) ||
        (state === LedgerDeviceState.READY && message.includes('rejected'))
      ) {
        throw createWalletError.signRejected(
          error instanceof Error ? error : new Error(formatLedgerError(error))
        );
      }

      throw createWalletError.signFailed(formattedLedgerError(error));
    }
  }

  /**
   * Sign and submit a transaction to the ledger
   */
  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    try {
      const { account, xrpApp } = this.getSigningContext();
      if (this.validateSigningInput(transaction)) {
        throw createWalletError.unsupportedMethod(
          'Ledger multisigning returns one signer contribution; combine and submit contributions separately'
        );
      }

      return await this.withClient(account.network, async (client) => {
        const tx = {
          ...transaction,
          Account: transaction.Account || account.address,
        } as Transaction;
        const prepared = await client.autofill(tx);
        const signed = await this.signPreparedTransaction(prepared, account, xrpApp, false);
        const result = await client.submitAndWait(signed.tx_blob);
        return {
          hash: result.result.hash || '',
          id: result.result.hash || '',
          tx_blob: signed.tx_blob,
          tx_json: signed.tx_json,
          signature: signed.signature,
        };
      });
    } catch (error) {
      if (isWalletError(error)) throw error;

      const { state, message } = parseLedgerError(error);

      if (
        isLedgerUserCancelled(error) ||
        (state === LedgerDeviceState.READY && message.includes('rejected'))
      ) {
        throw createWalletError.signRejected(
          error instanceof Error ? error : new Error(formatLedgerError(error))
        );
      }

      throw createWalletError.signFailed(formattedLedgerError(error));
    }
  }

  /**
   * Sign a message
   */
  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    if (!this.xrpApp) {
      throw createWalletError.unknown('Ledger XRP app not initialized');
    }

    try {
      const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);

      const messageHex = Array.from(new TextEncoder().encode(messageStr))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const signature = await this.withTimeout(
        this.xrpApp.signTransaction(this.derivationPath, messageHex),
        'Signing timeout. Please confirm the message on your Ledger device.'
      );

      if (!signature) {
        throw new Error('Failed to sign message with Ledger');
      }

      return {
        message: messageStr,
        signature,
        publicKey: this.currentAccount.publicKey || '',
      };
    } catch (error) {
      if (isWalletError(error)) throw error;

      const { state, message } = parseLedgerError(error);
      if (
        isLedgerUserCancelled(error) ||
        (state === LedgerDeviceState.READY && message.includes('rejected'))
      ) {
        throw createWalletError.signRejected(
          error instanceof Error ? error : formattedLedgerError(error)
        );
      }
      throw createWalletError.signFailed(formattedLedgerError(error));
    }
  }

  /**
   * Get multiple accounts from Ledger device
   * Useful for account selection UI
   *
   * @param count Number of accounts to retrieve (default: 5)
   * @param startIndex Starting account index (default: 0)
   * @returns Array of account addresses with their derivation paths
   *
   * @example
   * ```typescript
   * const accounts = await ledgerAdapter.getAccounts(5, 0);
   * // Returns accounts at paths 44'/144'/0'/0/0 through 44'/144'/4'/0/0
   * ```
   */
  async getAccounts(
    count: number = 5,
    startIndex: number = 0
  ): Promise<Array<{ address: string; publicKey: string; path: string; index: number }>> {
    const needsCleanup = !this.transport;

    try {
      if (!this.transport) {
        this.transport = await this.createTransport();
        this.xrpApp = new Xrp(this.transport);
      }

      if (!this.xrpApp) {
        throw new Error('Failed to initialize Ledger XRP app');
      }

      const accounts = [];
      let lastError: unknown = null;

      for (let i = 0; i < count; i++) {
        const accountIndex = startIndex + i;
        const path = `44'/144'/${accountIndex}'/0/0`;

        try {
          const result = await this.withTimeout(
            this.xrpApp.getAddress(path, false, false),
            'Timeout retrieving account information'
          );

          accounts.push({
            address: result.address,
            publicKey: result.publicKey,
            path,
            index: accountIndex,
          });
        } catch (error) {
          if (isWalletError(error) || isLedgerUserCancelled(error)) throw error;

          lastError = error;
          console.warn(`Failed to get account at index ${accountIndex}:`, error);
        }
      }

      if (accounts.length === 0 && lastError) {
        throw new Error(parseLedgerError(lastError).message);
      }

      return accounts;
    } catch (error) {
      if (isWalletError(error)) throw error;
      if (isLedgerUserCancelled(error)) {
        throw createWalletError.connectionRejected(
          this.name,
          error instanceof Error ? error : formattedLedgerError(error)
        );
      }
      throw createWalletError.unknown(`Failed to retrieve accounts: ${(error as Error).message}`);
    } finally {
      if (needsCleanup) await this.cleanup();
    }
  }

  /**
   * Create transport (WebHID or WebUSB)
   */
  private async createTransport(): Promise<Transport> {
    const browserSupport = isBrowserSupported();
    const transports = this.preferWebHID
      ? [
          {
            name: 'WebHID',
            supported: browserSupport.webHID,
            create: () => TransportWebHID.create(),
          },
          {
            name: 'WebUSB',
            supported: browserSupport.webUSB,
            create: () => TransportWebUSB.create(),
          },
        ]
      : [
          {
            name: 'WebUSB',
            supported: browserSupport.webUSB,
            create: () => TransportWebUSB.create(),
          },
          {
            name: 'WebHID',
            supported: browserSupport.webHID,
            create: () => TransportWebHID.create(),
          },
        ];
    const availableTransports = transports.filter(({ supported }) => supported);
    let lastError: unknown;

    for (const [index, transport] of availableTransports.entries()) {
      try {
        return await transport.create();
      } catch (error) {
        if (isWalletError(error) || isLedgerUserCancelled(error)) throw error;

        lastError = error;
        if (index < availableTransports.length - 1) {
          console.warn(`${transport.name} transport failed, trying fallback:`, error);
        }
      }
    }

    if (lastError) throw lastError;
    throw new Error('No compatible transport available');
  }

  /**
   * Clean up transport connection
   */
  private async cleanup(): Promise<void> {
    const transport = this.transport;
    this.transport = null;
    this.xrpApp = null;
    if (transport) {
      try {
        await transport.close();
      } catch (error) {
        console.warn('Error closing Ledger transport:', error);
      }
    }
  }

  /**
   * Wrap promise with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, errorMessage: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), this.timeout)
      ),
    ]);
  }
}
