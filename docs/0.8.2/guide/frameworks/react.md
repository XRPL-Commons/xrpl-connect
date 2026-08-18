---
description: Integrate XRPL-Connect into your React application using hooks and best practices.
---

<!-- Generated from v0.8.2; do not edit. -->

::: warning Archived documentation
You are reading the XRPL Connect 0.8.2 documentation. [Switch to 1.0.0](/) or follow
the [0.8.2 → 1.0.0 migration guide](/guide/migration-v1).
:::


# React & Next.js

Integrate XRPL-Connect into your React application with hooks. This guide covers both standard React and Next.js applications.

## Complete Example Application

We provide a comprehensive React example application that demonstrates all XRPL-Connect features:

**📁 [View the React Example →](https://github.com/XRPL-Commons/xrpl-connect/tree/main/examples/react)**

### What's Included

The example demonstrates:

- ✅ Multiple wallet adapter support (Xaman, WalletConnect, Crossmark, GemWallet, Ledger)
- ✅ Custom React hooks for wallet management
- ✅ React Context API for global wallet state
- ✅ Transaction and message signing forms
- ✅ Dynamic theme switching
- ✅ Real-time event logging
- ✅ Proper TypeScript integration with web components
- ✅ Best practices for web component lifecycle in React

### Project Structure

```
examples/react/
├── src/
│   ├── App.tsx                      # Main app component
│   ├── main.tsx                     # Entry point
│   ├── components/
│   │   ├── WalletConnector.tsx     # Web component wrapper
│   │   ├── AccountInfo.tsx         # Display connected account
│   │   ├── TransactionForm.tsx     # Sign transactions
│   │   ├── MessageSignForm.tsx     # Sign messages
│   │   ├── ThemeSelector.tsx       # Switch themes
│   │   └── EventLog.tsx            # Display wallet events
│   ├── context/
│   │   └── WalletContext.tsx       # Global wallet state
│   ├── hooks/
│   │   ├── useWalletManager.ts     # Initialize WalletManager
│   │   └── useWalletConnector.ts   # Connect to web component
│   └── types/
│       └── index.ts                # TypeScript definitions
```

## Installation

```bash
npm install xrpl-connect@0.8.2 xrpl
```

## Quick Start

### 1. Register Web Components

**File: `src/main.tsx`**

In your entry point, import `xrpl-connect` to register the web component:

```typescript
// src/main.tsx
import 'xrpl-connect'; // Register web components
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 2. TypeScript Declarations

**File: `src/vite-env.d.ts`** (or `src/react-app-env.d.ts` for Create React App)

Create TypeScript declarations for the web component:

```typescript
// src/vite-env.d.ts
/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements {
    'xrpl-wallet-connector': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        'primary-wallet'?: string;
        ref?: React.Ref<any>;
      },
      HTMLElement
    >;
  }
}
```

### 3. Create Wallet Context

**File: `src/context/WalletContext.tsx`**

Create a context to share wallet state across your app:

```typescript
// src/context/WalletContext.tsx
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { WalletManager } from 'xrpl-connect';

interface AccountInfo {
  address: string;
  network: string;
  walletName: string;
}

