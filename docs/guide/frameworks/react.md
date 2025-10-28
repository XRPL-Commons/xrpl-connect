# React

Integrate XRPL-Connect into your React application with hooks.

## Installation

```bash
npm install xrpl-connect xrpl
```

## Basic Setup

Here's a minimal React component using XRPL-Connect:

```jsx
import { useEffect, useRef, useState } from 'react';
import { WalletManager } from 'xrpl-connect';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';

function WalletConnector() {
  const connectorRef = useRef(null);
  const [walletManager, setWalletManager] = useState(null);
  const [account, setAccount] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initialize WalletManager
    const manager = new WalletManager({
      adapters: [
        new XamanAdapter({ apiKey: 'YOUR_API_KEY' }),
        new CrossmarkAdapter(),
      ],
      network: 'testnet',
      autoConnect: true,
    });

    // Set up event listeners
    manager.on('connect', (acc) => {
      setAccount(acc);
      setError(null);
    });

    manager.on('disconnect', () => {
      setAccount(null);
    });

    manager.on('error', (err) => {
      setError(err.message);
    });

    setWalletManager(manager);

    // Connect component to manager
    if (connectorRef.current) {
      connectorRef.current.setWalletManager(manager);
    }

    // Cleanup
    return () => {
      manager.disconnect();
    };
  }, []);

  const handleDisconnect = async () => {
    if (walletManager) {
      await walletManager.disconnect();
    }
  };

  return (
    <div>
      <xrpl-wallet-connector
        ref={connectorRef}
        primary-wallet="xaman"
      />

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {account && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
          <h3>Connected Account</h3>
          <p><strong>Address:</strong> {account.address}</p>
          <p><strong>Network:</strong> {account.network.name}</p>
          <button onClick={handleDisconnect}>Disconnect</button>
        </div>
      )}
    </div>
  );
}

export default WalletConnector;
```

## Creating a Custom Hook

For better reusability, create a custom hook:

```jsx
import { useEffect, useRef, useState } from 'react';
import { WalletManager } from 'xrpl-connect';

function useWalletManager(adapters, network = 'testnet') {
  const [walletManager, setWalletManager] = useState(null);
  const [account, setAccount] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const connectorRef = useRef(null);

  useEffect(() => {
    const manager = new WalletManager({
      adapters,
      network,
      autoConnect: true,
    });

    manager.on('connect', (acc) => {
      setAccount(acc);
      setConnected(true);
      setError(null);
    });

    manager.on('disconnect', () => {
      setAccount(null);
      setConnected(false);
    });

    manager.on('error', (err) => {
      setError(err);
    });

    setWalletManager(manager);
    setLoading(false);

    if (connectorRef.current) {
      connectorRef.current.setWalletManager(manager);
    }

    return () => {
      manager.disconnect();
    };
  }, [adapters, network]);

  const disconnect = async () => {
    if (walletManager) {
      await walletManager.disconnect();
    }
  };

  return {
    walletManager,
    account,
    connected,
    error,
    loading,
    connectorRef,
    disconnect,
  };
}

export default useWalletManager;
```

Then use it in your component:

```jsx
import useWalletManager from './useWalletManager';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

function App() {
  const { account, connected, connectorRef, disconnect } = useWalletManager([
    new XamanAdapter({ apiKey: 'YOUR_API_KEY' }),
  ]);

  return (
    <div>
      <xrpl-wallet-connector ref={connectorRef} />
      {connected && <button onClick={disconnect}>Disconnect</button>}
    </div>
  );
}
```

## Signing Transactions

Sign transactions with React:

```jsx
import { useState } from 'react';

function PaymentForm({ walletManager }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!walletManager?.connected) {
      setError('Wallet not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await walletManager.signAndSubmit({
        TransactionType: 'Payment',
        Account: walletManager.account.address,
        Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
        Amount: '1000000',
      });

      setResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit" disabled={loading || !walletManager?.connected}>
        {loading ? 'Sending...' : 'Send Payment'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && <p style={{ color: 'green' }}>Success! Hash: {result.hash}</p>}
    </form>
  );
}
```

## Context API Pattern

For larger apps, use React Context to share wallet state:

