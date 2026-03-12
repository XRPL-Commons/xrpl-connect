/**
 * MetaMask Snap Adapter for XRPL
 *
 * Uses the xrpl-snap (npm:xrpl-snap) to enable XRPL wallet functionality
 * through MetaMask's Snaps system.
 */

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request(args: { method: string; params?: unknown }): Promise<unknown>;
    };
  }
}

import type {
  WalletAdapter,
  AccountInfo,
  ConnectOptions,
  NetworkInfo,
  Transaction,
  SignedTransaction,
  SignedMessage,
  SubmittedTransaction,
} from '@xrpl-connect/core';
import { createWalletError, STANDARD_NETWORKS } from '@xrpl-connect/core';

const DEFAULT_SNAP_ID = 'npm:xrpl-snap';

/**
 * Mapping between xrpl-connect network IDs and snap chainIds
 */
const NETWORK_TO_CHAIN_ID: Record<string, number> = {
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
  readonly icon =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzg3IiBoZWlnaHQ9IjM4NyIgdmlld0JveD0iMCAwIDM4NyAzODciIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8yMDc1XzIpIj4KPHBhdGggZD0iTTM4NyAwSDBWMzg3SDM4N1YwWiIgZmlsbD0iYmxhY2siLz4KPG1hc2sgaWQ9Im1hc2swXzIwNzVfMiIgc3R5bGU9Im1hc2stdHlwZTpsdW1pbmFuY2UiIG1hc2tVbml0cz0idXNlclNwYWNlT25Vc2UiIHg9IjQ1IiB5PSI4MSIgd2lkdGg9IjI5OCIgaGVpZ2h0PSIyMjUiPgo8cGF0aCBkPSJNMzQzIDgxSDQ1VjMwNkgzNDNWODFaIiBmaWxsPSJ3aGl0ZSIvPgo8L21hc2s+CjxnIG1hc2s9InVybCgjbWFzazBfMjA3NV8yKSI+CjxwYXRoIGQ9Ik0xMTMuNTQ2IDk0Ljk0MTVIMTE4Ljk2N1Y4MUgxMTMuNTQ2QzEwNy43OTggODAuOTk0OSAxMDIuMTA1IDgyLjEyMzQgOTYuNzkzMSA4NC4zMjA3QzkxLjQ4MTUgODYuNTE4MSA4Ni42NTUzIDg5Ljc0MTMgODIuNTkwNyA5My44MDU5Qzc4LjUyNjIgOTcuODcwNSA3NS4zMDMgMTAyLjY5NyA3My4xMDU2IDEwOC4wMDhDNzAuOTA4MiAxMTMuMzIgNjkuNzc5OCAxMTkuMDEzIDY5Ljc4NDkgMTI0Ljc2MVYxNTYuNTE2QzY5Ljc5NjUgMTYzLjI0IDY3LjIzNTcgMTY5LjcxNCA2Mi42MjczIDE3NC42MUM1OC4wMTkgMTc5LjUwNyA1MS43MTIzIDE4Mi40NTUgNDUgMTgyLjg1TDQ1LjM4NzMgMTg5LjgyMUw0NSAxOTYuNzkyQzUxLjcxMjMgMTk3LjE4NyA1OC4wMTkgMjAwLjEzNiA2Mi42MjczIDIwNS4wMzJDNjcuMjM1NyAyMDkuOTI4IDY5Ljc5NjUgMjE2LjQwMiA2OS43ODQ5IDIyMy4xMjZWMjU5LjcyMkM2OS43NjQzIDI3MS44NjYgNzQuNTY2IDI4My41MjEgODMuMTM0OCAyOTIuMTI2QzkxLjcwMzUgMzAwLjczMSAxMDMuMzM4IDMwNS41ODIgMTE1LjQ4MiAzMDUuNjEzVjI5MS42NzFDMTA3LjA2MSAyOTEuNjY2IDk4Ljk4NzIgMjg4LjMxOSA5My4wMzMgMjgyLjM2NUM4Ny4wNzg4IDI3Ni40MTEgODMuNzMxNSAyNjguMzM2IDgzLjcyNjQgMjU5LjkxNlYyMjMuMTI2QzgzLjczMjIgMjE2LjU1OCA4Mi4xMjkzIDIxMC4wODggNzkuMDU3NyAyMDQuMjgyQzc1Ljk4NiAxOTguNDc3IDcxLjUzOTIgMTkzLjUxMiA2Ni4xMDU5IDE4OS44MjFDNzEuNTIzNyAxODYuMTE1IDc1Ljk1ODggMTgxLjE0NyA3OS4wMjg1IDE3NS4zNDRDODIuMDk4MyAxNjkuNTQyIDgzLjcxMDYgMTYzLjA4MSA4My43MjY0IDE1Ni41MTZWMTI0Ljc2MUM4My43NjIgMTE2Ljg2MyA4Ni45MTUxIDEwOS4yOTkgOTIuNDk5NiAxMDMuNzE1Qzk4LjA4NDEgOTguMTMwMyAxMDUuNjQ4IDk0Ljk3NzIgMTEzLjU0NiA5NC45NDE1WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTI3NC42NDggOTQuOTQxNUgyNjkuMjI3VjgxSDI3NC42NDhDMjg2LjIyNyA4MS4wMzA4IDI5Ny4zMiA4NS42NTczIDMwNS40ODkgOTMuODYzQzMxMy42NTkgMTAyLjA2OSAzMTguMjM2IDExMy4xODIgMzE4LjIxNSAxMjQuNzYxVjE1Ni41MTZDMzE4LjIwNCAxNjMuMjQgMzIwLjc2NSAxNjkuNzE0IDMyNS4zNzMgMTc0LjYxQzMyOS45ODEgMTc5LjUwNyAzMzYuMjg4IDE4Mi40NTUgMzQzIDE4Mi44NUwzNDIuNjEzIDE4OS44MjFMMzQzIDE5Ni43OTJDMzM2LjI4OCAxOTcuMTg3IDMyOS45ODEgMjAwLjEzNSAzMjUuMzczIDIwNS4wMzJDMzIwLjc2NSAyMDkuOTI4IDMxOC4yMDQgMjE2LjQwMiAzMTguMjE1IDIyMy4xMjZWMjU5LjcyMkMzMTguMjM2IDI3MS44NjYgMzEzLjQzNCAyODMuNTIxIDMwNC44NjUgMjkyLjEyNkMyOTYuMjk3IDMwMC43MzEgMjg0LjY2MiAzMDUuNTgyIDI3Mi41MTggMzA1LjYxM1YyOTEuNjcxQzI4MC45MzkgMjkxLjY2NiAyODkuMDEzIDI4OC4zMTkgMjk0Ljk2NyAyODIuMzY1QzMwMC45MjEgMjc2LjQxIDMwNC4yNjkgMjY4LjMzNiAzMDQuMjc0IDI1OS45MTZWMjIzLjEyNkMzMDQuMjY4IDIxNi41NTcgMzA1Ljg3MSAyMTAuMDg4IDMwOC45NDMgMjA0LjI4MkMzMTIuMDE0IDE5OC40NzYgMzE2LjQ2MSAxOTMuNTExIDMyMS44OTQgMTg5LjgyMUMzMTYuNDc3IDE4Ni4xMTUgMzEyLjA0MSAxODEuMTQ3IDMwOC45NzIgMTc1LjM0NEMzMDUuOTAyIDE2OS41NDIgMzA0LjI5IDE2My4wODEgMzA0LjI3NCAxNTYuNTE2VjEyNC43NjFDMzA0LjI5NCAxMjAuODU1IDMwMy41NDMgMTE2Ljk4NCAzMDIuMDY0IDExMy4zN0MzMDAuNTg1IDEwOS43NTYgMjk4LjQwNyAxMDYuNDY5IDI5NS42NTQgMTAzLjY5OEMyOTIuOTAyIDEwMC45MjggMjg5LjYyOSA5OC43MjgyIDI4Ni4wMjQgOTcuMjI1NUMyODIuNDIgOTUuNzIyNyAyNzguNTU0IDk0Ljk0NjYgMjc0LjY0OCA5NC45NDE1WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTI0NC44MjggMTM3LjE1M0gyNjUuNTQ3TDIyMi4zNjcgMTc3LjYyMkMyMTQuNjIgMTg0LjYzMiAyMDQuNTQ0IDE4OC41MTQgMTk0LjA5NyAxODguNTE0QzE4My42NDkgMTg4LjUxNCAxNzMuNTczIDE4NC42MzIgMTY1LjgyNiAxNzcuNjIyTDEyMi42NDYgMTM3LjE1M0gxNDMuMzY1TDE3Ni4wODkgMTY3Ljc0N0MxODAuOTc2IDE3Mi4yMzIgMTg3LjM2NyAxNzQuNzIgMTk0IDE3NC43MkMyMDAuNjMzIDE3NC43MiAyMDcuMDI0IDE3Mi4yMzIgMjExLjkxMSAxNjcuNzQ3TDI0NC44MjggMTM3LjE1M1oiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0xNDMuMTcyIDI0OS40NTlIMTIyLjQ1M0wxNjUuODI3IDIwOC43OTZDMTczLjUzMSAyMDEuNyAxODMuNjIyIDE5Ny43NjEgMTk0LjA5NyAxOTcuNzYxQzIwNC41NzEgMTk3Ljc2MSAyMTQuNjYzIDIwMS43IDIyMi4zNjcgMjA4Ljc5NkwyNjUuNzQxIDI0OS40NTlIMjQ1LjAyMkwyMTIuMTA1IDIxOC40NzhDMjA3LjIxOCAyMTMuOTkzIDIwMC44MjYgMjExLjUwNSAxOTQuMTk0IDIxMS41MDVDMTg3LjU2MSAyMTEuNTA1IDE4MS4xNjkgMjEzLjk5MyAxNzYuMjgzIDIxOC40NzhMMTQzLjE3MiAyNDkuNDU5WiIgZmlsbD0id2hpdGUiLz4KPC9nPgo8L2c+CjxkZWZzPgo8Y2xpcFBhdGggaWQ9ImNsaXAwXzIwNzVfMiI+CjxyZWN0IHdpZHRoPSIzODciIGhlaWdodD0iMzg3IiBmaWxsPSJ3aGl0ZSIvPgo8L2NsaXBQYXRoPgo8L2RlZnM+Cjwvc3ZnPgo=';
  readonly url = 'https://snaps.metamask.io/snap/npm/xrpl-snap/';

  private readonly snapId: string;
  private currentAccount: AccountInfo | null = null;

  constructor(options: MetaMaskSnapAdapterOptions = {}) {
    this.snapId = options.snapId || DEFAULT_SNAP_ID;
  }

  /**
   * Get the MetaMask provider from the window object
   */
  private getProvider(): any {
    if (typeof window === 'undefined' || !window.ethereum) {
      return null;
    }
    return window.ethereum;
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
      const network = this.resolveNetwork(options?.network);

      // Request snap installation/connection
      await provider.request({
        method: 'wallet_requestSnaps',
        params: { [this.snapId]: {} },
      });

      // Switch the snap to the correct network
      const chainId = NETWORK_TO_CHAIN_ID[network.id];
      if (chainId !== undefined) {
        try {
          await this.invokeSnap('xrpl_changeNetwork', { chainId });
        } catch {
          // Snap may already be on this network, ignore "already active" errors
        }
      }

      // Get account info from the snap
      const accountResponse = await this.invokeSnap('xrpl_getAccount') as {
        account: string;
        publicKey: string;
      };

      if (!accountResponse?.account) {
        throw new Error('Failed to get account from MetaMask Snap');
      }

      this.currentAccount = {
        address: accountResponse.account,
        publicKey: accountResponse.publicKey,
        network,
      };

      return this.currentAccount;
    } catch (error) {
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

    try {
      const snapNetwork = await this.invokeSnap('xrpl_getActiveNetwork') as {
        chainId: number;
        name: string;
        nodeUrl: string;
      };

      const networkId = CHAIN_ID_TO_NETWORK[snapNetwork.chainId];
      if (networkId && STANDARD_NETWORKS[networkId]) {
        return STANDARD_NETWORKS[networkId];
      }

      // Custom network from the snap
      return {
        id: `snap-chain-${snapNetwork.chainId}`,
        name: snapNetwork.name,
        wss: '',
        rpc: snapNetwork.nodeUrl,
      };
    } catch {
      return this.currentAccount.network;
    }
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

      const result = await this.invokeSnap('xrpl_sign', tx) as {
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

      const result = await this.invokeSnap('xrpl_signAndSubmit', tx) as {
        result?: { hash?: string };
        hash?: string;
      };

      const hash = result?.result?.hash || result?.hash || '';

      return { hash };
    } catch (error) {
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
      const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);

      const result = await this.invokeSnap('xrpl_signMessage', { message: messageStr }) as {
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
}
