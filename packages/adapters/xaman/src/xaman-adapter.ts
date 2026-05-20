/**
 * Xaman (formerly Xumm) Wallet Adapter
 */

import { Xumm } from 'xumm';
import {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  Transaction,
  SignedTransaction,
  SignedMessage,
  SubmittedTransaction,
} from '@xrpl-connect/core';
import { createWalletError, createLogger, resolveNetwork } from '@xrpl-connect/core';
import iconSvg from './assets/icon.svg';

const ICON_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(iconSvg)}`;

/**
 * Logger instance for Xaman adapter
 */
const logger = createLogger('[Xaman]');

/**
 * Xaman adapter options
 */
export interface XamanAdapterOptions {
  apiKey?: string; // Xumm API key (can also be provided in connect options)
  onQRCode?: (uri: string) => void; // Callback for QR code URI
  onDeepLink?: (uri: string) => string; // Transform URI for deep linking
  // returnUrl?: string; // URL to return to after signing on mobile (appends ?payloadId=xxx). If not provided, keeps listening in background
}

export type XamanConnectOptions = {
  apiKey?: string;
  onQRCode?: (uri: string) => void;
  onDeepLink?: (uri: string) => string;
};

/**
 * Xaman wallet adapter implementation
 */
export class XamanAdapter implements WalletAdapter {
  readonly id = 'xaman';
  readonly name = 'Xaman';
  readonly icon = ICON_DATA_URL;
  readonly url = 'https://xaman.app';

  private client: Xumm | null = null;
  private currentAccount: AccountInfo | null = null;
  private options: XamanAdapterOptions;
  // Per-connection callback overrides. Populated by connect() and cleared by
  // cleanup(); avoids mutating constructor-supplied options across calls.
  private activeCallbacks: {
    onQRCode?: (uri: string) => void;
    onDeepLink?: (uri: string) => string;
  } = {};

  constructor(options: XamanAdapterOptions = {}) {
    this.options = options;
  }

  /**
   * Xaman is always available (uses OAuth flow, no extension needed)
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async checkXamanState(
    options?: ConnectOptions<XamanConnectOptions>
  ): Promise<AccountInfo | null> {
    const apiKey = options?.apiKey || this.options.apiKey;
    let network = options?.network;

    if (!apiKey) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error(
          'API key is required for Xaman. Please provide it in connect options or adapter constructor.'
        )
      );
    }

    this.client = new Xumm(apiKey);
    const address = await this.client.user.account;

    if (!address) {
      this.client.logout();
      return null;
    }

    // Resolve network if not provided
    const currentNetwork = (await this.getAccount())?.network;
    if (!network) network = currentNetwork;

    let resolvedNetwork: NetworkInfo;
    if (network) {
      resolvedNetwork = resolveNetwork(network);
    } else {
      const xamanNetwork = await this.client.user.networkEndpoint;
      if (!xamanNetwork) {
        throw createWalletError.connectionFailed(
          this.name,
          new Error(
            'Unable to determine network from Xaman. Make sure the API key and network are correct.'
          )
        );
      }
      resolvedNetwork = this.parseNetwork(xamanNetwork);
    }

    this.currentAccount = {
      address,
      publicKey: undefined, // Xaman doesn't expose public key
      network: resolvedNetwork,
    };

    return this.currentAccount;
  }

  /**
   * Connect to Xaman wallet
   */
  async connect(options?: ConnectOptions<XamanConnectOptions>): Promise<AccountInfo> {
    const apiKey = options?.apiKey || this.options.apiKey;

    if (!apiKey) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error(
          'API key is required for Xaman. Please provide it in connect options or adapter constructor.'
        )
      );
    }

    // Reset any leftover state from a previous connection attempt so a fast
    // disconnect → connect cycle doesn't carry stale client/callbacks forward.
    this.cleanup();

    // Stash per-connection callback overrides without mutating constructor
    // options — those must remain valid for any future connect() call.
    this.activeCallbacks = {
      onQRCode: options?.onQRCode,
      onDeepLink: options?.onDeepLink,
    };

    try {
      this.client = new Xumm(apiKey);
      logger.debug('Starting authorization flow');

      const authResult = await this.client.authorize();
      logger.debug('Authorization result:', {
        hasResult: !!authResult,
        isError: authResult instanceof Error,
        hasMe: authResult && !(authResult instanceof Error) ? !!authResult.me : false,
      });

      if (!authResult || authResult instanceof Error) {
        throw authResult || new Error('Authorization failed');
      }

      logger.debug('Authorization successful', { account: authResult.me?.account });

      const account = authResult.me.account;
      const network: NetworkInfo = resolveNetwork(options?.network);

      this.currentAccount = {
        address: account,
        publicKey: undefined, // Xaman doesn't expose public key in authorize response
        network,
      };

      return this.currentAccount;
    } catch (error) {
      logger.error('Authorization failed:', error);
      // Drop the half-initialized client + per-connection callbacks so the
      // next connect() starts from a clean slate.
      this.cleanup();
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
   * Create a Xaman payload, open the signing popup, and wait for the result.
   * Shared logic used by both sign() and signAndSubmit().
   */
  private async createAndWaitForPayload(
    transaction: Transaction
  ): Promise<{ txid: string; tx_blob: string; signature: string }> {
    if (!this.client || !this.currentAccount) {
      throw createWalletError.notConnected();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = await this.client.payload?.createAndSubscribe(transaction as any);

    if (!payload) {
      throw new Error('Failed to create payload');
    }

    this.openSignWindow(payload.created.next.always);

    const result = await this.waitForSignature(payload.websocket.url);

    if (!result.signed) {
      throw createWalletError.signRejected();
    }

    return {
      txid: result.txid || '',
      tx_blob: result.tx_blob || '',
      signature: result.signature || '',
    };
  }

  /**
   * Sign a transaction without submitting it to the ledger
   * Note: Xaman uses a popup flow for signing.
   */
  async sign(transaction: Transaction): Promise<SignedTransaction> {
    try {
      const result = await this.createAndWaitForPayload(transaction);

      return {
        hash: '',
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
   * Sign and submit a transaction to the ledger
   * Note: Xaman handles submission internally based on user's wallet settings.
   */
  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    try {
      const result = await this.createAndWaitForPayload(transaction);

      return {
        hash: result.txid,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = await this.client.payload?.create({
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
   * Open popup window for signing or trigger QR code callback
   */
  private openSignWindow(url: string): void {
    logger.debug('openSignWindow called with URL:', url.substring(0, 50) + '...');
    const onQRCode = this.activeCallbacks.onQRCode || this.options.onQRCode;
    logger.debug('onQRCode callback exists:', !!onQRCode);

    // If QR code callback is provided, use that instead of popup
    if (onQRCode) {
      logger.debug('Calling onQRCode callback');
      onQRCode(url);
      return;
    }

    // Otherwise, open popup (legacy behavior)
    logger.debug('Opening popup window');
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
   * Get deep link URI for mobile (Xaman app)
   */
  public getDeepLinkURI(url: string): string {
    const onDeepLink = this.activeCallbacks.onDeepLink || this.options.onDeepLink;
    if (onDeepLink) {
      return onDeepLink(url);
    }
    // Xaman deep link format
    return `xumm://xumm.app/sign/${url.split('/').pop()}`;
  }

  /**
   * Wait for signature via WebSocket
   */
  private waitForSignature(wsUrl: string): Promise<{
    signed: boolean;
    txid?: string;
    tx_blob?: string;
    signature?: string;
    account?: string;
  }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(
        () => {
          ws.close();
          reject(new Error('Signing timeout - user did not respond'));
        },
        5 * 60 * 1000
      ); // 5 minute timeout

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
              account: data.account,
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
    this.activeCallbacks = {};
  }
}
