/**
 * Types for Otsu wallet adapter
 */

/**
 * Otsu provider interface injected at window.xrpl by the extension.
 *
 * The Otsu extension injects this provider into every page via
 * a content script. dApps interact with the wallet through this
 * interface using postMessage-based communication.
 */
export interface OtsuProvider {
  /** Identifies the provider as Otsu Wallet */
  isOtsu: boolean;

  /** Check if a dApp is currently connected */
  isConnected(): boolean;

  /** Request connection with optional permission scopes */
  connect(params?: { scopes?: string[] }): Promise<{ address: string }>;

  /** Disconnect the dApp */
  disconnect(): Promise<void>;

  /** Get the connected account address */
  getAddress(): Promise<{ address: string }>;

  /** Get the current network identifier */
  getNetwork(): Promise<{ network: string }>;

  /** Sign a transaction without submitting */
  signTransaction(tx: Record<string, unknown>): Promise<{ tx_blob: string; hash: string }>;

  /** Sign and submit a transaction to the ledger */
  signAndSubmit(tx: Record<string, unknown>): Promise<{ tx_blob: string; hash: string }>;

  /** Sign an arbitrary message */
  signMessage(message: string): Promise<{ signature: string }>;

  /** Register an event listener */
  on(event: string, callback: (data: unknown) => void): void;

  /** Remove an event listener */
  off(event: string, callback: (data: unknown) => void): void;
}

/**
 * Network mapping between xrpl-connect network IDs and Otsu network identifiers.
 *
 * xrpl-connect uses: 'mainnet', 'testnet', 'devnet'
 * Otsu uses: 'mainnet', 'testnet', 'devnet'
 */
export const OTSU_NETWORK_MAP: Record<string, string> = {
  mainnet: 'mainnet',
  testnet: 'testnet',
  devnet: 'devnet',
};

declare global {
  interface Window {
    xrpl?: OtsuProvider;
  }
}
