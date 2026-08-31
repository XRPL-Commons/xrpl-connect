/**
 * Types for Xyra wallet adapter
 */

import type { Network } from '@xyrawallet/sdk';
import type { StandardNetworkId } from '@xrpl-connect/core';

/**
 * Xyra adapter constructor options
 */
export interface XyraAdapterOptions {
  /**
   * Custom wallet URL (defaults to 'https://wallet.xyra.now')
   * Useful for development or self-hosted instances.
   */
  walletUrl?: string;

  /**
   * Timeout for popup operations in milliseconds (default: 300000 / 5 minutes)
   */
  timeout?: number;

  /**
   * Custom popup width (default: 420)
   */
  popupWidth?: number;

  /**
   * Custom popup height for connect flow (default: 720)
   */
  popupHeight?: number;

  /**
   * Custom popup height for sign flow (default: 640)
   */
  signPopupHeight?: number;
}

/**
 * Xyra-specific connect options passed through WalletManager.connect()
 */
export type XyraConnectOptions = {
  /**
   * Override wallet URL for this connection
   */
  walletUrl?: string;

  /**
   * Override timeout for this connection
   */
  timeout?: number;
};

/**
 * Network mapping between xrpl-connect network IDs and Xyra SDK network strings.
 *
 * xrpl-connect uses: 'mainnet', 'testnet', 'devnet'
 * Xyra SDK uses: 'xrpl-mainnet', 'xrpl-testnet'
 *
 */
export const XRPL_CONNECT_TO_XYRA_NETWORK: Record<StandardNetworkId, Network> = {
  mainnet: 'xrpl-mainnet',
  testnet: 'xrpl-testnet',
  devnet: 'xrpl-testnet', // Xyra doesn't have devnet, fall back to testnet
};

/**
 * Reverse mapping: Xyra SDK network → xrpl-connect network ID
 */
export const XYRA_TO_XRPL_CONNECT_NETWORK: Partial<Record<Network, StandardNetworkId>> = {
  'xrpl-mainnet': 'mainnet',
  'xrpl-testnet': 'testnet',
};