interface WalletContextType {
  walletManager: WalletManager | null;
  isConnected: boolean;
  accountInfo: AccountInfo | null;
  setWalletManager: (manager: WalletManager) => void;
  setIsConnected: (connected: boolean) => void;
  setAccountInfo: (info: AccountInfo | null) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletManager, setWalletManagerState] = useState<WalletManager | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);

  const setWalletManager = useCallback((manager: WalletManager) => {
    setWalletManagerState(manager);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        walletManager,
        isConnected,
        accountInfo,
        setWalletManager,
        setIsConnected,
        setAccountInfo,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
```

### 4. Create WalletManager Hook

**File: `src/hooks/useWalletManager.ts`**

Create a hook to initialize and manage the WalletManager:

```typescript
// src/hooks/useWalletManager.ts
import { useEffect } from 'react';
import {
  WalletManager,
  XamanAdapter,
  WalletConnectAdapter,
  CrossmarkAdapter,
  GemWalletAdapter,
  LedgerAdapter,
} from 'xrpl-connect';
import { useWallet } from '../context/WalletContext';

// Configuration - ADD YOUR API KEYS HERE
const XAMAN_API_KEY = 'YOUR_XAMAN_API_KEY';
const WALLETCONNECT_PROJECT_ID = 'YOUR_WALLETCONNECT_PROJECT_ID';

export function useWalletManager() {
  const { setWalletManager, setIsConnected, setAccountInfo } = useWallet();

  useEffect(() => {
    const manager = new WalletManager({
      adapters: [
        new XamanAdapter({ apiKey: XAMAN_API_KEY }),
        new WalletConnectAdapter({ projectId: WALLETCONNECT_PROJECT_ID }),
        new CrossmarkAdapter(),
        new GemWalletAdapter(),
        new LedgerAdapter(), // Hardware wallet support
      ],
      network: 'testnet',
      autoConnect: true,
      logger: { level: 'info' },
    });

    setWalletManager(manager);

    // Event listeners
    manager.on('connect', (account) => {
      updateConnectionState(manager);
    });

    manager.on('disconnect', () => {
      updateConnectionState(manager);
    });

    // Check initial connection
    if (manager.connected) {
      updateConnectionState(manager);
    }
  }, [setWalletManager, setIsConnected, setAccountInfo]);

  const updateConnectionState = (manager: WalletManager) => {
    const connected = manager.connected;
    setIsConnected(connected);

    if (connected) {
      const account = manager.account;
      const wallet = manager.wallet;

      if (account && wallet) {
        setAccountInfo({
          address: account.address,
          network: `${account.network.name} (${account.network.id})`,
          walletName: wallet.name,
        });
      }
    } else {
      setAccountInfo(null);
    }
  };
}
```

### 5. Create Web Component Connector Hook

**File: `src/hooks/useWalletConnector.ts`**

Create a hook to properly connect the web component with the WalletManager:

```typescript
// src/hooks/useWalletConnector.ts
import { useEffect, useRef } from 'react';
import type { WalletManager } from 'xrpl-connect';

export function useWalletConnector(walletManager: WalletManager | null) {
  const walletConnectorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!walletConnectorRef.current || !walletManager) return;

    const setupConnector = async () => {
      // Wait for custom element to be defined
      await customElements.whenDefined('xrpl-wallet-connector');

      // Small delay to ensure element is fully initialized
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (
        walletConnectorRef.current &&
        typeof (walletConnectorRef.current as any).setWalletManager === 'function'
      ) {
        (walletConnectorRef.current as any).setWalletManager(walletManager);
      }
    };

    setupConnector();
  }, [walletManager]);

  return walletConnectorRef;
}
```

### 6. Create Wallet Connector Component

**File: `src/components/WalletConnector.tsx`**

Wrap the web component in a React component:

```typescript
// src/components/WalletConnector.tsx
import { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { useWalletConnector } from '../hooks/useWalletConnector';

const THEMES = {
  dark: {
    '--xc-background-color': '#1a202c',
    '--xc-text-color': '#F5F4E7',
    '--xc-primary-color': '#3b99fc',
  },
  light: {
    '--xc-background-color': '#ffffff',
    '--xc-text-color': '#111111',
    '--xc-primary-color': '#2563eb',
  },
};

export function WalletConnector() {
  const { walletManager } = useWallet();
  const walletConnectorRef = useWalletConnector(walletManager);
  const [currentTheme] = useState<'dark' | 'light'>('dark');

  return (
    <xrpl-wallet-connector
      ref={walletConnectorRef}
      id="wallet-connector"
      style={{
        ...THEMES[currentTheme],
        '--xc-border-radius': '12px',
      } as any}
      primary-wallet="xaman"
    />
  );
}
```

### 7. Put It All Together

**File: `src/App.tsx`**

Create your main app component:

```typescript
// src/App.tsx
import { WalletProvider, useWallet } from './context/WalletContext';
import { useWalletManager } from './hooks/useWalletManager';
import { WalletConnector } from './components/WalletConnector';

function AppContent() {
  const { accountInfo, isConnected } = useWallet();
  useWalletManager();

  return (
    <div>
      <h1>XRPL Connect Demo</h1>

      <WalletConnector />

      {isConnected && accountInfo && (
        <div>
          <h2>Connected Account</h2>
          <p><strong>Address:</strong> {accountInfo.address}</p>
          <p><strong>Network:</strong> {accountInfo.network}</p>
          <p><strong>Wallet:</strong> {accountInfo.walletName}</p>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}

export default App;
```

## Signing Transactions

**File: `src/components/TransactionForm.tsx`**

Create a transaction form component:

```typescript
// src/components/TransactionForm.tsx
import { useState, FormEvent } from 'react';
import { useWallet } from '../context/WalletContext';

export function TransactionForm() {
  const { walletManager, isConnected } = useWallet();
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!walletManager || !walletManager.account) return;

    try {
      setResult('Signing transaction...');

      const txResult = await walletManager.signAndSubmit({
        TransactionType: 'Payment',
        Account: walletManager.account.address,
        Destination: destination,
        Amount: amount,
      });

      setResult(`Success! Hash: ${(txResult as any).hash}`);
    } catch (error: any) {
      setResult(`Failed: ${error.message}`);
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Destination Address</label>
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT"
          required
        />
      </div>
      <div>
        <label>Amount (drops)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1000000"
          required
        />
        <small>1 XRP = 1,000,000 drops</small>
      </div>
      <button type="submit">Sign & Submit Transaction</button>
      {result && <div>{result}</div>}
    </form>
  );
}
```

## Next.js Integration

XRPL-Connect works seamlessly with Next.js. Here's how to integrate it:

### 1. Mark Components as Client Components

**File: `app/components/WalletConnector.tsx`**

Since XRPL-Connect uses browser APIs, mark your wallet components with `'use client'`:

```typescript
// app/components/WalletConnector.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { WalletManager, XamanAdapter, LedgerAdapter } from 'xrpl-connect';

export default function WalletConnector() {
  const connectorRef = useRef<HTMLElement>(null);
  const [walletManager, setWalletManager] = useState<WalletManager | null>(null);

  useEffect(() => {
    const manager = new WalletManager({
      adapters: [
        new XamanAdapter({ apiKey: process.env.NEXT_PUBLIC_XAMAN_API_KEY || '' }),
        new LedgerAdapter(),
      ],
      network: 'testnet',
      autoConnect: true,
    });

    setWalletManager(manager);

    const setupConnector = async () => {
      await customElements.whenDefined('xrpl-wallet-connector');
      if (connectorRef.current) {
        (connectorRef.current as any).setWalletManager(manager);
      }
    };

    setupConnector();

    return () => {
      manager.disconnect();
    };
  }, []);

  return <xrpl-wallet-connector ref={connectorRef} />;
}
```

### 2. Environment Variables

**File: `.env.local`** (at the root of your Next.js project)

Create an environment variables file:

```bash
NEXT_PUBLIC_XAMAN_API_KEY=your_api_key_here
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

> **Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

### 3. Use the Same Hooks

You can use the same hooks and context pattern shown above. Just add `'use client'` at the top of each file.

### 4. Dynamic Import (Optional)

**File: `app/page.tsx`**

If you want to avoid SSR issues, use dynamic imports:

```typescript
// app/page.tsx
import dynamic from 'next/dynamic';

const WalletConnector = dynamic(
  () => import('./components/WalletConnector'),
  { ssr: false }
);

export default function Home() {
  return (
    <main>
      <h1>My XRPL App</h1>
      <WalletConnector />
    </main>
  );
}
```

## Best Practices

### 1. Wait for Custom Element Definition

Always wait for the custom element to be defined before calling methods:

```typescript
await customElements.whenDefined('xrpl-wallet-connector');
await new Promise((resolve) => setTimeout(resolve, 0));
```

### 2. Cleanup on Unmount

Always disconnect the wallet manager when component unmounts:

```typescript
useEffect(() => {
  const manager = new WalletManager({...});

  return () => {
    manager.disconnect();
  };
}, []);
```

### 3. Use TypeScript

Add proper type definitions for the web component in your TypeScript declarations.

### 4. Context for Global State

Use React Context to share wallet state across components instead of prop drilling.

### 5. Memoize Adapters

Use `useMemo` to prevent unnecessary adapter recreation:

```typescript
const adapters = useMemo(
  () => [new XamanAdapter({ apiKey: XAMAN_API_KEY }), new LedgerAdapter()],
  []
);
```

### 6. Error Boundaries

Wrap wallet components in error boundaries to handle errors gracefully:

```typescript
import { Component, ReactNode } from 'react';

class WalletErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div>Wallet failed to load. Please refresh.</div>;
    }
    return this.props.children;
  }
}
```

## Common Patterns

### Account Display

```typescript
function AccountDisplay() {
  const { accountInfo, isConnected } = useWallet();

  if (!isConnected || !accountInfo) {
    return <p>Please connect your wallet</p>;
  }

  return (
    <div>
      <p>Address: {accountInfo.address}</p>
      <p>Network: {accountInfo.network}</p>
      <p>Wallet: {accountInfo.walletName}</p>
    </div>
  );
}
```

### Protected Component

```typescript
function ProtectedFeature() {
  const { isConnected } = useWallet();

  if (!isConnected) {
    return <p>Please connect your wallet to use this feature</p>;
  }

  return <div>Protected content here</div>;
}
```

### Loading States

```typescript
function WalletStatus() {
  const { walletManager, isConnected } = useWallet();

  if (!walletManager) {
    return <div>Loading wallet...</div>;
  }

  return isConnected ? <div>Connected</div> : <div>Disconnected</div>;
}
```

## Troubleshooting

### "setWalletManager is not a function"

Make sure you're waiting for the custom element to be defined:

```typescript
await customElements.whenDefined('xrpl-wallet-connector');
```

### Next.js: "document is not defined"

Add `'use client'` to your component or use dynamic imports with `{ ssr: false }`.

### TypeScript Errors with Web Component

Make sure you have the JSX type declarations in your `vite-env.d.ts` or `react-app-env.d.ts` file.

### Wallet Doesn't Reconnect on Refresh

Ensure `autoConnect: true` is set in your WalletManager configuration.

## Resources

- [Complete React Example](https://github.com/XRPL-Commons/xrpl-connect/tree/main/examples/react)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/)
- [XRPL Connect API Reference](/0.8.2/guide/api-reference)
