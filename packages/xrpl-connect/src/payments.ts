import type { NetworkConfig } from '@xrpl-connect/core';
// Default-import + destructure: xrpl is CommonJS — see address.ts for why.
import XrplPkg from 'xrpl';
import type { SigningCredential } from './credential';
import { walletFromCredential } from './credential';
import { withClient } from './network';
import type { TxResult } from './tx-result';
import { toTxResult } from './tx-result';

const { xrpToDrops } = XrplPkg;

export interface SendXrpParams {
  credential: SigningCredential;
  destination: string;
  /** Amount in XRP (not drops) — e.g. `'10'` for 10 XRP. */
  amountXrp: string;
  destinationTag?: number;
  network?: NetworkConfig;
}

export interface SendTokenParams {
  credential: SigningCredential;
  destination: string;
  currency: string;
  issuer: string;
  value: string;
  destinationTag?: number;
  network?: NetworkConfig;
}

export interface SendMptParams {
  credential: SigningCredential;
  destination: string;
  mptIssuanceId: string;
  value: string;
  destinationTag?: number;
  network?: NetworkConfig;
}

export class Payments {
  /** Sends a plain XRP payment. */
  static async sendXrp(params: SendXrpParams): Promise<TxResult> {
    const { credential, destination, amountXrp, destinationTag, network = 'testnet' } = params;
    const wallet = walletFromCredential(credential);

    return withClient(network, async (client) => {
      const response = await client.submitAndWait(
        {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: destination,
          Amount: xrpToDrops(amountXrp),
          ...(destinationTag !== undefined ? { DestinationTag: destinationTag } : {}),
        },
        { wallet }
      );
      return toTxResult(response);
    });
  }

  /** Sends an issued-currency (IOU / trustline token) payment. */
  static async sendToken(params: SendTokenParams): Promise<TxResult> {
    const { credential, destination, currency, issuer, value, destinationTag, network = 'testnet' } =
      params;
    const wallet = walletFromCredential(credential);

    return withClient(network, async (client) => {
      const response = await client.submitAndWait(
        {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: destination,
          Amount: { currency, issuer, value },
          ...(destinationTag !== undefined ? { DestinationTag: destinationTag } : {}),
        },
        { wallet }
      );
      return toTxResult(response);
    });
  }

  /** Sends a Multi-Purpose Token payment. The destination must already hold an authorized MPToken. */
  static async sendMpt(params: SendMptParams): Promise<TxResult> {
    const { credential, destination, mptIssuanceId, value, destinationTag, network = 'testnet' } = params;
    const wallet = walletFromCredential(credential);

    return withClient(network, async (client) => {
      const response = await client.submitAndWait(
        {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: destination,
          Amount: { mpt_issuance_id: mptIssuanceId, value },
          ...(destinationTag !== undefined ? { DestinationTag: destinationTag } : {}),
        },
        { wallet }
      );
      return toTxResult(response);
    });
  }
}
