import { useEffect, useState } from 'react';
import { useDemo } from './context/DemoContext';
import { useWallet } from '@xrpl-commons/xrpl-connect-react';
import { WalletConnector } from './components/WalletConnector';
import { ThemeSelector } from './components/ThemeSelector';
import { AccountInfo } from './components/AccountInfo';
import { TransactionForm } from './components/TransactionForm';
import { MessageSignForm } from './components/MessageSignForm';
import { EventLog } from './components/EventLog';
import './App.css';

function App() {
  const { statusMessage, showStatus } = useDemo();
  const { connecting, error, disconnect, account } = useWallet();
  const [restoring, setRestoring] = useState(connecting);

  useEffect(() => {
    if (!connecting) setRestoring(false);
  }, [connecting]);

  const cancelConnection = async () => {
    try {
      await disconnect();
      showStatus('Connection cancelled. Choose a wallet to retry.', 'info');
    } catch (error) {
      showStatus(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  return (
    <div id="app">
      <header>
        <div className="header-content">
          <h1>🔗 XRPL Connect Demo - React</h1>
          <p>Powered by @xrpl-commons/xrpl-connect-react — provider, hooks &amp; modal component</p>
        </div>
      </header>

      <main>
        <ThemeSelector />

        <section id="connect-section">
          <h2>Connection Status</h2>
          <p className="section-description">
            {restoring
              ? 'Restoring your wallet session or finishing sign-in… Your wallet controls will appear when it is ready.'
              : 'Click the "Connect Wallet" button above to connect or manage your wallet'}
          </p>
          {statusMessage && (
            <div className={`status-${statusMessage.type}`} role="status">
              {statusMessage.message}
            </div>
          )}
          {restoring && !statusMessage && (
            <div className="status-info" role="status" aria-live="polite">
              Restoring a wallet session or finishing sign-in…
            </div>
          )}
          {connecting && !restoring && !statusMessage && (
            <div className="status-info" role="status" aria-live="polite">
              Connecting to your wallet…
            </div>
          )}
          {error && !statusMessage && (
            <div className="status-error" role="alert">
              {error.message}
            </div>
          )}
          {connecting && (
            <button type="button" className="btn-secondary" onClick={() => void cancelConnection()}>
              Cancel connection
            </button>
          )}
        </section>

        <AccountInfo />
        <TransactionForm
          key={account ? `${account.address}:${account.network.id}` : 'disconnected'}
        />
        <MessageSignForm />
        <EventLog />
      </main>

      <footer>
        <p>Built with XRPL Connect - A framework-agnostic wallet toolkit</p>
      </footer>

      <WalletConnector restoring={restoring} />
    </div>
  );
}

export default App;
