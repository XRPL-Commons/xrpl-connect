import { useState, FormEvent } from 'react';
import { useWallet, useSigner } from '@xrpl-commons/xrpl-connect-react';
import { useDemo } from '../context/DemoContext';

export function MessageSignForm() {
  const { connected, manager } = useWallet();
  const { signMessage } = useSigner();
  const { addEvent } = useDemo();
  const [message, setMessage] = useState('');
  const [result, setResult] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!manager.supports('signMessage')) {
      setResult('<div class="error">This wallet does not support message signing.</div>');
      return;
    }

    try {
      setResult('<div class="loading">Signing message...</div>');

      const signed = await signMessage(message);

      setResult(`
        <div class="success">
          <h3>Message Signed!</h3>
          <p><strong>Message:</strong> ${signed.message}</p>
          <p><strong>Signature:</strong> <code>${signed.signature ? signed.signature.substring(0, 50) + '...' : 'N/A'}</code></p>
        </div>
      `);

      addEvent('Message Signed', signed);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setResult(`<div class="error">Failed: ${msg}</div>`);
      addEvent('Message Sign Failed', { message: msg });
    }
  };

  if (!connected) {
    return null;
  }

  if (!manager.supports('signMessage')) {
    return (
      <section id="message-section">
        <h2>Sign Message</h2>
        <div className="result">
          <div className="error">The connected wallet does not support message signing.</div>
        </div>
      </section>
    );
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
