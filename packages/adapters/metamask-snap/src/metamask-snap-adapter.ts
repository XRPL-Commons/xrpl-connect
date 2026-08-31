/**
 * MetaMask Snap Adapter for XRPL
 *
 * Uses the xrpl-snap (npm:xrpl-snap) to enable XRPL wallet functionality
 * through MetaMask's Snaps system.
 */

import type {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  NetworkConfig,
  StandardNetworkId,
  Transaction,
  SignedTransaction,
  SignedMessage,
  SubmittedTransaction,
} from '@xrpl-connect/core';
import {
  createWalletError,
  isStandardNetworkId,
  isWalletError,
  STANDARD_NETWORKS,
  resolveNetwork,
} from '@xrpl-connect/core';
import iconSvg from './assets/icon.svg';

/**
 * Minimal EIP-1193 provider surface (MetaMask) used by this adapter.
 */
interface Eip1193Provider {
  isMetaMask?: boolean;
  request(args: { method: string; params?: unknown }): Promise<unknown>;
}

interface Eip6963ProviderDetail {
  info: { rdns: string };
  provider: Eip1193Provider;
}

const ICON_DATA_URL = `data:image/svg+xml,${encodeURIComponent(iconSvg)}`;

const DEFAULT_SNAP_ID = 'npm:xrpl-snap';

/**
 * Mapping between xrpl-connect network IDs and snap chainIds
 */
const NETWORK_TO_CHAIN_ID: Record<StandardNetworkId, number> = {
  mainnet: 0,
  testnet: 1,
  devnet: 2,
};

const CHAIN_ID_TO_NETWORK: Record<number, string> = {
  0: 'mainnet',
  1: 'testnet',
  2: 'devnet',
};

/**
 * MetaMask Snap adapter options
 */
export interface MetaMaskSnapAdapterOptions {
  snapId?: string;
}

/**
 * MetaMask Snap adapter implementation
 */
export class MetaMaskSnapAdapter implements WalletAdapter {
  readonly id = 'metamask-snap';
  readonly name = 'MetaMask';
  readonly icon = ICON_DATA_URL;
  readonly url = 'https://snaps.metamask.io/snap/npm/xrpl-snap/';

  private readonly snapId: string;
  private provider: Eip1193Provider | null = null;
  private currentAccount: AccountInfo | null = null;

  constructor(options: MetaMaskSnapAdapterOptions = {}) {
    this.snapId = options.snapId || DEFAULT_SNAP_ID;
  }

  /**
   * Get the MetaMask provider from the window object
   */
  private getProvider(): Eip1193Provider | null {
    if (this.provider) {
      return this.provider;
    }
    if (typeof window === 'undefined') {
      return null;
    }

    let discovered: Eip1193Provider | null = null;
    const handleAnnouncement = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
      if (
        detail?.info?.rdns.includes('io.metamask') &&
        typeof detail.provider?.request === 'function'
      ) {
        discovered = detail.provider;
      }
    };

    window.addEventListener('eip6963:announceProvider', handleAnnouncement);
    try {
      window.dispatchEvent(new Event('eip6963:requestProvider'));
    } finally {
      window.removeEventListener('eip6963:announceProvider', handleAnnouncement);
    }

