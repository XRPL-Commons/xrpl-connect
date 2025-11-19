import { useState, FormEvent } from 'react';
import { useWallet } from '../context/WalletContext';
import { Transaction } from '@xrpl-connect/core';

export function TransactionForm() {
  const { walletManager, isConnected, addEvent } = useWallet();
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!walletManager || !walletManager.account) return;

    try {
      setResult('<div class="loading">Signing and submitting transaction...</div>');

      const transaction: Transaction = {
        TransactionType: 'Payment',
        Account: walletManager.account.address,
        Destination: destination,
        Amount: amount,
      };

      const txResult = await walletManager.signAndSubmit(transaction);

      const txBlob = txResult.tx_blob as string | undefined;
      setResult(`
        <div class="success">
          <h3>Transaction Submitted!</h3>
          <p><strong>Hash:</strong> ${txResult.hash || 'Pending'}</p>
          ${txResult.id ? `<p><strong>ID:</strong> ${txResult.id}</p>` : ''}
          ${txBlob ? `<p><strong>Blob:</strong> <code>${txBlob.substring(0, 50)}...</code></p>` : ''}
          <p class="info">✅ Transaction has been signed and submitted to the ledger</p>
        </div>
      `);

      addEvent('Transaction Submitted', txResult);
    } catch (error: any) {
      setResult(`<div class="error">Failed: ${error.message}</div>`);
      addEvent('Transaction Failed', error);
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <section id="transaction-section">
      <h2>Send Transaction</h2>
      <form onSubmit={handleSubmit} className="tx-form">
        <div className="form-group">
          <label htmlFor="destination">Destination Address</label>
          <input
            type="text"
            id="destination"
            placeholder="rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="amount">Amount (drops)</label>
          <input
            type="number"
            id="amount"
            placeholder="1000000"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <small>1 XRP = 1,000,000 drops</small>
        </div>
        <button type="submit" className="btn-primary">
          Sign & Submit Transaction
        </button>
      </form>
      {result && <div className="result" dangerouslySetInnerHTML={{ __html: result }} />}
    </section>
  );
}
