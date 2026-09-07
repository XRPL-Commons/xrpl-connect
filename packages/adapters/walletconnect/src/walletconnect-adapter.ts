/**
 * WalletConnect Adapter for XRPL using WalletConnect Sign Client v2
 */

import SignClient from '@walletconnect/sign-client';
import { WalletConnectModal } from '@walletconnect/modal';
import type { SignClientTypes, SessionTypes } from '@walletconnect/types';
import { getSdkError, parseUri } from '@walletconnect/utils';
import { isValidClassicAddress } from 'xrpl';
import type {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkConfig,
  NetworkInfo,
  Transaction,
  SignedTransaction,
  SignedMessage,
  SubmittedTransaction,
  SupportsDeepLink,
  SupportsPreInitialize,
  WalletCapabilities,
  WalletConnectionOptionsById,
  WalletAdapterEvent,
} from '@xrpl-connect/core';
import {
  createWalletError,
  resolveNetwork,
  createLogger,
  getErrorMessage,
  isMobile,
  isStandardNetworkId,
  isWalletError,
  STANDARD_NETWORKS,
  WalletErrorCode,
} from '@xrpl-connect/core';
import iconSvg from './assets/icon.svg';
import { DISCONNECT_REASONS, DEFAULT_METADATA, LOGGING, XRPL_NAMESPACE } from './constants';

const ICON_DATA_URL = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;
const MAX_XRPL_NETWORK_ID = 0xffff_ffff;

/**
 * Logger instance for WalletConnect adapter
 */
const logger = createLogger('[WalletConnect]');

const REOWN_REJECTION_CODES = new Set([
  getSdkError('USER_REJECTED').code,
  getSdkError('USER_REJECTED_CHAINS').code,
  getSdkError('USER_REJECTED_METHODS').code,
  getSdkError('USER_REJECTED_EVENTS').code,
]);

function isUserRejection(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'number' && REOWN_REJECTION_CODES.has(code)) return true;
  }

  return (
    error instanceof Error &&
    (error.message.toLowerCase().includes('reject') ||
      error.message.toLowerCase().includes('cancel'))
  );
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;

  const structuredMessage =
    error &&
    typeof error === 'object' &&
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : undefined;
  const normalized = new Error(structuredMessage ?? getErrorMessage(error));
  (normalized as Error & { cause?: unknown }).cause = error;
  return normalized;
}

/**
 * XRPL methods supported by WalletConnect
 */
export enum XRPLMethod {
  SIGN_TRANSACTION = 'xrpl_signTransaction',
  SIGN_TRANSACTION_FOR = 'xrpl_signTransactionFor', // Multi-sig
}

/**
 * Signed transaction JSON returned by a wallet in response to an
 * `xrpl_signTransaction` request. WalletConnect includes the transaction hash
 * alongside the standard XRPL transaction fields.
 */
type WalletConnectSignedTxJson = Transaction & { hash?: string };

type ConnectionProposal = {
  uri?: string;
  approval: () => Promise<SessionTypes.Struct>;
  approvalPromise?: Promise<SessionTypes.Struct>;
  cancellationPromise: Promise<void>;
  cancel: () => void;
  chainId: string;
  projectId: string;
  client: SignClient;
};

type PendingConnection = ConnectionProposal & { uri: string };

type SessionLifecycleEvent = { topic: string };
type SessionEvent = SignClientTypes.EventArguments['session_event'];
type SessionUpdateEvent = SignClientTypes.EventArguments['session_update'];
type AdapterEventListener = (data?: unknown) => void;

function isValidXrplChainId(chainId: string): boolean {
  const match = chainId.match(/^xrpl:(0|[1-9]\d*)$/);
  if (!match) return false;

  const networkId = Number(match[1]);
  return Number.isSafeInteger(networkId) && networkId <= MAX_XRPL_NETWORK_ID;
}

function getXrplChainId(network: NetworkInfo): string {
  const chainId = network.walletConnectId;
  if (chainId === undefined) {
    throw createWalletError.networkNotSupported(network.id, 'WalletConnect');
  }
  if (!isValidXrplChainId(chainId)) {
    throw createWalletError.networkNotSupported(chainId, 'WalletConnect');
  }
  if (
    isStandardNetworkId(network.id) &&
    chainId !== STANDARD_NETWORKS[network.id].walletConnectId
  ) {
    throw createWalletError.networkNotSupported(chainId, 'WalletConnect');
  }
  return chainId;
}

function getApprovedXrplChainIds(session: SessionTypes.Struct): string[] {
  const chains = session.namespaces[XRPL_NAMESPACE.KEY]?.chains;
  if (chains === undefined) return [];
  if (
    !Array.isArray(chains) ||
    !chains.every((chain): chain is string => typeof chain === 'string')
  ) {
    throw new Error('WalletConnect returned malformed XRPL session chain references');
  }
  if (!chains.every(isValidXrplChainId)) {
    throw new Error('WalletConnect returned invalid XRPL session chain references');
  }
  return [...new Set(chains)];
}

