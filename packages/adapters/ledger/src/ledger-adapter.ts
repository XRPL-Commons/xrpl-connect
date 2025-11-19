/**
 * Ledger Hardware Wallet Adapter for XRPL
 */
import type Transport from '@ledgerhq/hw-transport';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import Xrp from '@ledgerhq/hw-app-xrp';
import { encode, Client } from 'xrpl';

import type {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  Transaction,
  SignedMessage,
  SubmittedTransaction,
} from '@xrpl-connect/core';
import { createWalletError, STANDARD_NETWORKS } from '@xrpl-connect/core';

import type { LedgerAdapterOptions, LedgerConnectOptions } from './types';
import { LedgerDeviceState } from './types';
import { parseLedgerError, isBrowserSupported, formatLedgerError } from './errors';

/**
 * Default timeout for Ledger operations (60 seconds)
 * Users need time to confirm on device
 */
const DEFAULT_TIMEOUT = 60000;

/**
 * Ledger adapter implementation
 */
export class LedgerAdapter implements WalletAdapter {
  readonly id = 'ledger';
  readonly name = 'Ledger';
  readonly icon =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOCIgaGVpZ2h0PSIyOCIgZmlsbD0ibm9uZSI+PHBhdGggZmlsbD0iIzAwMCIgZD0iTTAgMGgyOHYyOEgweiIvPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTTExLjY1IDQuNEg0LjRWOWgxLjFWNS41bDYuMTUtLjA0VjQuNFptLjA1IDUuOTV2Ny4yNWg0LjZ2LTEuMWgtMy41bC0uMDQtNi4xNUgxMS43Wk00LjQgMjMuNmg3LjI1di0xLjA2TDUuNSAyMi41VjE5SDQuNHY0LjZaTTE2LjM1IDQuNGg3LjI1VjloLTEuMVY1LjVsLTYuMTUtLjA0VjQuNFptNy4yNSAxOS4yaC03LjI1di0xLjA2bDYuMTUtLjA0VjE5aDEuMXY0LjZaIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiLz48L3N2Zz4=';
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

      const network = this.resolveNetwork(options?.network);
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
      const { state, message } = parseLedgerError(error);

      if (state === LedgerDeviceState.NOT_CONNECTED) {
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
        throw createWalletError.connectionFailed(
          this.name,
          new Error(message || (error as Error).message)
        );
      }
    }
  }

  /**
   * Disconnect from Ledger
   */
  async disconnect(): Promise<void> {
    await this.cleanup();
    this.currentAccount = null;
  }

  /**
   * Get current account
   */
  async getAccount(): Promise<AccountInfo | null> {
    return this.currentAccount;
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

  /**
   * Sign and optionally submit a transaction
   */
  async signAndSubmit(
    transaction: Transaction,
    submit: boolean = true
  ): Promise<SubmittedTransaction> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    if (!this.xrpApp) {
      throw createWalletError.unknown('Ledger XRP app not initialized');
    }

    try {
      // Connect to XRPL to autofill transaction fields
      const client = new Client(this.currentAccount.network.wss);
      await client.connect();

      try {
        const tx: Transaction = {
          ...transaction,
          Account: transaction.Account || this.currentAccount.address,
        };

        const prepared = await client.autofill(tx);

        // Prepare transaction for signing - remove fields that shouldn't be in the signing blob
        const txForSigning: Transaction = { ...prepared };
        delete txForSigning.TxnSignature;
        delete txForSigning.Signers;

        // Check if this is a multisig transaction
        const isMultisig = txForSigning.SigningPubKey === '';

        // Set SigningPubKey appropriately
        if (isMultisig) {
          // For multisig: keep SigningPubKey empty
          txForSigning.SigningPubKey = '';
        } else {
          // For single-sig: set SigningPubKey to device's public key
          txForSigning.SigningPubKey = this.currentAccount.publicKey!.toUpperCase();
        }

        // Encode transaction to binary format for Ledger
        const txBlob = encode(txForSigning).toUpperCase();

        // Sign with Ledger device
        const signature = await this.withTimeout(
          this.xrpApp.signTransaction(this.derivationPath, txBlob),
          'Signing timeout. Please confirm the transaction on your Ledger device.'
        );

        if (!signature) {
          throw new Error('Failed to sign transaction with Ledger');
        }

        // Build the signed transaction blob with signature
        const signedTx: Transaction = {
          ...txForSigning,
          TxnSignature: signature.toUpperCase(),
        };

        const tx_blob = encode(signedTx);

        // If submit is false, just return the signed transaction
        if (!submit) {
          await client.disconnect();
          return {
            hash: '',
            tx_blob,
          };
        }

        // Submit the transaction to the network
        const result = await client.submitAndWait(tx_blob);
        await client.disconnect();

        return {
          hash: result.result.hash || '',
          id: result.result.hash || '',
          tx_blob,
        };
      } catch (error) {
        await client.disconnect();
        throw error;
      }
    } catch (error) {
      const { state, message } = parseLedgerError(error);

      if (state === LedgerDeviceState.READY && message.includes('rejected')) {
        throw createWalletError.signRejected();
      }

      throw createWalletError.signFailed(new Error(formatLedgerError(error)));
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
      throw createWalletError.signFailed(new Error(formatLedgerError(error)));
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
    try {
      const needsCleanup = !this.transport;
      if (!this.transport) {
        this.transport = await this.createTransport();
        this.xrpApp = new Xrp(this.transport);
      }

      if (!this.xrpApp) {
        throw new Error('Failed to initialize Ledger XRP app');
      }

      const accounts = [];
      let lastError: Error | null = null;

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
          lastError = error as Error;
          console.warn(`Failed to get account at index ${accountIndex}:`, error);
        }
      }

      if (needsCleanup) {
        await this.cleanup();
      }

      if (accounts.length === 0 && lastError) {
        const parsedError = parseLedgerError(lastError);
        throw parsedError;
      }

      return accounts;
    } catch (error) {
      throw createWalletError.unknown(`Failed to retrieve accounts: ${(error as Error).message}`);
    }
  }

  /**
   * Create transport (WebHID or WebUSB)
   */
  private async createTransport(): Promise<Transport> {
    const browserSupport = isBrowserSupported();

    if (this.preferWebHID && browserSupport.webHID) {
      try {
        return await TransportWebHID.create();
      } catch (error) {
        console.warn('WebHID transport failed, trying WebUSB:', error);
      }
    }

    if (browserSupport.webUSB) {
      return await TransportWebUSB.create();
    }

    if (!this.preferWebHID && browserSupport.webUSB) {
      try {
        return await TransportWebUSB.create();
      } catch (error) {
        console.warn('WebUSB transport failed, trying WebHID:', error);
      }
    }

    if (browserSupport.webHID) {
      return await TransportWebHID.create();
    }

    throw new Error('No compatible transport available');
  }

  /**
   * Clean up transport connection
   */
  private async cleanup(): Promise<void> {
    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        console.warn('Error closing Ledger transport:', error);
      }
      this.transport = null;
    }
    this.xrpApp = null;
  }

  /**
   * Resolve network configuration
   */
  private resolveNetwork(config?: ConnectOptions['network']): NetworkInfo {
    if (!config) {
      return STANDARD_NETWORKS.mainnet;
    }

    if (typeof config === 'string') {
      const network = STANDARD_NETWORKS[config];
      if (!network) {
        throw createWalletError.unknown(`Unknown network: ${config}`);
      }
      return network;
    }

    return config;
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
