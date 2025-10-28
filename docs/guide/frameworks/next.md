# Next.js

Integrate XRPL-Connect into your Next.js application with the App Router.

## Installation

```bash
npm install xrpl-connect xrpl
```

## Basic Setup with App Router

Create a client component for wallet functionality:

```typescript
// app/components/WalletConnector.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { WalletManager,XamanAdapter,CrossmarkAdapter } from 'xrpl-connect';
import type { Account, WalletError } from 'xrpl-connect';

export default function WalletConnector() {
  const connectorRef = useRef<HTMLElement>(null);
  const [walletManager, setWalletManager] = useState<WalletManager | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<WalletError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const manager = new WalletManager({
      adapters: [
        new XamanAdapter({ apiKey: process.env.NEXT_PUBLIC_XAMAN_API_KEY || '' }),
        new CrossmarkAdapter(),
      ],
      network: 'testnet',
      autoConnect: true,
    });

    manager.on('connect', (acc: Account) => {
      setAccount(acc);
      setError(null);
    });

    manager.on('disconnect', () => {
      setAccount(null);
    });

    manager.on('error', (err: WalletError) => {
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
  }, []);

  const handleDisconnect = async () => {
    if (walletManager) {
      await walletManager.disconnect();
    }
  };

  if (loading) {
    return <div>Loading wallet...</div>;
  }

  return (
    <div>
      <xrpl-wallet-connector
        ref={connectorRef}
        primary-wallet="xaman"
      />

      {error && (
        <div style={{ color: 'red', marginTop: '20px' }}>
          Error: {error.message}
        </div>
      )}

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
```

## Environment Variables

Create a `.env.local` file with your API keys:

```bash
NEXT_PUBLIC_XAMAN_API_KEY=your_api_key_here
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

> **Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Never expose secrets here.

## Custom Hook

Create a reusable hook for wallet management:

```typescript
// hooks/useWallet.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { WalletManager } from 'xrpl-connect';
import type { Account, WalletError, WalletAdapter } from 'xrpl-connect';

interface UseWalletOptions {
  adapters: WalletAdapter[];
  network?: 'mainnet' | 'testnet' | 'devnet';
}

export function useWallet({ adapters, network = 'testnet' }: UseWalletOptions) {
  const connectorRef = useRef<HTMLElement>(null);
  const [walletManager, setWalletManager] = useState<WalletManager | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<WalletError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const manager = new WalletManager({
      adapters,
      network,
      autoConnect: true,
    });

    manager.on('connect', (acc: Account) => {
      setAccount(acc);
      setConnected(true);
      setError(null);
    });

    manager.on('disconnect', () => {
      setAccount(null);
      setConnected(false);
    });

    manager.on('error', (err: WalletError) => {
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
```

Usage:

```typescript
// app/page.tsx
'use client';

import { useWallet } from '@/hooks/useWallet';
import { XamanAdapter } from 'xrpl-connect';

export default function Home() {
  const { account, connected, connectorRef, disconnect } = useWallet({
    adapters: [
      new XamanAdapter({ apiKey: process.env.NEXT_PUBLIC_XAMAN_API_KEY || '' }),
    ],
  });

  return (
    <main>
      <xrpl-wallet-connector ref={connectorRef} />
      {connected && <button onClick={disconnect}>Disconnect</button>}
    </main>
  );
}
```

## Context Provider

Create a provider for global wallet state:

```typescript
// app/providers/WalletProvider.tsx
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { XamanAdapte,CrossmarkAdapter } from 'xrpl-connect';
import type { Account, WalletManager, WalletError } from 'xrpl-connect';

interface WalletContextType {
  walletManager: WalletManager | null;
  account: Account | null;
  connected: boolean;
  error: WalletError | null;
  disconnect: () => Promise<void>;
  connectorRef: React.RefObject<HTMLElement>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet({
    adapters: [
      new XamanAdapter({ apiKey: process.env.NEXT_PUBLIC_XAMAN_API_KEY || '' }),
      new CrossmarkAdapter(),
    ],
  });

  return (
    <WalletContext.Provider value={wallet}>
      {children}
    </WalletContext.Provider>
  );
}

export function useProvidedWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useProvidedWallet must be used within WalletProvider');
  }
  return context;
}
```

Wrap your app with the provider:

```typescript
// app/layout.tsx
import { WalletProvider } from './providers/WalletProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html>
      <body>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
```

## Signing Transactions

Example transaction handler:

```typescript
// app/components/PaymentForm.tsx
'use client';

import { useState } from 'react';
import { useProvidedWallet } from '@/app/providers/WalletProvider';

export default function PaymentForm() {
  const { walletManager, connected } = useProvidedWallet();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    if (!walletManager?.connected) {
      setError('Wallet not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const txResult = await walletManager.signAndSubmit({
        TransactionType: 'Payment',
        Account: walletManager.account!.address,
        Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
        Amount: '1000000',
      });

      setResult(txResult);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handlePayment} disabled={loading || !connected}>
        {loading ? 'Sending...' : 'Send Payment'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && <p style={{ color: 'green' }}>Success! Hash: {result.hash}</p>}
    </div>
  );
}
```

## API Routes for Backend Integration

Sign transactions on the backend for security:

```typescript
// app/api/transactions/sign/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { transaction } = await request.json();

    // Validate transaction on backend
    if (!transaction.Account || !transaction.Destination) {
      return NextResponse.json(
        { error: 'Invalid transaction' },
        { status: 400 }
      );
    }

    // You could use xrpl-connect server-side here
    // const result = await walletManager.signAndSubmit(transaction);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

