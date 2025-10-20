# React Integration Guide

This guide shows how to integrate XRPL Connect into a React application.

## Table of Contents

- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Context Provider Pattern](#context-provider-pattern)
- [Custom Hooks](#custom-hooks)
- [Component Examples](#component-examples)
- [TypeScript Support](#typescript-support)
- [Best Practices](#best-practices)

## Installation

```bash
# Install UI package and wallet adapters
npm install @xrpl-connect/ui @xrpl-connect/adapter-xaman @xrpl-connect/adapter-crossmark

# Or with pnpm
pnpm add @xrpl-connect/ui @xrpl-connect/adapter-xaman @xrpl-connect/adapter-crossmark
```

## Basic Setup

### Method 1: Web Component (Recommended)

The easiest way to use XRPL Connect in React is with the web component:

**1. Create Wallet Manager:**

```typescript
// lib/walletManager.ts
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';

export const walletManager = new WalletManager({
  adapters: [
    new XamanAdapter(),
    new CrossmarkAdapter(),
  ],
  network: 'testnet',
  autoConnect: true,
});
```

**2. Use Web Component in React:**

```tsx
// App.tsx
import { useEffect, useRef } from 'react';
import '@xrpl-connect/ui';
import { walletManager } from './lib/walletManager';

// Declare custom element type for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'xrpl-wallet-connector': any;
    }
  }
}

function App() {
  const connectorRef = useRef<any>(null);

  useEffect(() => {
    // Connect UI component to wallet manager
    if (connectorRef.current) {
      connectorRef.current.setWalletManager(walletManager);
    }
  }, []);

  const openConnector = () => {
    connectorRef.current?.open();
  };

  const disconnect = async () => {
    await walletManager.disconnect();
  };

  return (
    <div>
      <h1>XRPL Wallet Demo</h1>

      {walletManager.connected ? (
        <div>
          <p>Connected: {walletManager.account?.address}</p>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      ) : (
        <button onClick={openConnector}>Connect Wallet</button>
      )}

      {/* Web Component */}
      <xrpl-wallet-connector
        ref={connectorRef}
        background-color="#1a202c"
        primary-wallet="xaman"
      />
    </div>
  );
}

export default App;
```

The web component provides a complete UI for wallet selection, QR codes, and connection states - no need to build your own UI!

## Context Provider Pattern

The recommended approach for React is to use Context API:

### 1. Create Wallet Context

```typescript
// contexts/WalletContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import type { AccountInfo, SignedTransaction, SignedMessage } from '@xrpl-connect/core';
import { walletManager } from '../lib/walletManager';

interface WalletContextValue {
  account: AccountInfo | null;
  connected: boolean;
  connecting: boolean;
  connect: (walletId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  sign: (transaction: any) => Promise<SignedTransaction>;
  signMessage: (message: string) => Promise<SignedMessage>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountInfo | null>(
    walletManager.account
  );
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    // Event handlers
    const handleConnect = (acc: AccountInfo) => {
      setAccount(acc);
      setConnecting(false);
    };

    const handleDisconnect = () => {
      setAccount(null);
      setConnecting(false);
    };

    const handleAccountChanged = (acc: AccountInfo) => {
      setAccount(acc);
    };

    // Register event listeners
    walletManager.on('connect', handleConnect);
    walletManager.on('disconnect', handleDisconnect);
    walletManager.on('accountChanged', handleAccountChanged);

    // Cleanup
    return () => {
      walletManager.off('connect', handleConnect);
      walletManager.off('disconnect', handleDisconnect);
      walletManager.off('accountChanged', handleAccountChanged);
    };
  }, []);

  const connect = async (walletId: string) => {
    setConnecting(true);
    try {
      await walletManager.connect(walletId);
    } catch (error) {
      setConnecting(false);
      throw error;
    }
  };

  const disconnect = async () => {
    await walletManager.disconnect();
  };

  const sign = async (transaction: any) => {
    return await walletManager.sign(transaction);
  };

  const signMessage = async (message: string) => {
    return await walletManager.signMessage(message);
  };

  return (
    <WalletContext.Provider
      value={{
        account,
        connected: !!account,
        connecting,
        connect,
        disconnect,
        sign,
        signMessage,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
```

### 2. Wrap Your App

```tsx
// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { WalletProvider } from './contexts/WalletContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </React.StrictMode>
);
```

### 3. Use in Components

```tsx
// components/WalletButton.tsx
import { useWallet } from '../contexts/WalletContext';

export function WalletButton() {
  const { account, connected, connecting, connect, disconnect } = useWallet();

  if (connected) {
    return (
      <button onClick={disconnect}>
        Disconnect ({account!.address.slice(0, 8)}...)
      </button>
    );
  }

  return (
    <div>
      <button onClick={() => connect('xaman')} disabled={connecting}>
        {connecting ? 'Connecting...' : 'Connect Xaman'}
      </button>
      <button onClick={() => connect('crossmark')} disabled={connecting}>
        {connecting ? 'Connecting...' : 'Connect Crossmark'}
      </button>
    </div>
  );
}
```

## Custom Hooks

### useWalletConnection Hook

```typescript
// hooks/useWalletConnection.ts
import { useState, useEffect } from 'react';
import { walletManager } from '../lib/walletManager';
import type { AccountInfo } from '@xrpl-connect/core';

export function useWalletConnection() {
  const [account, setAccount] = useState<AccountInfo | null>(
    walletManager.account
  );
  const [isConnected, setIsConnected] = useState(walletManager.connected);

  useEffect(() => {
    const handleConnect = (acc: AccountInfo) => {
      setAccount(acc);
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setAccount(null);
      setIsConnected(false);
    };

    walletManager.on('connect', handleConnect);
    walletManager.on('disconnect', handleDisconnect);

    return () => {
      walletManager.off('connect', handleConnect);
      walletManager.off('disconnect', handleDisconnect);
    };
  }, []);

  return { account, isConnected };
}
```

### useWalletSign Hook

```typescript
// hooks/useWalletSign.ts
import { useState } from 'react';
import { walletManager } from '../lib/walletManager';
import type { SignedTransaction } from '@xrpl-connect/core';

export function useWalletSign() {
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sign = async (transaction: any): Promise<SignedTransaction | null> => {
    setIsSigning(true);
    setError(null);

    try {
      const signed = await walletManager.sign(transaction);
      return signed;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsSigning(false);
    }
  };

  return { sign, isSigning, error };
}
```

### useAvailableWallets Hook

```typescript
// hooks/useAvailableWallets.ts
import { useState, useEffect } from 'react';
import { walletManager } from '../lib/walletManager';
import type { WalletAdapter } from '@xrpl-connect/core';

export function useAvailableWallets() {
  const [wallets, setWallets] = useState<WalletAdapter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    walletManager.getAvailableWallets().then((available) => {
      setWallets(available);
      setLoading(false);
    });
  }, []);

  return { wallets, loading };
}
```

## Component Examples

### Wallet Selector Component

```tsx
// components/WalletSelector.tsx
import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useAvailableWallets } from '../hooks/useAvailableWallets';

export function WalletSelector() {
  const { connect } = useWallet();
  const { wallets, loading } = useAvailableWallets();
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  const handleConnect = async (walletId: string) => {
    setSelectedWallet(walletId);
    try {
      await connect(walletId);
    } catch (error) {
      console.error('Connection failed:', error);
      setSelectedWallet(null);
    }
  };

  if (loading) {
    return <div>Loading wallets...</div>;
  }

  return (
    <div className="wallet-selector">
      <h2>Select Wallet</h2>
      <div className="wallet-grid">
        {wallets.map((wallet) => (
          <button
            key={wallet.id}
            onClick={() => handleConnect(wallet.id)}
            disabled={selectedWallet === wallet.id}
            className="wallet-card"
          >
            {wallet.icon && (
              <img src={wallet.icon} alt={wallet.name} width={48} height={48} />
            )}
            <span>{wallet.name}</span>
            {selectedWallet === wallet.id && <span>Connecting...</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Payment Form Component

```tsx
// components/PaymentForm.tsx
import { useState, FormEvent } from 'react';
import { useWallet } from '../contexts/WalletContext';

export function PaymentForm() {
  const { account, sign } = useWallet();
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!account) return;

    setIsSending(true);
    setTxHash(null);

    try {
      const transaction = {
        TransactionType: 'Payment',
        Account: account.address,
        Destination: destination,
        Amount: String(parseFloat(amount) * 1_000_000), // Convert to drops
      };

      const signed = await sign(transaction);
      setTxHash(signed.hash);
      setDestination('');
      setAmount('');
    } catch (error) {
      console.error('Transaction failed:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <h2>Send Payment</h2>

      <div className="form-group">
        <label htmlFor="destination">Destination Address</label>
        <input
          id="destination"
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="amount">Amount (XRP)</label>
        <input
          id="amount"
          type="number"
          step="0.000001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1.5"
          required
        />
      </div>

      <button type="submit" disabled={isSending}>
        {isSending ? 'Signing...' : 'Send Payment'}
      </button>

      {txHash && (
        <div className="success">
          Transaction Hash: <code>{txHash}</code>
        </div>
      )}
    </form>
  );
}
```

### Account Display Component

```tsx
// components/AccountDisplay.tsx
import { useWallet } from '../contexts/WalletContext';

export function AccountDisplay() {
  const { account, connected, disconnect } = useWallet();

  if (!connected || !account) {
    return null;
  }

  return (
    <div className="account-display">
      <div className="account-info">
        <div>
          <strong>Address:</strong>
          <code>{account.address}</code>
        </div>
        <div>
          <strong>Network:</strong>
          <span>{account.network.name}</span>
        </div>
      </div>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

### Message Signing Component

```tsx
// components/MessageSigner.tsx
import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';

export function MessageSigner() {
  const { signMessage } = useWallet();
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  const handleSign = async () => {
    if (!message) return;

    setIsSigning(true);
    try {
      const signed = await signMessage(message);
      setSignature(signed.signature);
    } catch (error) {
      console.error('Signing failed:', error);
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="message-signer">
      <h2>Sign Message</h2>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Enter message to sign..."
        rows={4}
      />

      <button onClick={handleSign} disabled={isSigning || !message}>
        {isSigning ? 'Signing...' : 'Sign Message'}
      </button>

      {signature && (
        <div className="signature-result">
          <strong>Signature:</strong>
          <code>{signature}</code>
        </div>
      )}
    </div>
  );
}
```

## TypeScript Support

Full TypeScript example with proper typing:

```typescript
// types/wallet.ts
import type { AccountInfo, WalletAdapter, SignedTransaction } from '@xrpl-connect/core';

export interface WalletState {
  account: AccountInfo | null;
  connected: boolean;
  connecting: boolean;
}

export interface WalletActions {
  connect: (walletId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  sign: (transaction: Transaction) => Promise<SignedTransaction>;
}

export interface Transaction {
  TransactionType: string;
  Account: string;
  [key: string]: any;
}
```

## Best Practices

### 1. Use Context for Global State

Wrap your app in a WalletProvider to avoid prop drilling:

```tsx
<WalletProvider>
  <App />
</WalletProvider>
```

### 2. Memoize Event Handlers

```tsx
const handleConnect = useCallback((account: AccountInfo) => {
  setAccount(account);
}, []);

useEffect(() => {
  walletManager.on('connect', handleConnect);
  return () => walletManager.off('connect', handleConnect);
}, [handleConnect]);
```

### 3. Handle Loading States

```tsx
function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if wallet is already connected
    if (walletManager.connected) {
      setAccount(walletManager.account);
    }
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return <YourApp />;
}
```

### 4. Error Boundaries

```tsx
import { Component, ReactNode } from 'react';

class WalletErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Wallet error:', error);
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong with the wallet connection.</div>;
    }

    return this.props.children;
  }
}
```

### 5. Clean Up Subscriptions

Always clean up event listeners in useEffect:

```tsx
useEffect(() => {
  const handler = (data: any) => {
    // Handle event
  };

  walletManager.on('event', handler);

  return () => {
    walletManager.off('event', handler);
  };
}, []);
```

## Next.js Integration

For Next.js applications:

```tsx
// app/providers.tsx
'use client';

import { WalletProvider } from '@/contexts/WalletContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}

// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## Complete Example App

```tsx
// App.tsx
import { WalletSelector } from './components/WalletSelector';
import { AccountDisplay } from './components/AccountDisplay';
import { PaymentForm } from './components/PaymentForm';
import { MessageSigner } from './components/MessageSigner';
import { useWallet } from './contexts/WalletContext';

function App() {
  const { connected } = useWallet();

  return (
    <div className="app">
      <header>
        <h1>XRPL Wallet Demo</h1>
        <AccountDisplay />
      </header>

      <main>
        {!connected ? (
          <WalletSelector />
        ) : (
          <div className="connected-content">
            <PaymentForm />
            <MessageSigner />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
```

## Additional Resources

- [Getting Started Guide](./GETTING_STARTED.md)
- [Vanilla JS Guide](./VANILLA_JS.md)
- [Vue Guide](./VUE.md)
