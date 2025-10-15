/**
 * Xaman (formerly Xumm) Wallet Adapter
 */

import { Xumm } from 'xumm';
import type {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  Transaction,
  SignedTransaction,
  SignedMessage,
} from '@xrpl-connect/core';
import { createWalletError } from '@xrpl-connect/core';

/**
 * Xaman adapter options
 */
export interface XamanAdapterOptions {
  apiKey?: string; // Xumm API key (can also be provided in connect options)
}

/**
 * Xaman wallet adapter implementation
 */
export class XamanAdapter implements WalletAdapter {
  readonly id = 'xaman';
  readonly name = 'Xaman Wallet';
  readonly icon =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjMDQwQjI0Ii8+CiAgPHBhdGggZD0iTTggMTZMMTYgOEwyNCA xNkwxNiAyNEw4IDE2WiIgZmlsbD0iIzNBREZGRiIvPgo8L3N2Zz4=';
  readonly url = 'https://xaman.app';

  private client: Xumm | null = null;
  private currentAccount: AccountInfo | null = null;
  private options: XamanAdapterOptions;

  constructor(options: XamanAdapterOptions = {}) {
    this.options = options;
  }

  /**
   * Xaman is always available (uses OAuth flow, no extension needed)
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Connect to Xaman wallet
   */
  async connect(options?: ConnectOptions): Promise<AccountInfo> {
    const apiKey = options?.apiKey || this.options.apiKey;

    if (!apiKey) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error('API key is required for Xaman. Please provide it in connect options or adapter constructor.')
      );
    }

    try {
      // Initialize Xumm client
      this.client = new Xumm(apiKey);

      // Authorize with OAuth2 PKCE flow
      const authResult = await this.client.authorize();

      if (!authResult || authResult instanceof Error) {
        throw authResult || new Error('Authorization failed');
      }

      // Get account info
      const account = authResult.me.account;

      // Determine network from endpoint
      const network: NetworkInfo = this.parseNetwork(authResult.me.networkEndpoint || '');

      this.currentAccount = {
        address: account,
        publicKey: undefined, // Xaman doesn't expose public key in authorize response
        network,
      };

      return this.currentAccount;
    } catch (error) {
      throw createWalletError.connectionFailed(this.name, error as Error);
    }
  }

  /**
   * Disconnect from Xaman
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.logout();
      this.cleanup();
    } catch (error) {
      // Logout might fail if already logged out, that's okay
      this.cleanup();
    }
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
   * Sign a transaction
   */
  async sign(transaction: Transaction): Promise<SignedTransaction> {
    if (!this.client || !this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      // Create and subscribe to payload
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = await this.client.payload?.createAndSubscribe(transaction as any);

      if (!payload) {
        throw new Error('Failed to create payload');
      }

      // Open popup window for signing
      this.openSignWindow(payload.created.next.always);

      // Wait for WebSocket response
      const result = await this.waitForSignature(payload.websocket.url);

      if (!result.signed) {
        throw createWalletError.signRejected();
      }

      return {
        hash: result.txid || '',
        tx_blob: result.tx_blob,
        signature: result.signature,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('rejected')) {
        throw createWalletError.signRejected();
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign a message (for authentication/verification)
   */
  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    if (!this.client || !this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      // Convert message to string if Uint8Array
      const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);

      // Use SignIn payload type for message signing
      const payload = await this.client.payload?.create({
        TransactionType: 'SignIn',
      });

      if (!payload) {
        throw new Error('Failed to create sign message payload');
      }

      // Open popup for signing
      this.openSignWindow(payload.next.always);

      // Note: Xaman doesn't directly support arbitrary message signing
      // This is a simplified implementation - in production, you'd use a custom payload
      // or implement a different approach (like signing a memo field)

      return {
        message: messageStr,
        signature: '', // Would need to extract from Xaman response
        publicKey: this.currentAccount.publicKey || '',
      };
    } catch (error) {
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Parse network from endpoint URL
   */
  private parseNetwork(endpoint: string): NetworkInfo {
    const normalized = endpoint.toLowerCase();

    if (normalized.includes('testnet') || normalized.includes('altnet')) {
      return {
        id: 'testnet',
        name: 'Testnet',
        wss: endpoint,
        walletConnectId: 'xrpl:1',
      };
    }

    if (normalized.includes('devnet')) {
      return {
        id: 'devnet',
        name: 'Devnet',
        wss: endpoint,
        walletConnectId: 'xrpl:2',
      };
    }

    // Default to mainnet
    return {
      id: 'mainnet',
      name: 'Mainnet',
      wss: endpoint || 'wss://xrplcluster.com',
      walletConnectId: 'xrpl:0',
    };
  }

  /**
   * Open popup window for signing
   */
  private openSignWindow(url: string): void {
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      url,
      'Xaman Sign',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  }

  /**
   * Wait for signature via WebSocket
   */
  private waitForSignature(wsUrl: string): Promise<{
    signed: boolean;
    txid?: string;
    tx_blob?: string;
    signature?: string;
  }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Signing timeout - user did not respond'));
      }, 5 * 60 * 1000); // 5 minute timeout

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.signed === true) {
            clearTimeout(timeout);
            ws.close();
            resolve({
              signed: true,
              txid: data.txid,
              tx_blob: data.tx_blob,
              signature: data.signature,
            });
          } else if (data.signed === false) {
            clearTimeout(timeout);
            ws.close();
            reject(new Error('Transaction signing was rejected by user'));
          }
        } catch (error) {
          clearTimeout(timeout);
          ws.close();
          reject(error);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error('WebSocket error: ' + error));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
      };
    });
  }

  /**
   * Cleanup adapter state
   */
  private cleanup(): void {
    this.client = null;
    this.currentAccount = null;
  }
}
