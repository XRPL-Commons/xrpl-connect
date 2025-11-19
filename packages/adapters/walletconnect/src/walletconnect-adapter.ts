/**
 * WalletConnect Adapter for XRPL using WalletConnect Sign Client v2
 */

import SignClient from '@walletconnect/sign-client';
import { WalletConnectModal } from '@walletconnect/modal';
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
import { createWalletError, STANDARD_NETWORKS, createLogger } from '@xrpl-connect/core';
import {
  DISCONNECT_REASONS,
  DEFAULT_METADATA,
  LOGGING,
  ACCOUNT_FORMAT,
  XRPL_NAMESPACE,
} from './constants';

/**
 * Utility function to detect if user is on mobile device
 */
function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Logger instance for WalletConnect adapter
 */
const logger = createLogger('[WalletConnect]');

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

  // Modal options
  useModal?: boolean; // Enable WalletConnect modal instead of custom QR (default: false)
  modalMode?: 'mobile-only' | 'always' | 'never'; // When to show modal (default: 'mobile-only')
  themeMode?: 'dark' | 'light'; // Modal theme (default: 'dark')
}

export type WalletConnectConnectOptions = {
  projectId?: string;
  onQRCode?: (uri: string) => void;
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
  private modal: WalletConnectModal | null = null;

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
   * Initialize WalletConnect modal
   * This provides the official WalletConnect UI with 300+ wallets and automatic deeplinks
   */
  private async initializeModal(projectId: string): Promise<void> {
    if (this.modal) {
      return; // Already initialized
    }

    logger.debug('Initializing WalletConnect modal...');

    try {
      this.modal = new WalletConnectModal({
        projectId,
        // Configure which chains to show (XRPL)
        chains: ['xrpl:0', 'xrpl:1'], // mainnet, testnet

        // Theme configuration
        themeMode: this.options.themeMode || 'dark',
        themeVariables: {
          // Maximum z-index to ensure WalletConnect modal appears on top of custom modal
          // Custom modal uses z-index: 9999, WC modal uses max possible value
          '--wcm-z-index': '2147483647',
        },

        // Enable wallet explorer with 300+ wallets
        enableExplorer: true,

        // Optionally promote specific wallets (if XRPL wallets are in WC registry)
        explorerRecommendedWalletIds: undefined,
      });

      logger.debug('WalletConnect modal initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WalletConnect modal:', error);
      throw error;
    }
  }

  /**
   * Pre-initialize WalletConnect by starting a connection session early
   * This generates the QR code URI before the user clicks WalletConnect
   * Based on ConnectKit's eager initialization pattern
   */
  async preInitialize(projectId?: string, network?: string): Promise<void> {
    const pid = projectId || this.options.projectId;

    if (!pid) {
      logger.warn('Cannot pre-initialize without project ID');
      return;
    }

    if (this.pendingConnection) {
      logger.debug('Already has pending connection, skipping pre-init');
      return;
    }

    logger.debug('Pre-initializing connection session...');

    try {
      // Initialize SignClient if not already done
      if (!this.client) {
        if (!this.initializationPromise) {
          this.initializationPromise = SignClient.init({
            projectId: pid,
            metadata: this.options.metadata || {
              name: DEFAULT_METADATA.NAME,
              description: DEFAULT_METADATA.DESCRIPTION,
              url: typeof window !== 'undefined' ? window.location.origin : DEFAULT_METADATA.DEFAULT_URL,
              icons: [DEFAULT_METADATA.DEFAULT_ICON],
            },
          });
        }
        this.client = await this.initializationPromise;
        logger.debug('SignClient initialized');
      }

      // Determine network for pre-initialization
      const networkInfo = this.resolveNetwork(network);

      // Start connection to generate URI (ConnectKit pattern)
      const requiredNamespaces = {
        [XRPL_NAMESPACE.KEY]: {
          chains: [networkInfo.walletConnectId || `xrpl:${networkInfo.id}`],
          methods: [
            XRPLMethod.SIGN_TRANSACTION,
            XRPLMethod.SIGN_TRANSACTION_FOR,
            'xrpl_signMessage',
          ],
          events: XRPL_NAMESPACE.EVENTS,
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

      logger.debug('QR code URI pre-generated:', uri.substring(0, LOGGING.URI_PREVIEW_LENGTH) + '...');

      if (this.options.onQRCode) {
        logger.debug('Calling onQRCode callback during pre-init');
        this.options.onQRCode(uri);
      }
    } catch (error) {
      logger.error('Pre-initialization failed:', error);
      this.initializationPromise = null;
      this.pendingConnection = null;
    }
  }

  /**
   * Connect to WalletConnect
   */
  async connect(options?: ConnectOptions<WalletConnectConnectOptions>): Promise<AccountInfo> {
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
    const onQRCode = options?.onQRCode || this.options.onQRCode;
    const useModal = this.options.useModal ?? false;
    const modalMode = this.options.modalMode ?? 'mobile-only';

    // Determine if we should use modal
    const shouldUseModal =
      useModal && (modalMode === 'always' || (modalMode === 'mobile-only' && isMobile()));

    try {
      // Determine network
      const network = this.resolveNetwork(options?.network);

      // Initialize SignClient if needed
      if (!this.client) {
        if (this.initializationPromise) {
          logger.debug('Using pre-initialized SignClient');
          this.client = await this.initializationPromise;
        } else {
          logger.debug('Initializing SignClient');
          this.client = await SignClient.init({
            projectId,
            metadata: this.options.metadata || {
              name: DEFAULT_METADATA.NAME,
              description: DEFAULT_METADATA.DESCRIPTION,
              url: typeof window !== 'undefined' ? window.location.origin : DEFAULT_METADATA.DEFAULT_URL,
              icons: [DEFAULT_METADATA.DEFAULT_ICON],
            },
          });
        }
      }

      // Prepare namespace for XRPL
      const requiredNamespaces = {
        [XRPL_NAMESPACE.KEY]: {
          chains: [network.walletConnectId || `xrpl:${network.id}`],
          methods: [
            XRPLMethod.SIGN_TRANSACTION,
            XRPLMethod.SIGN_TRANSACTION_FOR,
            'xrpl_signMessage',
          ],
          events: XRPL_NAMESPACE.EVENTS,
        },
      };

      let session: SessionTypes.Struct;

      if (shouldUseModal) {
        // ===== MODAL FLOW (Mobile deeplinks) =====
        logger.debug('Using WalletConnect modal for connection (mobile deeplink mode)');

        // Initialize modal
        await this.initializeModal(projectId);

        // Connect and get URI
        const { uri, approval } = await this.client.connect({
          requiredNamespaces,
        });

        if (uri && this.modal) {
          // Open modal with the URI - modal handles deeplinks automatically
          this.modal.openModal({ uri });
          logger.debug('WalletConnect modal opened with URI');
        }

        // Wait for user to connect via modal
        session = await approval();

        // Close modal after successful connection
        if (this.modal) {
          this.modal.closeModal();
          logger.debug('WalletConnect modal closed');
        }
      } else {
        // ===== CUSTOM QR FLOW (Desktop or opt-out) =====
        logger.debug('Using custom QR code for connection (desktop mode)');

        let uri: string;
        let approval: () => Promise<SessionTypes.Struct>;

        // Check if we have a pending connection from pre-initialization
        if (this.pendingConnection) {
          logger.debug('Using pre-generated connection');
          uri = this.pendingConnection.uri;
          approval = this.pendingConnection.approval;

          if (onQRCode) {
            logger.debug('Calling onQRCode callback with pre-generated URI');
            onQRCode(uri);
          }
        } else {
          logger.debug('No pre-generated connection, creating now');

          // Connect and get URI
          const result = await this.client.connect({
            requiredNamespaces,
          });

          if (!result.uri) {
            throw new Error('Failed to generate WalletConnect URI');
          }

          uri = result.uri;
          approval = result.approval;

          logger.debug('Generated URI:', uri.substring(0, LOGGING.URI_PREVIEW_LENGTH) + '...');

          if (onQRCode) {
            logger.debug('Calling onQRCode callback');
            onQRCode(uri);
          }
        }

        // Wait for approval
        session = await approval();
      }

      // Store session
      this.session = session;

      // Extract account info from session
      const accounts = this.session.namespaces.xrpl?.accounts || [];
      if (accounts.length === 0) {
        throw new Error('No accounts returned from WalletConnect session');
      }

      // Parse account (format: "xrpl:chainId:rAddress")
      const accountString = accounts[0];
      const address = accountString.split(':')[ACCOUNT_FORMAT.ADDRESS_INDEX];

      this.currentAccount = {
        address,
        network,
      };

      // Set up session event listeners
      this.setupEventListeners();

      return this.currentAccount;
    } catch (error) {
      // Close modal on error
      if (this.modal) {
        this.modal.closeModal();
      }
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
        reason: DISCONNECT_REASONS.USER_DISCONNECTED,
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
      const tx: Transaction = {
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
    // Close and cleanup modal
    if (this.modal) {
      this.modal.closeModal();
      this.modal = null;
    }

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
