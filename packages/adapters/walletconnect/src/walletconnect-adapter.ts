/**
 * WalletConnect Adapter for XRPL using WalletConnect Sign Client v2
 */

import SignClient from '@walletconnect/sign-client';
import type { SignClientTypes, SessionTypes } from '@walletconnect/types';
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

/**
 * XRPL methods supported by WalletConnect
 */
export enum XRPLMethod {
  SIGN_TRANSACTION = 'xrpl_signTransaction',
  SIGN_TRANSACTION_FOR = 'xrpl_signTransactionFor', // Multi-sig
}

/**
 * WalletConnect adapter options
 */
export interface WalletConnectAdapterOptions {
  projectId?: string; // WalletConnect/Reown project ID
  metadata?: SignClientTypes.Metadata; // App metadata
  onQRCode?: (uri: string) => void; // Callback for QR code URI
  onDeepLink?: (uri: string) => string; // Transform URI for deep linking
}

/**
 * WalletConnect adapter implementation using Sign Client v2
 */
export class WalletConnectAdapter implements WalletAdapter {
  readonly id = 'walletconnect';
  readonly name = 'WalletConnect';
  readonly icon =
    'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxuczp4b2RtPSJodHRwOi8vd3d3LmNvcmVsLmNvbS9jb3JlbGRyYXcvb2RtLzIwMDMiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgMjQ5NyAyNDk3IiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCAyNDk3IDI0OTc7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPHN0eWxlIHR5cGU9InRleHQvY3NzIj4KCS5zdDB7ZmlsbDojMzM5NkZGO3N0cm9rZTojNjZCMUZGO3N0cm9rZS13aWR0aDozO3N0cm9rZS1taXRlcmxpbWl0OjIyLjkyNTY7fQoJLnN0MXtmaWxsOiNGRkZGRkY7fQo8L3N0eWxlPgo8ZyBpZD0iTGF5ZXJfeDAwMjBfMSI+Cgk8ZyBpZD0iXzI4MDYwNTAxMzY4OTYiPgoJCTxjaXJjbGUgY2xhc3M9InN0MCIgY3g9IjEyNDkiIGN5PSIxMjQ5IiByPSIxMjQ3Ij48L2NpcmNsZT4KCQk8cGF0aCBjbGFzcz0ic3QxIiBkPSJNNzY0LDkzMGMyNjctMjYxLDcwMS0yNjEsOTY5LDBsMzIsMzFjMTMsMTMsMTMsMzQsMCw0N2wtMTEwLDEwN2MtNyw3LTE4LDctMjQsMGwtNDQtNDMgICAgYy0xODctMTgyLTQ4OS0xODItNjc2LDBsLTQ3LDQ2Yy03LDctMTgsNy0yNCwwbC0xMTAtMTA3Yy0xMy0xMy0xMy0zNCwwLTQ3bDM1LTM0SDc2NHogTTE5NjAsMTE1Mmw5OCw5NmMxMywxMywxMywzNCwwLDQ3ICAgIGwtNDQyLDQzMWMtMTMsMTMtMzUsMTMtNDgsMGwtMzE0LTMwNmMtMy0zLTktMy0xMiwwbC0zMTQsMzA2Yy0xMywxMy0zNSwxMy00OCwwbC00NDItNDMxYy0xMy0xMy0xMy0zNCwwLTQ3bDk4LTk2ICAgIGMxMy0xMywzNS0xMyw0OCwwbDMxNCwzMDZjMywzLDksMywxMiwwbDMxNC0zMDZjMTMtMTMsMzUtMTMsNDgsMGwzMTQsMzA2YzMsMyw5LDMsMTIsMGwzMTQtMzA2QzE5MjUsMTEzOSwxOTQ3LDExMzksMTk2MCwxMTUyICAgIEwxOTYwLDExNTJ6Ij48L3BhdGg+Cgk8L2c+CjwvZz4KPC9zdmc+Cg==';
  readonly url = 'https://walletconnect.com';

  private client: SignClient | null = null;
  private session: SessionTypes.Struct | null = null;
  private currentAccount: AccountInfo | null = null;
  private options: WalletConnectAdapterOptions;
  private initializationPromise: Promise<SignClient> | null = null;
  private pendingConnection: { uri: string; approval: () => Promise<SessionTypes.Struct> } | null = null;

  constructor(options: WalletConnectAdapterOptions = {}) {
    this.options = options;
  }