## Handling SSR Issues

The `xrpl-wallet-connector` web component is browser-only. Handle SSR with dynamic imports:

```typescript
// app/components/ClientWalletConnector.tsx
import dynamic from 'next/dynamic';

const WalletConnector = dynamic(
  () => import('./WalletConnector'),
  { ssr: false }
);

export default WalletConnector;
```

## Error Handling and Loading States

```typescript
// app/components/WalletSection.tsx
'use client';

import { Suspense } from 'react';
import { useProvidedWallet } from '@/app/providers/WalletProvider';

function WalletContent() {
  const { account, error, loading } = useProvidedWallet();

  if (loading) {
    return <div>Loading wallet...</div>;
  }

  if (error) {
    return (
      <div className="error">
        Failed to connect: {error.message}
      </div>
    );
  }

  return (
    <div>
      {account ? (
        <p>Connected: {account.address}</p>
      ) : (
        <p>Click above to connect wallet</p>
      )}
    </div>
  );
}

export default function WalletSection() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WalletContent />
    </Suspense>
  );
}
```

## Middleware for Protected Routes

Protect routes that require a connected wallet:

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // This runs on the server, so we can't directly check wallet connection
  // Instead, use client-side guards in your components
  return NextResponse.next();
}

export const config = {
  matcher: ['/protected/:path*'],
};
```

Protect routes client-side:

```typescript
// app/protected/layout.tsx
'use client';

import { ReactNode } from 'react';
import { useProvidedWallet } from '@/app/providers/WalletProvider';
import { redirect } from 'next/navigation';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { connected, loading } = useProvidedWallet();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!connected) {
    redirect('/');
  }

  return <>{children}</>;
}
```

## Best Practices

1. **Use `'use client'`** - Mark wallet components as client components

2. **Environment Variables** - Keep API keys in `.env.local`

3. **Dynamic Imports** - Use `dynamic()` for browser-only components

4. **Error Handling** - Always catch and handle wallet errors

5. **Loading States** - Show loading indicators during initialization

6. **Type Safety** - Use TypeScript for type checking

7. **Context Provider** - Use Context for global wallet state

8. **API Routes** - Consider moving sensitive operations to API routes

## Testing

Example test with Vitest:

```typescript
import { render, screen } from '@testing-library/react';
import { WalletProvider } from '@/app/providers/WalletProvider';
import WalletConnector from '@/app/components/WalletConnector';

describe('WalletConnector', () => {
  it('should render wallet connector', () => {
    render(
      <WalletProvider>
        <WalletConnector />
      </WalletProvider>
    );

    expect(screen.getByText(/Loading wallet/i)).toBeInTheDocument();
  });
});
```