```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { WalletManager } from 'xrpl-connect';

const WalletContext = createContext();

export function WalletProvider({ children, adapters, network = 'testnet' }) {
  const [walletManager, setWalletManager] = useState(null);
  const [account, setAccount] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const manager = new WalletManager({
      adapters,
      network,
      autoConnect: true,
    });

    manager.on('connect', (acc) => {
      setAccount(acc);
      setConnected(true);
    });

    manager.on('disconnect', () => {
      setAccount(null);
      setConnected(false);
    });

    setWalletManager(manager);

    return () => manager.disconnect();
  }, [adapters, network]);

  return (
    <WalletContext.Provider value={{ walletManager, account, connected }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
```

Usage:

```jsx
import { WalletProvider, useWallet } from './WalletContext';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

function App() {
  return (
    <WalletProvider adapters={[new XamanAdapter({ apiKey: 'YOUR_API_KEY' })]}>
      <YourApp />
    </WalletProvider>
  );
}

function YourApp() {
  const { account, connected } = useWallet();
  return (
    <div>
      {connected && <p>Connected: {account.address}</p>}
    </div>
  );
}
```

## Error Handling

Handle errors gracefully:

```jsx
function WalletError({ error }) {
  if (!error) return null;

  let message = error.message;

  if (error.code === 'WALLET_NOT_FOUND') {
    message = 'Please install a wallet to continue';
  } else if (error.code === 'CONNECTION_FAILED') {
    message = 'Failed to connect. Please try again.';
  } else if (error.code === 'SIGN_FAILED') {
    message = 'You rejected the transaction';
  }

  return (
    <div style={{ padding: '10px', background: '#fee', color: '#c00', borderRadius: '4px' }}>
      {message}
    </div>
  );
}
```

## TypeScript Support

XRPL-Connect has full TypeScript support:

```typescript
import { useEffect, useRef, useState } from 'react';
import { WalletManager, Account, WalletError } from 'xrpl-connect';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

interface WalletState {
  walletManager: WalletManager | null;
  account: Account | null;
  connected: boolean;
  error: WalletError | null;
}

function WalletConnector(): JSX.Element {
  const connectorRef = useRef<HTMLElement>(null);
  const [state, setState] = useState<WalletState>({
    walletManager: null,
    account: null,
    connected: false,
    error: null,
  });

  useEffect(() => {
    const manager = new WalletManager({
      adapters: [new XamanAdapter({ apiKey: 'YOUR_API_KEY' })],
      network: 'testnet',
      autoConnect: true,
    });

    manager.on('connect', (account: Account) => {
      setState((prev) => ({
        ...prev,
        account,
        connected: true,
        error: null,
      }));
    });

    manager.on('error', (error: WalletError) => {
      setState((prev) => ({ ...prev, error }));
    });

    setState((prev) => ({ ...prev, walletManager: manager }));

    if (connectorRef.current) {
      connectorRef.current.setWalletManager(manager);
    }
  }, []);

  return (
    <div>
      <xrpl-wallet-connector ref={connectorRef} />
      {state.error && <p>Error: {state.error.message}</p>}
      {state.connected && <p>Connected: {state.account?.address}</p>}
    </div>
  );
}

export default WalletConnector;
```

## Best Practices

1. **Memoize Adapters** - Use `useMemo` to prevent unnecessary recreation:
   ```jsx
   const adapters = useMemo(
     () => [new XamanAdapter({ apiKey: 'YOUR_API_KEY' })],
     []
   );
   ```

2. **Cleanup on Unmount** - Always call `disconnect()` in cleanup functions

3. **Use TypeScript** - Full type support available

4. **Context for Global State** - Use React Context for wallet state across components

5. **Error Boundaries** - Wrap wallet components in error boundaries

6. **Test Event Listeners** - Test with different wallets to ensure events fire

7. **Debounce Event Handlers** - Consider debouncing rapid state changes

## Common Patterns

### Gated Content

```jsx
function GatedFeature() {
  const { connected, account } = useWallet();

  if (!connected) {
    return <p>Please connect your wallet to use this feature</p>;
  }

  return <p>Welcome {account?.address}</p>;
}
```

### Auto-Connect Hook

```jsx
function useAutoConnect() {
  const { walletManager, connected } = useWallet();

  const handleAutoConnect = async () => {
    if (!connected && walletManager?.adapters.length) {
      try {
        // Try first available wallet
        await walletManager.adapters[0].connect?.();
      } catch (error) {
        console.error('Auto-connect failed:', error);
      }
    }
  };

  return { handleAutoConnect };
}
```