  /**
   * WalletConnect is always available (uses QR code)
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Pre-initialize WalletConnect by starting a connection session early
   * This generates the QR code URI before the user clicks WalletConnect
   * Based on ConnectKit's eager initialization pattern
   */
  async preInitialize(projectId?: string, network?: string): Promise<void> {
    const pid = projectId || this.options.projectId;

    if (!pid) {
      console.warn('[WalletConnect] Cannot pre-initialize without project ID');
      return;
    }

    // If already has pending connection, skip
    if (this.pendingConnection) {
      console.log('[WalletConnect] Already has pending connection, skipping pre-init');
      return;
    }

    console.log('[WalletConnect] Pre-initializing connection session...');

    try {
      // Initialize SignClient if not already done
      if (!this.client) {
        if (!this.initializationPromise) {
          this.initializationPromise = SignClient.init({
            projectId: pid,
            metadata: this.options.metadata || {
              name: 'XRPL Connect',
              description: 'XRPL Wallet Connection',
              url: typeof window !== 'undefined' ? window.location.origin : 'https://xrpl.org',
              icons: ['https://xrpl.org/favicon.ico'],
            },
          });
        }
        this.client = await this.initializationPromise;
        console.log('[WalletConnect] SignClient initialized');
      }

      // Determine network for pre-initialization
      const networkInfo = this.resolveNetwork(network);

      // Start connection to generate URI (ConnectKit pattern)
      const requiredNamespaces = {
        xrpl: {
          chains: [networkInfo.walletConnectId || `xrpl:${networkInfo.id}`],
          methods: [
            XRPLMethod.SIGN_TRANSACTION,
            XRPLMethod.SIGN_TRANSACTION_FOR,
            'xrpl_signMessage',
          ],
          events: ['chainChanged', 'accountsChanged'],
        },
      };

      const { uri, approval } = await this.client.connect({
        requiredNamespaces,
      });

      if (!uri) {
        throw new Error('Failed to generate WalletConnect URI during pre-initialization');
      }

      // Store the pending connection
      this.pendingConnection = { uri, approval };

      console.log('[WalletConnect] QR code URI pre-generated:', uri.substring(0, 50) + '...');

      // Call the onQRCode callback if provided
      if (this.options.onQRCode) {
        console.log('[WalletConnect] Calling onQRCode callback during pre-init');
        this.options.onQRCode(uri);
      }
    } catch (error) {
      console.error('[WalletConnect] Pre-initialization failed:', error);
      this.initializationPromise = null;
      this.pendingConnection = null;
    }
  }

  /**
   * Connect to WalletConnect
   */
  async connect(options?: ConnectOptions): Promise<AccountInfo> {
    const projectId = options?.projectId || this.options.projectId;

    if (!projectId) {
      throw createWalletError.connectionFailed(
        this.name,
        new Error(
          'WalletConnect project ID is required. Get one from https://cloud.walletconnect.com or https://dashboard.reown.com'
        )
      );
    }

    // Merge runtime options with constructor options (runtime takes precedence)
    const onQRCode = (options as any)?.onQRCode || this.options.onQRCode;
    // const onDeepLink = (options as any)?.onDeepLink || this.options.onDeepLink;

    try {
      // Determine network
      const network = this.resolveNetwork(options?.network);

      let uri: string;
      let approval: () => Promise<SessionTypes.Struct>;

      // Check if we have a pending connection from pre-initialization (ConnectKit pattern)
      if (this.pendingConnection) {
        console.log('[WalletConnect] Using pre-generated connection');
        uri = this.pendingConnection.uri;
        approval = this.pendingConnection.approval;

        // Call QR code callback if provided (in case it wasn't called during pre-init)
        if (onQRCode) {
          console.log('[WalletConnect] Calling onQRCode callback with pre-generated URI');
          onQRCode(uri);
        }
      } else {
        // No pre-initialized connection, do it now
        console.log('[WalletConnect] No pre-generated connection, creating now');

        // Initialize SignClient if needed
        if (!this.client) {
          if (this.initializationPromise) {
            console.log('[WalletConnect] Using pre-initialized SignClient');
            this.client = await this.initializationPromise;
          } else {
            console.log('[WalletConnect] Initializing SignClient');
            this.client = await SignClient.init({
              projectId,
              metadata: this.options.metadata || {
                name: 'XRPL Connect',
                description: 'XRPL Wallet Connection',
                url: typeof window !== 'undefined' ? window.location.origin : 'https://xrpl.org',
                icons: ['https://xrpl.org/favicon.ico'],
              },
            });
          }
        }

        // Prepare namespace for XRPL
        const requiredNamespaces = {
          xrpl: {
            chains: [network.walletConnectId || `xrpl:${network.id}`],
            methods: [
              XRPLMethod.SIGN_TRANSACTION,
              XRPLMethod.SIGN_TRANSACTION_FOR,
              'xrpl_signMessage',
            ],
            events: ['chainChanged', 'accountsChanged'],
          },
        };

        // Connect and get URI
        const result = await this.client.connect({
          requiredNamespaces,
        });

        if (!result.uri) {
          throw new Error('Failed to generate WalletConnect URI');
        }

        uri = result.uri;
        approval = result.approval;

        console.log('[WalletConnect] Generated URI:', uri.substring(0, 50) + '...');
        console.log('[WalletConnect] onQRCode callback exists:', !!onQRCode);

        // Call QR code callback if provided (for custom UI)
        if (onQRCode) {
          console.log('[WalletConnect] Calling onQRCode callback');
          onQRCode(uri);
        }
      }

      // Wait for approval
      this.session = await approval();

      // Extract account info from session
      const accounts = this.session.namespaces.xrpl?.accounts || [];
      if (accounts.length === 0) {
        throw new Error('No accounts returned from WalletConnect session');
      }

      // Parse account (format: "xrpl:chainId:rAddress")
      const accountString = accounts[0];
      const address = accountString.split(':')[2];

      this.currentAccount = {
        address,
        network,
      };

      // Set up session event listeners
      this.setupEventListeners();

      return this.currentAccount;
    } catch (error) {
      throw createWalletError.connectionFailed(this.name, error as Error);
    }
  }

