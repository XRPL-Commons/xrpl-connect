import { useDemo } from './context/DemoContext';
import { WalletConnector } from './components/WalletConnector';
import { ThemeSelector } from './components/ThemeSelector';
import { AccountInfo } from './components/AccountInfo';
import { TransactionForm } from './components/TransactionForm';
import { MessageSignForm } from './components/MessageSignForm';
import { EventLog } from './components/EventLog';
import './App.css';

function App() {
  const { statusMessage } = useDemo();

  return (
    <div id="app">
      <header>
        <div className="header-content">
          <h1>🔗 XRPL Connect Demo - React</h1>
          <p>Powered by @xrpl-connect/react — provider, hooks &amp; modal component</p>
        </div>
      </header>

      <main>
        <ThemeSelector />

        <section id="connect-section">
          <h2>Connection Status</h2>
          <p className="section-description">
            Click the <strong>"Connect Wallet"</strong> button above to connect or manage your
            wallet
          </p>
          {statusMessage && (
            <div className={`status-${statusMessage.type}`}>{statusMessage.message}</div>
          )}
        </section>

        <AccountInfo />
        <TransactionForm />
        <MessageSignForm />
        <EventLog />
      </main>

      <footer>
        <p>Built with XRPL Connect - A framework-agnostic wallet toolkit</p>
      </footer>

      <WalletConnector />
    </div>
  );
}

export default App;
