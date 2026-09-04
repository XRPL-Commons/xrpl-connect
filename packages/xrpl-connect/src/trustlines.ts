import type { NetworkConfig } from '@xrpl-connect/core';
import type { SigningCredential } from './credential';
import { walletFromCredential } from './credential';
import { withClient } from './network';
import type { TxResult } from './tx-result';
import { toTxResult } from './tx-result';

export interface SetTokenTrustLineParams {
  credential: SigningCredential;
  currency: string;
  issuer: string;
  /** Max balance of this currency/issuer the account will hold. `'0'` removes the trust line. */
  limit: string;
  network?: NetworkConfig;
}

export interface SetMptTrustLineParams {
  credential: SigningCredential;
  mptIssuanceId: string;
  /** `true` (default) opts in and holds the MPT; `false` opts back out. */
  authorize?: boolean;
  network?: NetworkConfig;
}

export interface TrustLine {
  currency: string;
  issuer: string;
  balance: string;
  /** Max balance of this currency/issuer this account has agreed to hold. */
  limit: string;
  /** The reverse — the issuer's own limit on this line, from their side. */
  limitPeer: string;
  noRipple?: boolean;
  /** This account has frozen the line (blocks the peer from sending on it). */
  frozen?: boolean;
}

export class TrustLines {
  /** Current trust lines (issued-currency, i.e. token) of an account (`account_lines`). */
  static async getTrustLines(address: string, network: NetworkConfig = 'testnet'): Promise<TrustLine[]> {
    return withClient(network, async (client) => {
      const response = await client.request({
        command: 'account_lines',
        account: address,
        ledger_index: 'validated',
      });
      return response.result.lines.map((line) => ({
        currency: line.currency,
        issuer: line.account,
        balance: line.balance,
        limit: line.limit,
        limitPeer: line.limit_peer,
        ...(line.no_ripple !== undefined ? { noRipple: line.no_ripple } : {}),
        ...(line.freeze !== undefined ? { frozen: line.freeze } : {}),
      }));
    });
  }

  /** Opens (or resizes/removes, via `limit: '0'`) a trust line for an issued currency (`TrustSet`). */
  static async setTokenTrustLine(params: SetTokenTrustLineParams): Promise<TxResult> {
    const { credential, currency, issuer, limit, network = 'testnet' } = params;
    const wallet = walletFromCredential(credential);

    return withClient(network, async (client) => {
      const response = await client.submitAndWait(
        {
          TransactionType: 'TrustSet',
          Account: wallet.address,
          LimitAmount: { currency, issuer, value: limit },
        },
        { wallet }
      );
      return toTxResult(response);
    });
  }

  /**
   * Opts an account in (or back out) of holding a Multi-Purpose Token (`MPTokenAuthorize`).
   * This is the MPT equivalent of a trust line — required before it can receive that MPT.
   */
  static async setMptTrustLine(params: SetMptTrustLineParams): Promise<TxResult> {
    const { credential, mptIssuanceId, authorize = true, network = 'testnet' } = params;
    const wallet = walletFromCredential(credential);

    return withClient(network, async (client) => {
      const response = await client.submitAndWait(
        {
          TransactionType: 'MPTokenAuthorize',
          Account: wallet.address,
          MPTokenIssuanceID: mptIssuanceId,
          ...(authorize ? {} : { Flags: { tfMPTUnauthorize: true } }),
        },
        { wallet }
      );
      return toTxResult(response);
    });
  }
}
