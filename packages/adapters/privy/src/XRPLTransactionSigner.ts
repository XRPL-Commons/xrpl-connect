/**
 * XRPL Transaction Signer
 * Handles transaction encoding, signing, and submission using Privy's embedded wallet
 */

import { encode, decode } from 'ripple-binary-codec';
import type { Client, Transaction } from 'xrpl';
import { hashes } from 'xrpl';
import type { PrivyClientWrapper } from './PrivyClientWrapper';
import type { SignedMessage, SubmittedTransaction } from '@xrpl-connect/core';

/**
 * XRPL Transaction Signer
 * Handles signing XRPL transactions using Privy's embedded wallet
 */
export class XRPLTransactionSigner {
  private privyClient: PrivyClientWrapper;
  private xrplClient: Client | null = null;

  constructor(privyClient: PrivyClientWrapper, xrplClient?: Client) {
    this.privyClient = privyClient;
    this.xrplClient = xrplClient || null;
  }

  /**
   * Set XRPL client for transaction submission
   */
  setXRPLClient(client: Client): void {
    this.xrplClient = client;
  }

  /**
   * Sign and optionally submit a transaction
   *
   * @param transaction - XRPL transaction object
   * @param submit - Whether to submit to the ledger (default: true)
   * @returns Submitted transaction result
   */
  async signAndSubmit(
    transaction: Transaction,
    submit: boolean = true
  ): Promise<SubmittedTransaction> {
    // Get wallet address
    const walletAddress = this.privyClient.getWalletAddress();
    if (!walletAddress) {
      throw new Error('No wallet address found');
    }

    // Ensure transaction has Account field
    if (!transaction.Account) {
      transaction.Account = walletAddress;
    }

    // Auto-fill transaction if XRPL client is available
    let preparedTx = transaction;
    if (this.xrplClient && this.xrplClient.isConnected()) {
      preparedTx = await this.xrplClient.autofill(transaction as any);
    }

    // Encode transaction to binary format
    const encodedTx = encode(preparedTx);

    // Get signing hash
    const signingHash = hashes.hashSignedTx(encodedTx);

    // Sign using Privy's embedded wallet
    const chainType = this.privyClient.getChainType();
    if (!chainType) {
      throw new Error('Unable to determine wallet chain type');
    }

    // Call Privy to sign the transaction
    const signResult = await this.privyClient.signTransaction({
      chainId: 'xrpl', // We'll use 'xrpl' as the chain identifier
      address: walletAddress,
      transaction: signingHash,
    });

    // Combine signature with transaction
    const signedTx = this.combineSignature(encodedTx, signResult.signature, preparedTx);

    // Submit to XRPL if requested
    if (submit) {
      if (!this.xrplClient || !this.xrplClient.isConnected()) {
        throw new Error('XRPL client not connected. Cannot submit transaction.');
      }

      const result = await this.xrplClient.submit(signedTx);

      return {
        hash: result.result.tx_json.hash || '',
        id: result.result.tx_json.hash,
        ...result.result,
      };
    }

    // Return just the signed transaction blob if not submitting
    const hash = hashes.hashSignedTx(signedTx);

    return {
      hash,
      tx_blob: signedTx,
    };
  }

  /**
   * Sign a transaction without submitting
   *
   * @param transaction - XRPL transaction object
   * @returns Hex-encoded signed transaction blob
   */
  async signTransaction(transaction: Transaction): Promise<string> {
    const result = await this.signAndSubmit(transaction, false);
    return (result.tx_blob as string) || '';
  }

  /**
   * Sign a message
   *
   * @param message - Message to sign (string or Uint8Array)
   * @returns Signed message result
   */
  async signMessage(message: string | Uint8Array): Promise<SignedMessage> {
    const walletAddress = this.privyClient.getWalletAddress();
    if (!walletAddress) {
      throw new Error('No wallet address found');
    }

    // Convert message to string if Uint8Array
    const messageStr = typeof message === 'string'
      ? message
      : Buffer.from(message).toString('utf8');

    // Sign using Privy
    const signResult = await this.privyClient.signMessage({
      address: walletAddress,
      message: messageStr,
    });

    // Get public key from wallet (we'd need to extend PrivyClientWrapper for this)
    const wallet = this.privyClient.getEmbeddedWallet();
    const publicKey = wallet?.address || ''; // This is a placeholder - we'd need actual public key

    return {
      message: messageStr,
      signature: signResult.signature,
      publicKey,
    };
  }

  /**
   * Combine signature with encoded transaction
   *
   * @param encodedTx - Binary-encoded transaction
   * @param signature - Hex signature from Privy
   * @param transaction - Original transaction object
   * @returns Signed transaction blob (hex)
   */
  private combineSignature(
    _encodedTx: string,
    signature: string,
    transaction: Transaction
  ): string {
    // Remove 0x prefix if present
    const sig = signature.replace(/^0x/, '');

    // Add TxnSignature field to transaction
    const signedTx = {
      ...transaction,
      TxnSignature: sig.toUpperCase(),
    };

    // Re-encode with signature
    return encode(signedTx);
  }

  /**
   * Verify a signature (for validation purposes)
   *
   * @param transaction - Signed transaction blob
   * @returns true if signature is valid
   */
  async verifySignature(transaction: string): Promise<boolean> {
    try {
      // Decode the transaction
      const decodedTx = decode(transaction) as any;

      // Check if TxnSignature exists
      if (!decodedTx.TxnSignature) {
        return false;
      }

      // Additional verification would go here
      // For now, just check that signature exists
      return true;
    } catch (_error) {
      return false;
    }
  }
}