function selectAccountForChain(
  accounts: string[],
  requestedChainId: string,
  approvedChainIds: string[] = []
): string {
  if (accounts.length === 0) {
    const approvedChainId = approvedChainIds[0];
    if (approvedChainId && approvedChainId !== requestedChainId) {
      throw createWalletError.networkMismatch(requestedChainId, approvedChainId);
    }
    throw new Error('No accounts returned from WalletConnect session');
  }

  const parsedAccounts = accounts.map((account) => {
    const parts = account.split(':');
    if (
      parts.length !== 3 ||
      parts[0] !== XRPL_NAMESPACE.KEY ||
      parts[1].length === 0 ||
      parts[2].length === 0
    ) {
      throw new Error('WalletConnect returned a malformed XRPL CAIP-10 account');
    }

    const chainId = `${parts[0]}:${parts[1]}`;
    if (!isValidXrplChainId(chainId)) {
      throw new Error('WalletConnect returned an invalid XRPL CAIP-10 chain reference');
    }

    const address = parts[2];
    if (!isValidClassicAddress(address)) {
      throw new Error('WalletConnect returned an invalid XRPL classic address');
    }

    return {
      chainId,
      address,
    };
  });

  if (approvedChainIds.length > 0 && !approvedChainIds.includes(requestedChainId)) {
    throw createWalletError.networkMismatch(requestedChainId, approvedChainIds[0]);
  }

  const matchingAccount = parsedAccounts.find((account) => account.chainId === requestedChainId);
  if (!matchingAccount) {
    const actualChainId =
      parsedAccounts.find((account) => account.chainId !== requestedChainId)?.chainId ||
      approvedChainIds.find((chainId) => chainId !== requestedChainId);
    if (actualChainId) {
      throw createWalletError.networkMismatch(requestedChainId, actualChainId);
    }
    throw new Error(`WalletConnect did not return an account for ${requestedChainId}`);
  }

  return matchingAccount.address;
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

export type WalletConnectConnectOptions = WalletConnectionOptionsById['walletconnect'];

/**
 * WalletConnect adapter implementation using Sign Client v2
 */
export class WalletConnectAdapter
  implements WalletAdapter, SupportsPreInitialize, SupportsDeepLink
{
  readonly id = 'walletconnect';
  readonly name = 'WalletConnect';
  readonly icon = ICON_DATA_URL;
  readonly url = 'https://walletconnect.com';
  // The XRPL WalletConnect namespace exposes no message-signing method, so
  // signMessage() throws UNSUPPORTED_METHOD — advertise it as unsupported.
  readonly capabilities: WalletCapabilities = { signMessage: false };

  private client: SignClient | null = null;
  private session: SessionTypes.Struct | null = null;
  private currentAccount: AccountInfo | null = null;
  private options: WalletConnectAdapterOptions;
  private initializationPromise: Promise<SignClient> | null = null;
  private initializationProjectId: string | null = null;
  private clientProjectId: string | null = null;
  private connectionAttemptGeneration = 0;
  private pendingConnection: PendingConnection | null = null;
  private activeConnectionProposals = new Map<number, ConnectionProposal>();
  private closedConnectionProposals = new WeakSet<ConnectionProposal>();
  private modal: WalletConnectModal | null = null;
  private eventListenerClient: SignClient | null = null;
  private sessionDeleteHandler: ((event: SessionLifecycleEvent) => void) | null = null;
  private sessionExpireHandler: ((event: SessionLifecycleEvent) => void) | null = null;
  private sessionEventHandler: ((event: SessionEvent) => void) | null = null;
  private sessionUpdateHandler: ((event: SessionUpdateEvent) => void) | null = null;
  private listeners = new Map<WalletAdapterEvent, Set<AdapterEventListener>>();

  constructor(options: WalletConnectAdapterOptions = {}) {
    this.options = { ...options };
  }

  private composeQRCodeCallbacks(
    runtimeCallback?: (uri: string) => void
  ): ((uri: string) => void) | undefined {
    const configuredCallback = this.options.onQRCode;
    if (!configuredCallback) return runtimeCallback;
    if (!runtimeCallback || runtimeCallback === configuredCallback) return configuredCallback;

    return (uri: string) => {
      try {
        configuredCallback(uri);
      } catch (error) {
        logger.warn('Configured onQRCode callback failed:', error);
      }
      runtimeCallback(uri);
    };
  }

  getMissingConfiguration(
    options?: ConnectOptions<WalletConnectConnectOptions>
  ): readonly string[] {
    return options?.projectId || this.options.projectId ? [] : ['projectId'];
  }

  private async getOrInitializeClient(projectId: string): Promise<SignClient> {
    if (this.client) {
      if (this.clientProjectId !== projectId) {
        throw new Error('Cannot change WalletConnect project ID after initialization');
      }
      return this.client;
    }

    let initialization = this.initializationPromise;
    if (initialization && this.initializationProjectId !== projectId) {
      throw new Error('Cannot change WalletConnect project ID while initialization is pending');
    }
    if (!initialization) {
      initialization = SignClient.init({
        projectId,
        metadata: this.options.metadata || {
          name: DEFAULT_METADATA.NAME,
          description: DEFAULT_METADATA.DESCRIPTION,
          url:
            typeof window !== 'undefined' ? window.location.origin : DEFAULT_METADATA.DEFAULT_URL,
          icons: [DEFAULT_METADATA.DEFAULT_ICON],
        },
      });
      this.initializationPromise = initialization;
      this.initializationProjectId = projectId;
    }

    try {
      const client = await initialization;
      if (this.initializationPromise === initialization) {
        this.client = client;
        this.clientProjectId = projectId;
      }
      return client;
    } catch (error) {
      if (this.initializationPromise === initialization) {
        this.initializationPromise = null;
        this.initializationProjectId = null;
      }
      throw error;
    }
  }

  private async closeConnectionProposal(proposal: ConnectionProposal): Promise<void> {
    if (this.closedConnectionProposals.has(proposal)) {
      return;
    }
    this.closedConnectionProposals.add(proposal);
    proposal.cancel();

    void this.approveConnectionProposal(proposal)
      .then((session) =>
        proposal.client.disconnect({
          topic: session.topic,
          reason: DISCONNECT_REASONS.USER_DISCONNECTED,
        })
      )
      .catch((error) => {
        logger.debug('Unused WalletConnect proposal ended:', error);
      });

    if (proposal.uri) {
      try {
        await proposal.client.core.pairing.disconnect({ topic: parseUri(proposal.uri).topic });
      } catch (error) {
        logger.warn('Failed to close unused WalletConnect proposal:', error);
      }
    }
  }

  private approveConnectionProposal(proposal: ConnectionProposal): Promise<SessionTypes.Struct> {
    proposal.approvalPromise ??= Promise.resolve().then(() => proposal.approval());
    return proposal.approvalPromise;
  }

  private waitForConnectionProposal(proposal: ConnectionProposal): Promise<SessionTypes.Struct> {
    return Promise.race([
      this.approveConnectionProposal(proposal),
      proposal.cancellationPromise.then(() => {
        throw new Error('WalletConnect connection was cancelled');
      }),
    ]);
  }

  private createConnectionProposal(
    client: SignClient,
    chainId: string,
    projectId: string,
    result: { uri?: string; approval: () => Promise<SessionTypes.Struct> }
  ): ConnectionProposal {
    let cancel!: () => void;
    const cancellationPromise = new Promise<void>((resolve) => {
      cancel = resolve;
    });
    return { ...result, cancellationPromise, cancel, chainId, projectId, client };
  }

  private async closeActiveConnectionProposals(): Promise<void> {
    const proposals = [...this.activeConnectionProposals.values()];
    this.activeConnectionProposals.clear();
    await Promise.all(proposals.map((proposal) => this.closeConnectionProposal(proposal)));
  }

  private releaseActiveConnectionProposal(
    connectionAttempt: number,
    proposal: ConnectionProposal
  ): void {
    if (this.activeConnectionProposals.get(connectionAttempt) === proposal) {
      this.activeConnectionProposals.delete(connectionAttempt);
    }
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
  async preInitialize(network?: NetworkConfig, onQRCode?: (uri: string) => void): Promise<void> {
    const pid = this.options.projectId;
    let proposal: ConnectionProposal | null = null;

    if (!pid) {
      logger.warn('Cannot pre-initialize without project ID');
      return;
    }

    const notifyQRCode = this.composeQRCodeCallbacks(onQRCode);

    try {
      const networkInfo = this.resolveRequestedNetwork(network);
      const requestedChainId = getXrplChainId(networkInfo);
      const existingPending = this.pendingConnection;

      if (existingPending?.chainId === requestedChainId && existingPending.projectId === pid) {
        logger.debug('Already has matching pending connection, skipping pre-init');
        return;
      }

      const preInitializationAttempt = ++this.connectionAttemptGeneration;
      logger.debug('Pre-initializing connection session...');

      if (this.activeConnectionProposals.size > 0) {
        await this.closeActiveConnectionProposals();
      }

      if (existingPending && this.pendingConnection === existingPending) {
        this.pendingConnection = null;
        await this.closeConnectionProposal(existingPending);
      }

      if (preInitializationAttempt !== this.connectionAttemptGeneration) {
        return;
      }

      const client = await this.getOrInitializeClient(pid);
      logger.debug('SignClient initialized');

      if (preInitializationAttempt !== this.connectionAttemptGeneration) {
        return;
      }

      // Start connection to generate URI (ConnectKit pattern)
      const requiredNamespaces = {
        [XRPL_NAMESPACE.KEY]: {
          chains: [requestedChainId],
          methods: [XRPLMethod.SIGN_TRANSACTION, XRPLMethod.SIGN_TRANSACTION_FOR],
          events: XRPL_NAMESPACE.EVENTS,
        },
      };

      const result = await client.connect({
        requiredNamespaces,
      });
      proposal = this.createConnectionProposal(client, requestedChainId, pid, result);

      if (!proposal.uri) {
        throw new Error('Failed to generate WalletConnect URI during pre-initialization');
      }

      if (preInitializationAttempt !== this.connectionAttemptGeneration) {
        await this.closeConnectionProposal(proposal);
        proposal = null;
        return;
      }

      // Store the pending connection
      this.pendingConnection = proposal as PendingConnection;

      logger.debug(
        'QR code URI pre-generated:',
        proposal.uri.substring(0, LOGGING.URI_PREVIEW_LENGTH) + '...'
      );

      if (notifyQRCode) {
        logger.debug('Calling onQRCode callback during pre-init');
        notifyQRCode(proposal.uri);
      }
    } catch (error) {
      if (proposal) {
        if (this.pendingConnection === proposal) {
          this.pendingConnection = null;
        }
        await this.closeConnectionProposal(proposal);
      }
      logger.error('Pre-initialization failed:', error);
    }
  }

  /**
   * Connect to WalletConnect
   */
  async connect(options?: ConnectOptions<WalletConnectConnectOptions>): Promise<AccountInfo> {
    const projectId = options?.projectId || this.options.projectId;

    if (!projectId) {
      throw createWalletError.configurationRequired(this.name, ['projectId']);
    }

    if (this.client && this.clientProjectId !== projectId) {
      const pending = this.pendingConnection;
      this.pendingConnection = null;
      if (pending) {
        await this.closeConnectionProposal(pending);
      }
      throw createWalletError.connectionFailed(
        this.name,
        new Error('Cannot change WalletConnect project ID after initialization')
      );
    }

    let network: NetworkInfo;
    let requestedChainId: string;
    try {
      network = this.resolveRequestedNetwork(options?.network);
      requestedChainId = getXrplChainId(network);
    } catch (error) {
      if (isWalletError(error)) throw error;
      throw createWalletError.connectionFailed(this.name, error as Error);
    }

    const connectionAttempt = ++this.connectionAttemptGeneration;
    const replacedClient = this.client;
    const replacedSession = this.session;
    let proposal: ConnectionProposal | null = null;

    // A direct connect() while already connected is a replacement. Detach the
    // old handlers synchronously so a late lifecycle event cannot clear the
    // client while the new approval is pending.
    if (replacedClient && replacedSession) {
      this.removeEventListeners();
      this.session = null;
      this.currentAccount = null;
    }

    // Merge runtime options with constructor options (runtime takes precedence)
    const onQRCode = this.composeQRCodeCallbacks(options?.onQRCode);
    const useModal = this.options.useModal ?? false;
    const modalMode = this.options.modalMode ?? 'mobile-only';

    // Determine if we should use modal
    const shouldUseModal =
      useModal && (modalMode === 'always' || (modalMode === 'mobile-only' && isMobile()));

    try {
      if (this.activeConnectionProposals.size > 0) {
        await this.closeActiveConnectionProposals();
      }
      if (replacedClient && replacedSession) {
        await this.disconnectSession(
          replacedClient,
          replacedSession,
          'Failed to disconnect replaced WalletConnect session:'
        );
      }
      if (connectionAttempt !== this.connectionAttemptGeneration) {
        throw new Error('WalletConnect connection was cancelled');
      }

      const client = await this.getOrInitializeClient(projectId);
      if (connectionAttempt !== this.connectionAttemptGeneration) {
        throw new Error('WalletConnect connection was cancelled');
      }

      // Prepare namespace for XRPL
      const requiredNamespaces = {
        [XRPL_NAMESPACE.KEY]: {
          chains: [requestedChainId],
          methods: [XRPLMethod.SIGN_TRANSACTION, XRPLMethod.SIGN_TRANSACTION_FOR],
          events: XRPL_NAMESPACE.EVENTS,
        },
      };

      let session: SessionTypes.Struct;

      if (shouldUseModal) {
        const pending = this.pendingConnection;
        this.pendingConnection = null;
        if (pending) {
          await this.closeConnectionProposal(pending);
        }

        // ===== MODAL FLOW (Mobile deeplinks) =====
        logger.debug('Using WalletConnect modal for connection (mobile deeplink mode)');

        // Initialize modal
        await this.initializeModal(projectId);

        // Connect and get URI
        const result = await client.connect({
          requiredNamespaces,
        });
        proposal = this.createConnectionProposal(client, requestedChainId, projectId, result);

        if (connectionAttempt !== this.connectionAttemptGeneration) {
          await this.closeConnectionProposal(proposal);
          proposal = null;
          throw new Error('WalletConnect connection was cancelled');
        }
        this.activeConnectionProposals.set(connectionAttempt, proposal);

        if (!proposal.uri) {
          throw new Error('Failed to generate WalletConnect URI');
        }

        if (this.modal) {
          // Open modal with the URI - modal handles deeplinks automatically
          this.modal.openModal({ uri: proposal.uri });
          logger.debug('WalletConnect modal opened with URI');
        }

        // Wait for user to connect via modal
        session = await this.waitForConnectionProposal(proposal);
        this.releaseActiveConnectionProposal(connectionAttempt, proposal);
        proposal = null;

        // Close modal after successful connection
        if (this.modal) {
          this.modal.closeModal();
          logger.debug('WalletConnect modal closed');
        }
      } else {
        // ===== CUSTOM QR FLOW (Desktop or opt-out) =====
        logger.debug('Using custom QR code for connection (desktop mode)');

        let uri: string;

        // Check if we have a pending connection from pre-initialization.
        // Consume it immediately so a retry after this connect() fails (or a
        // concurrent call) does not reuse the same approval promise.
        const pending = this.pendingConnection;
        this.pendingConnection = null;

        if (
          pending?.chainId === requestedChainId &&
          pending.projectId === projectId &&
          pending.client === client
        ) {
          logger.debug('Using pre-generated connection');
          uri = pending.uri;
          proposal = pending;
          this.activeConnectionProposals.set(connectionAttempt, proposal);

          if (onQRCode) {
            logger.debug('Calling onQRCode callback with pre-generated URI');
            onQRCode(uri);
          }
        } else {
          if (pending) {
            await this.closeConnectionProposal(pending);
          }
          logger.debug('No pre-generated connection, creating now');

          // Connect and get URI
          const result = await client.connect({
            requiredNamespaces,
          });
          proposal = this.createConnectionProposal(client, requestedChainId, projectId, result);

          if (connectionAttempt !== this.connectionAttemptGeneration) {
            await this.closeConnectionProposal(proposal);
            proposal = null;
            throw new Error('WalletConnect connection was cancelled');
          }
          this.activeConnectionProposals.set(connectionAttempt, proposal);

          if (!proposal.uri) {
            throw new Error('Failed to generate WalletConnect URI');
          }

          uri = proposal.uri;

          logger.debug('Generated URI:', uri.substring(0, LOGGING.URI_PREVIEW_LENGTH) + '...');

          if (onQRCode) {
            logger.debug('Calling onQRCode callback');
            onQRCode(uri);
          }
        }

        // Wait for approval
        session = await this.waitForConnectionProposal(proposal);
        this.releaseActiveConnectionProposal(connectionAttempt, proposal);
        proposal = null;
      }

      // Approval cannot be aborted by SignClient. If the UI cancelled this
      // attempt while approval was pending, immediately close the late session
      // instead of exposing it as an orphaned WalletConnect connection.
      if (connectionAttempt !== this.connectionAttemptGeneration) {
        await this.disconnectSession(
          client,
          session,
          'Failed to disconnect stale WalletConnect session:'
        );
        throw new Error('WalletConnect connection was cancelled');
      }

      let address: string;
      try {
        address = selectAccountForChain(
          session.namespaces.xrpl?.accounts || [],
          requestedChainId,
          getApprovedXrplChainIds(session)
        );
      } catch (error) {
        await this.closeApprovedSession(client, session, connectionAttempt);
        throw error;
      }

      // Commit approved session state only after its account and chain are valid.
      this.session = session;
      this.currentAccount = {
        address,
        network,
      };

      // Set up session event listeners
      this.setupEventListeners();

      return this.currentAccount;
    } catch (error) {
      if (proposal) {
        this.releaseActiveConnectionProposal(connectionAttempt, proposal);
        await this.closeConnectionProposal(proposal);
      }
      // A stale attempt must not close or clear resources owned by a newer one.
      if (connectionAttempt === this.connectionAttemptGeneration) {
        if (this.modal) {
          this.modal.closeModal();
        }
        const pending = this.pendingConnection;
        this.pendingConnection = null;
        if (pending) {
          await this.closeConnectionProposal(pending);
        }
      }
      if (isWalletError(error)) throw error;

      const originalError = normalizeError(error);
      if (isUserRejection(error)) {
        throw createWalletError.connectionRejected(this.name, originalError);
      }
      throw createWalletError.connectionFailed(this.name, originalError);
    }
  }

  /**
   * Disconnect from WalletConnect
   */
  async disconnect(): Promise<void> {
    const disconnectAttempt = ++this.connectionAttemptGeneration;
    const initialization = this.initializationPromise;
    const pending = this.pendingConnection;
    const client = this.client;
    const session = this.session;
    this.pendingConnection = null;

    if (initialization && this.initializationPromise === initialization) {
      this.initializationPromise = null;
      this.initializationProjectId = null;
    }

    if (this.modal) {
      this.modal.closeModal();
    }

    if (pending) {
      await this.closeConnectionProposal(pending);
    }
    await this.closeActiveConnectionProposals();

    if (disconnectAttempt !== this.connectionAttemptGeneration) {
      return;
    }

    if (!client || !session) {
      this.cleanup();
      return;
    }

    try {
      await client.disconnect({
        topic: session.topic,
        reason: DISCONNECT_REASONS.USER_DISCONNECTED,
      });
    } catch (error) {
      // Disconnect might fail if already disconnected, that's okay
    } finally {
      if (
        disconnectAttempt === this.connectionAttemptGeneration &&
        this.client === client &&
        this.session === session
      ) {
        this.cleanup();
      }
    }
  }

  /**
   * Disconnect an approved session without allowing relay cleanup failures to
   * replace the connection result that caused the cleanup.
   */
  private async disconnectSession(
    client: SignClient,
    session: SessionTypes.Struct,
    warning: string
  ): Promise<void> {
    try {
      await client.disconnect({
        topic: session.topic,
        reason: DISCONNECT_REASONS.USER_DISCONNECTED,
      });
    } catch (error) {
      logger.warn(warning, error);
    }
  }

  /**
   * Close a session that was approved but cannot be used by this connection
   * attempt. Cleanup must complete even if the remote disconnect already raced
   * with the wallet or relay.
   */
  private async closeApprovedSession(
    client: SignClient,
    session: SessionTypes.Struct,
    connectionAttempt: number
  ): Promise<void> {
    try {
      await this.disconnectSession(
        client,
        session,
        'Failed to disconnect unusable WalletConnect session:'
      );
    } finally {
      // Do not let an older failed approval clear a newer connection attempt.
      if (connectionAttempt === this.connectionAttemptGeneration) {
        this.cleanup();
      }
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

  on(event: WalletAdapterEvent, callback: AdapterEventListener): void {
    const listeners = this.listeners.get(event) ?? new Set<AdapterEventListener>();
    listeners.add(callback);
    this.listeners.set(event, listeners);
  }

  off(event: WalletAdapterEvent, callback: AdapterEventListener): void {
    const listeners = this.listeners.get(event);
    listeners?.delete(callback);
    if (listeners?.size === 0) this.listeners.delete(event);
  }

  /**
   * Send a WalletConnect sign transaction request
   */
  private async requestSignTransaction(
    transaction: Transaction,
    submit: boolean
  ): Promise<WalletConnectSignedTxJson> {
    if (!this.client || !this.session || !this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      this.assertSessionAuthorization(this.session, this.currentAccount);
    } catch (error) {
      this.failClosed(error);
      throw createWalletError.notConnected();
    }

    const tx = {
      ...transaction,
      Account: transaction.Account || this.currentAccount.address,
    };

    const result = await this.client.request<{ tx_json: WalletConnectSignedTxJson }>({
      topic: this.session.topic,
      chainId:
        this.currentAccount.network.walletConnectId || `xrpl:${this.currentAccount.network.id}`,
      request: {
        method: XRPLMethod.SIGN_TRANSACTION,
        params: {
          tx_json: tx,
          autofill: true,
          submit,
        },
      },
    });

    return result.tx_json;
  }

  /**
   * Sign a transaction without submitting it to the ledger
   *
   * The wallet returns a signed `tx_json` (with `SigningPubKey` / `TxnSignature`
   * populated), not a serialized `tx_blob`. We surface that full `tx_json` (and
   * the raw signature under `signature`, per the `SignedTransaction` contract)
   * rather than mislabeling `TxnSignature` as `tx_blob` — the latter is not a
   * valid signed transaction blob and cannot be submitted as one.
   *
   * @param transaction - The transaction to sign
   */
  async sign(transaction: Transaction): Promise<SignedTransaction> {
    try {
      const resultTx = await this.requestSignTransaction(transaction, false);

      return {
        hash: resultTx.hash || '',
        signature: resultTx.TxnSignature,
        tx_json: resultTx,
      };
    } catch (error) {
      if (isWalletError(error)) throw error;

      const originalError = normalizeError(error);
      if (isUserRejection(error)) throw createWalletError.signRejected(originalError);
      throw createWalletError.signFailed(originalError);
    }
  }

  /**
   * Sign and submit a transaction to the ledger
   * @param transaction - The transaction to sign and submit
   */
  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    try {
      const resultTx = await this.requestSignTransaction(transaction, true);

      return {
        hash: resultTx.hash || '',
        signature: resultTx.TxnSignature,
        tx_json: resultTx,
      };
    } catch (error) {
      if (isWalletError(error)) throw error;

      const originalError = normalizeError(error);
      if (isUserRejection(error)) throw createWalletError.signRejected(originalError);
      throw createWalletError.signFailed(originalError);
    }
  }

  /**
   * Sign a message - NOT SUPPORTED
   * WalletConnect does not currently support message signing for XRPL
   */
  async signMessage(_message: string | Uint8Array): Promise<SignedMessage> {
    throw createWalletError.unsupportedMethod(
      'Message signing is not supported via WalletConnect. Use an adapter that declares message-signing support.'
    );
  }

  /**
   * Setup event listeners for session
   */
  private setupEventListeners(): void {
    if (!this.client || !this.session) return;

    // Tear down any handlers from a previous session before re-binding, so
    // listeners don't accumulate across connect/disconnect cycles.
    this.removeEventListeners();

    const client = this.client;
    const session = this.session;
    const isCurrentSession = (topic: string): boolean =>
      topic === session.topic && this.client === client && this.session?.topic === session.topic;
    const cleanupSession = (event: SessionLifecycleEvent): void => {
      if (isCurrentSession(event.topic)) {
        this.cleanup();
        this.emit('disconnect');
      }
    };
    const handleSessionEvent = (event: SessionEvent): void => {
      if (!isCurrentSession(event.topic)) return;
      try {
        this.handleSessionEvent(event);
      } catch (error) {
        this.failClosed(error);
      }
    };
    const handleSessionUpdate = (event: SessionUpdateEvent): void => {
      if (!isCurrentSession(event.topic)) return;
      try {
        this.handleSessionUpdate(event);
      } catch (error) {
        this.failClosed(error);
      }
    };

    this.eventListenerClient = client;
    this.sessionDeleteHandler = cleanupSession;
    this.sessionExpireHandler = cleanupSession;
    this.sessionEventHandler = handleSessionEvent;
    this.sessionUpdateHandler = handleSessionUpdate;

    client.on('session_delete', this.sessionDeleteHandler);
    client.on('session_expire', this.sessionExpireHandler);
    client.on('session_event', this.sessionEventHandler);
    client.on('session_update', this.sessionUpdateHandler);
  }

  private removeEventListeners(): void {
    if (this.eventListenerClient) {
      if (this.sessionDeleteHandler) {
        this.eventListenerClient.off('session_delete', this.sessionDeleteHandler);
      }
      if (this.sessionExpireHandler) {
        this.eventListenerClient.off('session_expire', this.sessionExpireHandler);
      }
      if (this.sessionEventHandler) {
        this.eventListenerClient.off('session_event', this.sessionEventHandler);
      }
      if (this.sessionUpdateHandler) {
        this.eventListenerClient.off('session_update', this.sessionUpdateHandler);
      }
    }
    this.eventListenerClient = null;
    this.sessionDeleteHandler = null;
    this.sessionExpireHandler = null;
    this.sessionEventHandler = null;
    this.sessionUpdateHandler = null;
  }

  private handleSessionEvent(event: SessionEvent): void {
    if (!this.session || !this.currentAccount) throw createWalletError.notConnected();

    const eventChainId = event.params.chainId;
    if (!isValidXrplChainId(eventChainId)) {
      throw new Error('WalletConnect returned an invalid XRPL session event chain');
    }

    if (event.params.event.name === 'accountsChanged') {
      const data = event.params.event.data;
      if (!Array.isArray(data) || !data.every((account) => typeof account === 'string')) {
        throw new Error('WalletConnect returned malformed XRPL accounts');
      }
      const accounts = data.map((account) =>
        isValidClassicAddress(account) ? `${eventChainId}:${account}` : account
      );
      const currentChainId = getXrplChainId(this.currentAccount.network);
      if (eventChainId !== currentChainId) {
        throw createWalletError.networkMismatch(currentChainId, eventChainId);
      }
      const address = selectAccountForChain(accounts, currentChainId);
      const xrplNamespace = this.session.namespaces[XRPL_NAMESPACE.KEY];
      this.session = {
        ...this.session,
        namespaces: {
          ...this.session.namespaces,
          [XRPL_NAMESPACE.KEY]: { ...xrplNamespace, accounts },
        },
      };
      this.updateCurrentAccount(address, this.currentAccount.network);
      return;
    }

    if (event.params.event.name === 'chainChanged') {
      const changedChainId = this.normalizeChangedChainId(event.params.event.data);
      if (changedChainId !== eventChainId) {
        throw createWalletError.networkMismatch(eventChainId, changedChainId);
      }
      const network = this.resolveChangedNetwork(changedChainId);
      const address = selectAccountForChain(
        this.session.namespaces[XRPL_NAMESPACE.KEY]?.accounts || [],
        changedChainId,
        getApprovedXrplChainIds(this.session)
      );
      this.updateCurrentAccount(address, network);
    }
  }

  private handleSessionUpdate(event: SessionUpdateEvent): void {
    if (!this.session || !this.currentAccount) throw createWalletError.notConnected();
    const updatedSession: SessionTypes.Struct = {
      ...this.session,
      namespaces: event.params.namespaces,
    };
    const chainId = getXrplChainId(this.currentAccount.network);
    const address = selectAccountForChain(
      updatedSession.namespaces[XRPL_NAMESPACE.KEY]?.accounts || [],
      chainId,
      getApprovedXrplChainIds(updatedSession)
    );
    this.session = updatedSession;
    this.updateCurrentAccount(address, this.currentAccount.network);
  }

  private normalizeChangedChainId(data: unknown): string {
    const chainId =
      typeof data === 'number' && Number.isSafeInteger(data) && data >= 0
        ? `${XRPL_NAMESPACE.KEY}:${data}`
        : data;
    if (typeof chainId !== 'string' || !isValidXrplChainId(chainId)) {
      throw new Error('WalletConnect returned an invalid XRPL chain change');
    }
    return chainId;
  }

  private resolveChangedNetwork(chainId: string): NetworkInfo {
    const standardNetwork = Object.values(STANDARD_NETWORKS).find(
      (network) => network.walletConnectId === chainId
    );
    if (standardNetwork) return standardNetwork;
    if (this.currentAccount?.network.walletConnectId === chainId) {
      return this.currentAccount.network;
    }
    throw createWalletError.networkNotSupported(chainId, this.name);
  }

  private updateCurrentAccount(address: string, network: NetworkInfo): void {
    if (!this.currentAccount) throw createWalletError.notConnected();
    const addressChanged = address !== this.currentAccount.address;
    const networkChanged = network.walletConnectId !== this.currentAccount.network.walletConnectId;
    if (!addressChanged && !networkChanged) return;

    this.currentAccount = { ...this.currentAccount, address, network };
    if (addressChanged) this.emit('accountChanged', this.currentAccount);
    if (networkChanged) this.emit('networkChanged', network);
  }

  private assertSessionAuthorization(session: SessionTypes.Struct, account: AccountInfo): void {
    const chainId = getXrplChainId(account.network);
    const authorizedAddress = selectAccountForChain(
      session.namespaces[XRPL_NAMESPACE.KEY]?.accounts || [],
      chainId,
      getApprovedXrplChainIds(session)
    );
    if (authorizedAddress !== account.address) {
      throw new Error('WalletConnect session no longer authorizes the connected account');
    }
  }

  private failClosed(error: unknown): void {
    const client = this.client;
    const session = this.session;
    this.connectionAttemptGeneration += 1;
    this.cleanup();
    if (client && session) {
      void this.disconnectSession(
        client,
        session,
        'Failed to close invalid WalletConnect session:'
      );
    }
    const walletError = isWalletError(error)
      ? error
      : createWalletError.connectionFailed(this.name, normalizeError(error));
    this.emit('error', walletError);
    this.emit('disconnect');
  }

  private emit(event: WalletAdapterEvent, data?: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) listener(data);
  }

  /**
   * Cleanup adapter state
   */
  private cleanup(): void {
    this.removeEventListeners();
    const pending = this.pendingConnection;
    this.pendingConnection = null;
    if (pending) {
      void this.closeConnectionProposal(pending);
    }
    void this.closeActiveConnectionProposals();

    // Close and cleanup modal
    if (this.modal) {
      this.modal.closeModal();
      this.modal = null;
    }

    this.client = null;
    this.session = null;
    this.currentAccount = null;
    this.initializationPromise = null;
    this.initializationProjectId = null;
    this.clientProjectId = null;
  }

  private resolveRequestedNetwork(network: WalletConnectConnectOptions['network']): NetworkInfo {
    try {
      return resolveNetwork(network);
    } catch (error) {
      if (isWalletError(error) && error.code !== WalletErrorCode.UNKNOWN_ERROR) throw error;
      throw createWalletError.networkNotSupported(String(network), this.name);
    }
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
