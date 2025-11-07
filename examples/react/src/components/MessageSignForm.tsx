import { useState, FormEvent } from 'react';
import { useWallet } from '../context/WalletContext';

export function MessageSignForm() {
  const { walletManager, isConnected, addEvent } = useWallet();
  const [message, setMessage] = useState('');
  const [result, setResult] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!walletManager) return;

    try {
      setResult('<div class="loading">Signing message...</div>');

      const signed = await walletManager.signMessage(message);

      setResult(`
        <div class="success">
          <h3>Message Signed!</h3>
          <p><strong>Message:</strong> ${signed.message}</p>
          <p><strong>Signature:</strong> <code>${signed.signature ? signed.signature.substring(0, 50) + '...' : 'N/A'}</code></p>
        </div>
      `);

      addEvent('Message Signed', signed);
    } catch (error: any) {
      setResult(`<div class="error">Failed: ${error.message}</div>`);
      addEvent('Message Sign Failed', error);
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <section id="message-section">
      <h2>Sign Message</h2>
      <form onSubmit={handleSubmit} className="msg-form">
        <div className="form-group">
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            placeholder="Enter message to sign..."
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary">
          Sign Message
        </button>
      </form>
      {result && <div className="result" dangerouslySetInnerHTML={{ __html: result }} />}
    </section>
  );
}
