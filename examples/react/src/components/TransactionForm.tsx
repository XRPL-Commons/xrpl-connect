import { useRef, useState, FormEvent } from 'react';
import { useWallet, useSigner } from '@xrpl-commons/xrpl-connect-react';
import type { Transaction } from 'xrpl-connect';
import { useDemo } from '../context/DemoContext';

type ResultState =
  | { kind: 'loading'; message: string }
  | { kind: 'error'; message: string }
  | {
      kind: 'success';
      title: string;
      details: Array<{ label: string; value: string }>;
      info?: string;
    };

export function TransactionForm() {
  const { connected, account, manager } = useWallet();
  const { sign, signAndSubmit } = useSigner();
  const { addEvent } = useDemo();
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<ResultState | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const canSign = manager.supports('sign');
  const canSubmit = manager.supports('signAndSubmit');

  const createTransaction = (): Transaction | null => {
    if (!account) return null;
    return {
      TransactionType: 'Payment',
      Account: account.address,
      Destination: destination,
      Amount: amount,
    };
  };

  const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

  const handleFund = async () => {
    if (!account || busy || account.network.id !== 'testnet') return;

    setBusy(true);
    setResult({ kind: 'loading', message: 'Requesting testnet funds…' });
    try {
      const response = await fetch('https://faucet.altnet.rippletest.net/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: account.address }),
      });
      if (!response.ok) throw new Error(`Testnet faucet failed (${response.status})`);

      setResult({
        kind: 'success',
        title: 'Testnet Wallet Funded!',
        details: [{ label: 'Address', value: account.address }],
        info: 'Wait for the faucet payment to validate before signing a transaction.',
      });
      addEvent('Testnet Wallet Funded', { address: account.address, network: 'testnet' });
    } catch (error) {
      const message = errorMessage(error);
      setResult({ kind: 'error', message });
      addEvent('Testnet Funding Failed', { message });
    } finally {
      setBusy(false);
    }
  };

  const handleSign = async () => {
    if (!canSign || busy) return;
    if (!formRef.current?.reportValidity()) return;
    const transaction = createTransaction();
    if (!transaction) return;

    setBusy(true);
    setResult({ kind: 'loading', message: 'Signing transaction…' });
    try {
      const signed = await sign(transaction);
      setResult({
        kind: 'success',
        title: 'Transaction Signed!',
        details: [
          { label: 'Hash', value: signed.hash || 'Pending' },
          {
            label: 'Signed blob',
            value: signed.tx_blob || 'Unavailable',
          },
        ],
        info: 'This action only created a signed transaction; it was not submitted.',
      });
      addEvent('Transaction Signed', signed);
    } catch (error) {
      const message = errorMessage(error);
      setResult({ kind: 'error', message });
      addEvent('Transaction Sign Failed', { message });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    const transaction = createTransaction();
    if (!transaction) return;

    setBusy(true);
    setResult({ kind: 'loading', message: 'Signing and submitting transaction…' });
    try {
      const txResult = await signAndSubmit(transaction);
      setResult({
        kind: 'success',
        title: 'Transaction Submitted!',
        details: [
          { label: 'Hash', value: txResult.hash || 'Pending' },
          ...(txResult.id ? [{ label: 'ID', value: txResult.id }] : []),
        ],
        info: 'Transaction has been signed and submitted to the ledger.',
      });
      addEvent('Transaction Submitted', txResult);
    } catch (error) {
      const message = errorMessage(error);
      setResult({ kind: 'error', message });
      addEvent('Transaction Failed', { message });
    } finally {
      setBusy(false);
    }
  };

  if (!connected || !account) {
    return null;
  }

  return (
    <section id="transaction-section">
      <h2>Send Transaction</h2>
      <p className="section-description">
        Fund a new testnet account manually, then sign a payment without submitting it or sign and
        submit it to the testnet ledger.
      </p>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => void handleFund()}
        disabled={busy || account.network.id !== 'testnet'}
      >
        Fund Testnet Wallet
      </button>
      {account.network.id !== 'testnet' && (
        <p className="section-description">The faucet is available only for the XRPL testnet.</p>
      )}
      <form ref={formRef} onSubmit={handleSubmit} className="tx-form">
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
        <div className="transaction-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void handleSign()}
            disabled={busy || !canSign}
          >
            Sign Transaction
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !canSubmit}>
            Sign &amp; Submit Transaction
          </button>
        </div>
      </form>
      {!canSign && <p className="section-description">This wallet cannot sign XRPL transactions.</p>}
      {!canSubmit && (
        <p className="section-description">This wallet cannot sign and submit XRPL transactions.</p>
      )}
      {result && (
        <div className="result" role={result.kind === 'error' ? 'alert' : 'status'}>
          {result.kind === 'loading' && <div className="loading">{result.message}</div>}
          {result.kind === 'error' && <div className="error">Failed: {result.message}</div>}
          {result.kind === 'success' && (
            <div className="success">
              <h3>{result.title}</h3>
              {result.details.map((detail) => (
                <p key={detail.label}>
                  <strong>{detail.label}:</strong> <code>{detail.value}</code>
                </p>
              ))}
              {result.info && <p className="info">{result.info}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
