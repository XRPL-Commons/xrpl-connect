import { useState, FormEvent } from 'react';
import { useWallet, useSigner } from '@xrpl-commons/xrpl-connect-react';
import type { Transaction } from 'xrpl-connect';
import { useDemo } from '../context/DemoContext';

export function TransactionForm() {
  const { connected, account } = useWallet();
  const { signAndSubmit } = useSigner();
  const { addEvent } = useDemo();
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!account) return;

    try {
      setResult('<div class="loading">Signing and submitting transaction...</div>');

      const transaction: Transaction = {
        TransactionType: 'Payment',
        Account: account.address,
        Destination: destination,
        Amount: amount,
      };

      const txResult = await signAndSubmit(transaction);

      setResult(`
        <div class="success">
          <h3>Transaction Submitted!</h3>
          <p><strong>Hash:</strong> ${txResult.hash || 'Pending'}</p>
          ${txResult.id ? `<p><strong>ID:</strong> ${txResult.id}</p>` : ''}
          <p class="info">✅ Transaction has been signed and submitted to the ledger</p>
        </div>
      `);

      addEvent('Transaction Submitted', txResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResult(`<div class="error">Failed: ${message}</div>`);
      addEvent('Transaction Failed', { message });
    }
  };

  if (!connected) {
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
          Sign &amp; Submit Transaction
        </button>
      </form>
      {result && <div className="result" dangerouslySetInnerHTML={{ __html: result }} />}
    </section>
  );
}
