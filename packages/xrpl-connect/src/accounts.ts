import type { NetworkConfig } from '@xrpl-connect/core';
// Default-import + destructure: xrpl is CommonJS — see address.ts for why.
import XrplPkg from 'xrpl';
import { withClient } from './network';

const { dropsToXrp } = XrplPkg;

export interface XrpBalance {
  drops: string;
  xrp: string;
}

export interface TokenBalance {
  currency: string;
  issuer: string;
  balance: string;
}

export interface MptBalance {
  mptIssuanceId: string;
  value: string;
  /** Present only when part of the balance is locked (e.g. by an escrow). */
  locked?: string;
}

interface MPTokenLedgerEntry {
  LedgerEntryType: 'MPToken';
  MPTokenIssuanceID: string;
  // The xrpl.js .d.ts types this as the `{ mpt_issuance_id, value }` MPTAmount object
  // (same name as the unrelated Payment.Amount MPT shape), but the actual rippled
  // response for this ledger entry is a plain string — confirmed against a live server.
  MPTAmount?: string;
  LockedAmount?: string;
}

export class Accounts {
  /** XRP balance of an account, straight off the ledger (`account_info`). */
  static async getXrpBalance(address: string, network: NetworkConfig = 'testnet'): Promise<XrpBalance> {
    return withClient(network, async (client) => {
      const response = await client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated',
      });
      const drops = response.result.account_data.Balance;
      return { drops, xrp: dropsToXrp(drops) };
    });
  }

  /** Issued-currency (IOU / trustline) balances of an account (`account_lines`). */
  static async getTokenBalances(
    address: string,
    network: NetworkConfig = 'testnet'
  ): Promise<TokenBalance[]> {
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
      }));
    });
  }

  /** Multi-Purpose Token balances of an account (`account_objects`, type `mptoken`). */
  static async getMptBalances(address: string, network: NetworkConfig = 'testnet'): Promise<MptBalance[]> {
    return withClient(network, async (client) => {
      const response = await client.request({
        command: 'account_objects',
        account: address,
        type: 'mptoken',
        ledger_index: 'validated',
      });
      return response.result.account_objects.map((object) => {
        const mpToken = object as unknown as MPTokenLedgerEntry;
        return {
          mptIssuanceId: mpToken.MPTokenIssuanceID,
          // Omitted by the ledger entry when the held amount is zero.
          value: mpToken.MPTAmount ?? '0',
          ...(mpToken.LockedAmount !== undefined ? { locked: mpToken.LockedAmount } : {}),
        };
      });
    });
  }
}