    const legacy = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
    this.provider = discovered ?? (legacy?.isMetaMask ? legacy : null);
    return this.provider;
  }

  /**
   * Check if MetaMask with Snaps support is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const provider = this.getProvider();
      if (!provider?.isMetaMask) {
        return false;
      }
      // Check if the provider supports snaps by calling wallet_getSnaps
      await provider.request({ method: 'wallet_getSnaps' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Connect to the XRPL Snap via MetaMask
   */
  async connect(options?: ConnectOptions): Promise<AccountInfo> {
    try {
      const available = await this.isAvailable();
      if (!available) {
        throw createWalletError.notInstalled(this.name);
      }

      const provider = this.getProvider();
      if (!provider) {
        throw createWalletError.notInstalled(this.name);
      }
      const network = resolveNetwork(options?.network);

      // Request snap installation/connection
      await provider.request({
        method: 'wallet_requestSnaps',
        params: { [this.snapId]: {} },
      });

      // A failed reconnect must not leave an old account active after the Snap
      // has accepted a new network or account selection.
      this.currentAccount = null;
      const appliedNetwork = await this.selectNetwork(network);

      // Get account info from the snap
      const accountResponse = (await this.invokeSnap('xrpl_getAccount')) as {
        account: string;
        publicKey: string;
      };

      if (!accountResponse?.account) {
        throw new Error('Failed to get account from MetaMask Snap');
      }

      this.currentAccount = {
        address: accountResponse.account,
        publicKey: accountResponse.publicKey,
        network: appliedNetwork,
      };

      return this.currentAccount;
    } catch (error) {
      // Preserve already-typed errors (e.g. WALLET_NOT_INSTALLED) instead of
      // re-wrapping them as a generic CONNECTION_FAILED.
      if (isWalletError(error)) {
        throw error;
      }
      if (error instanceof Error && error.message.toLowerCase().includes('reject')) {
        throw createWalletError.connectionRejected(this.name);
      }
      throw createWalletError.connectionFailed(this.name, error as Error);
    }
  }

  /**
   * Disconnect from the snap
   */
  async disconnect(): Promise<void> {
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

    return this.readActiveNetwork();
  }

  /** Switch the Snap network and verify the active network before returning. */
  async switchNetwork(network: NetworkConfig): Promise<NetworkInfo> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }
    const applied = await this.selectNetwork(resolveNetwork(network));
    this.currentAccount.network = applied;
    return applied;
  }

  /**
   * Sign a transaction without submitting
   */
  async sign(transaction: Transaction): Promise<SignedTransaction> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      const tx = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      };

      const result = (await this.invokeSnap('xrpl_sign', tx)) as {
        tx_blob: string;
        hash: string;
      };

      return {
        hash: result.hash,
        tx_blob: result.tx_blob,
      };
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('reject')) {
        throw createWalletError.signRejected();
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign and submit a transaction
   */
  async signAndSubmit(transaction: Transaction): Promise<SubmittedTransaction> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      const tx = {
        ...transaction,
        Account: transaction.Account || this.currentAccount.address,
      };

      const response = (await this.invokeSnap('xrpl_signAndSubmit', tx)) as {
        result?: {
          engine_result?: string;
          engine_result_message?: string;
          tx_json?: { hash?: string };
        };
      };
      const submitResult = response?.result;
      if (
        submitResult?.engine_result !== 'tesSUCCESS' &&
        submitResult?.engine_result !== 'terQUEUED'
      ) {
        const detail = submitResult?.engine_result_message || submitResult?.engine_result;
        throw new Error(
          detail ? `XRPL submission failed: ${detail}` : 'Invalid XRPL submit response'
        );
      }
      const hash = submitResult.tx_json?.hash;
      if (!hash) {
        throw new Error('XRPL submission succeeded without a transaction hash');
      }

      return { hash };
    } catch (error) {
      if (isWalletError(error)) {
        throw error;
      }
      if (error instanceof Error && error.message.toLowerCase().includes('reject')) {
        throw createWalletError.signRejected();
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Sign a message
   */
  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    if (!this.currentAccount) {
      throw createWalletError.notConnected();
    }

    try {
      const messageStr =
        typeof message === 'string'
          ? message
          : new TextDecoder('utf-8', { fatal: true }).decode(message);

      const result = (await this.invokeSnap('xrpl_signMessage', { message: messageStr })) as {
        signature: string;
      };

      return {
        message: messageStr,
        signature: result.signature,
        publicKey: this.currentAccount.publicKey || '',
      };
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('reject')) {
        throw createWalletError.signRejected();
      }
      throw createWalletError.signFailed(error as Error);
    }
  }

  /**
   * Invoke a method on the XRPL Snap
   */
  private async invokeSnap(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const provider = this.getProvider();
    if (!provider) {
      throw createWalletError.notConnected();
    }
    return provider.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId: this.snapId,
        request: {
          method,
          ...(params !== undefined ? { params } : {}),
        },
      },
    });
  }

  private async readActiveNetwork(): Promise<NetworkInfo> {
    const snapNetwork = (await this.invokeSnap('xrpl_getActiveNetwork')) as {
      chainId: number;
      name: string;
      nodeUrl: string;
    };
    const networkId = CHAIN_ID_TO_NETWORK[snapNetwork.chainId];
    if (networkId && isStandardNetworkId(networkId)) {
      return STANDARD_NETWORKS[networkId];
    }
    return {
      id: `snap-chain-${snapNetwork.chainId}`,
      name: snapNetwork.name,
      wss: '',
      rpc: snapNetwork.nodeUrl,
    };
  }

  private async selectNetwork(network: NetworkInfo): Promise<NetworkInfo> {
    if (!isStandardNetworkId(network.id)) {
      throw createWalletError.networkNotSupported(network.id, this.name);
    }
    const chainId = NETWORK_TO_CHAIN_ID[network.id];

    const current = await this.readActiveNetwork();
    if (current.id !== network.id) {
      await this.invokeSnap('xrpl_changeNetwork', { chainId });
    }

    const applied = await this.readActiveNetwork();
    if (applied.id !== network.id) {
      throw createWalletError.networkMismatch(network.id, applied.id);
    }
    return applied;
  }
}