  /**
   * Disconnect from WalletConnect
   */
  async disconnect(): Promise<void> {
    if (!this.client || !this.session) {
      return;
    }

    try {
      await this.client.disconnect({
        topic: this.session.topic,
        reason: {
          code: 6000,
          message: 'User disconnected',
        },
      });
      this.cleanup();
    } catch (error) {
      // Disconnect might fail if already disconnected, that's okay
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
   * Sign and optionally submit a transaction using xrpl_signTransaction method
   * @param transaction - The transaction to sign
   * @param submit - Whether to submit to the ledger (default: true)
   */
  async signAndSubmit(
    transaction: Transaction,
    submit: boolean = true
  ): Promise<SubmittedTransaction> {
    if (!this.client || !this.session || !this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      // Ensure Account field is set
      const tx = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      };

      // Request signature/submission via WalletConnect using XRPL RPC format
      const result = await this.client.request({
        topic: this.session.topic,
        chainId:
          this.currentAccount.network.walletConnectId || `xrpl:${this.currentAccount.network.id}`,
        request: {
          method: XRPLMethod.SIGN_TRANSACTION,
          params: {
            tx_json: tx,
            autofill: true,
            submit, // Controls whether to submit to ledger
          },
        },
      });

      // Result contains tx_json with the transaction
      const resultTx = (result as any).tx_json;

      return {
        hash: resultTx.hash || '',
        tx_blob: resultTx.TxnSignature,
      };
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('reject')) {
        throw createWalletError.signRejected();
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign a message - NOT SUPPORTED
   * WalletConnect does not currently support message signing for XRPL
   */
  async signMessage(_message: string | Uint8Array): Promise<SignedMessage> {
    throw createWalletError.unsupportedMethod(
      'Message signing is not supported via WalletConnect. Please use Xaman, Crossmark, or GemWallet for signing messages.'
    );
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
   * Setup event listeners for session
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    // Session delete event
    this.client.on('session_delete', () => {
      this.cleanup();
    });

    // Session expire event
    this.client.on('session_expire', () => {
      this.cleanup();
    });
  }

  /**
   * Cleanup adapter state
   */
  private cleanup(): void {
    this.client = null;
    this.session = null;
    this.currentAccount = null;
    this.initializationPromise = null;
    this.pendingConnection = null;
  }

  /**
   * Get deep link URI for mobile
   */
  public getDeepLinkURI(uri: string): string {
    if (this.options.onDeepLink) {
      return this.options.onDeepLink(uri);
    }
    // Default: construct WalletConnect deep link
    // Different wallets have different deep link schemes
    return uri;
  }
}
