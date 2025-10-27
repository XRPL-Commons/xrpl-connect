# @xrpl-connect/xrpl-connect - Code Documentation

## Overview

`@xrpl-connect/xrpl-connect` (often referred to as the "meta-package") is a convenience package that bundles all the XRPL Connect functionality into a single entry point. Instead of importing from multiple packages, developers can import everything they need from a single `xrpl-connect` module.

**Key Responsibility**: Provide a simplified developer experience by re-exporting core functionality, UI components, and all adapters in one convenient location.

---

## What This Package Does

This package acts as a facade or umbrella package that:

1. **Re-exports core functionality** from `@xrpl-connect/core`
2. **Re-exports UI components** from `@xrpl-connect/ui`
3. **Re-exports all wallet adapters** from `@xrpl-connect/adapter-*` packages
4. **Provides a convenience `Adapters` object** for easier access

This eliminates the need to juggle multiple imports in your application code.

---

## Package Structure

```
packages/xrpl-connect/
├── src/
│   └── index.ts              # Central export point
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vite.config.ts
├── scripts/
│   └── build-webcomp.ts      # Build scripts
└── CODE_DOC.md               # This file
```

### Main Export File

**Location**: `src/index.ts`

This file contains all the re-exports that make up the public API:

```typescript
// Core functionality
export * from '@xrpl-connect/core';

// UI Web Component
export * from '@xrpl-connect/ui';

// All adapters
export { XamanAdapter } from '@xrpl-connect/adapter-xaman';
export { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
export { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';
export { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';

// Convenience object
export const Adapters = {
  Xaman: XamanAdapter,
  Crossmark: CrossmarkAdapter,
  GemWallet: GemWalletAdapter,
  WalletConnect: WalletConnectAdapter,
};
```

---

## Single Entry Point Usage

Instead of multiple imports, developers use just one:

### ❌ Without This Package

Multiple imports scattered throughout:

```typescript
import { WalletManager, STANDARD_NETWORKS } from '@xrpl-connect/core';
import { WalletConnectorElement } from '@xrpl-connect/ui';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';
```

### ✅ With This Package

Single, clean import:

```typescript
import {
  WalletManager,
  STANDARD_NETWORKS,
  WalletConnectorElement,
  XamanAdapter,
  CrossmarkAdapter,
  GemWalletAdapter,
  WalletConnectAdapter,
  Adapters,
} from 'xrpl-connect';
```

---

## Complete API Reference

Everything exported from `xrpl-connect` comes from its dependencies:

### From @xrpl-connect/core

```typescript
export {
  // Classes
  WalletManager,
  WalletError,
  LocalStorageAdapter,
  MemoryStorageAdapter,
  Logger,

  // Types
  WalletAdapter,
  AccountInfo,
  NetworkInfo,
  SignedTransaction,
  SubmittedTransaction,
  SignedMessage,
  WalletEvent,
  WalletAdapterEvent,
  ConnectOptions,
  WalletManagerOptions,
  LoggerOptions,
  StorageAdapter,

  // Enums
  WalletErrorCode,

  // Constants
  STANDARD_NETWORKS,
};
```

### From @xrpl-connect/ui

```typescript
export {
  // Web Component (auto-registers as custom element)
  WalletConnectorElement,

  // Types
  WalletConnectorElementOptions,
};
```

### From Adapter Packages

```typescript
export {
  // Adapters
  XamanAdapter,
  CrossmarkAdapter,
  GemWalletAdapter,
  WalletConnectAdapter,

  // Types
  XamanAdapterOptions,
  CrossmarkAdapterOptions,
  GemWalletAdapterOptions,
  WalletConnectAdapterOptions,

  // Enums
  XRPLMethod, // from WalletConnect adapter
};

export const Adapters = {
  Xaman: XamanAdapter,
  Crossmark: CrossmarkAdapter,
  GemWallet: GemWalletAdapter,
  WalletConnect: WalletConnectAdapter,
};
```

---

## Quick Start Examples

### Minimal Setup

```typescript
import { WalletManager, Adapters, STANDARD_NETWORKS } from 'xrpl-connect';

const walletManager = new WalletManager({
  adapters: [new Adapters.Xaman({ apiKey: 'YOUR_API_KEY' }), new Adapters.Crossmark()],
  network: STANDARD_NETWORKS.mainnet,
});

// Use wallet manager...
const account = await walletManager.connect('xaman', {
  apiKey: 'YOUR_API_KEY',
});
```

### With UI Component

```typescript
import { WalletManager, Adapters, STANDARD_NETWORKS } from 'xrpl-connect';

// Initialize wallet manager
const walletManager = new WalletManager({
  adapters: [
    new Adapters.Xaman({ apiKey: process.env.XUMM_API_KEY }),
    new Adapters.Crossmark(),
    new Adapters.WalletConnect({ projectId: process.env.WALLETCONNECT_ID }),
  ],
  network: STANDARD_NETWORKS.mainnet,
  autoConnect: true,
});

// Connect UI component
const connector = document.querySelector('xrpl-wallet-connector');
connector.setWalletManager(walletManager);

// Listen to events
connector.addEventListener('connected', (e) => {
  console.log('Connected to:', e.detail.walletId);
  console.log('Address:', walletManager.account.address);
  connector.close();
});

connector.addEventListener('error', (e) => {
  console.error('Connection failed:', e.detail.error.message);
});
```

### All Available Adapters

```typescript
import { WalletManager, Adapters } from 'xrpl-connect';

const walletManager = new WalletManager({
  adapters: [
    new Adapters.Xaman({
      apiKey: process.env.XUMM_API_KEY,
    }),
    new Adapters.Crossmark(),
    new Adapters.GemWallet(),
    new Adapters.WalletConnect({
      projectId: process.env.WALLETCONNECT_ID,
    }),
  ],
});

// List all available wallets
const available = await walletManager.getAvailableWallets();
available.forEach((wallet) => {
  console.log(`${wallet.name} (${wallet.id})`);
});
```

---

## Use Cases for This Package

### 1. **Single File Bundle**

For simple applications, import everything from one place:

```typescript
// app.ts
import { WalletManager, Adapters } from 'xrpl-connect';

export const initializeWallet = () => {
  return new WalletManager({
    adapters: [new Adapters.Xaman({ apiKey: 'key' })],
  });
};
```

---

### 2. **Web Component Integration**

Include the web component easily:

```html
<!DOCTYPE html>
<html>
  <script type="module">
    import { WalletManager, Adapters } from 'xrpl-connect';

    const walletManager = new WalletManager({
      adapters: [new Adapters.Crossmark()],
    });

    document.querySelector('xrpl-wallet-connector').setWalletManager(walletManager);
  </script>

  <body>
    <xrpl-wallet-connector primary-wallet="crossmark"></xrpl-wallet-connector>
  </body>
</html>
```

---

### 3. **Framework Integration**

Works seamlessly in React, Vue, Angular, etc.:

```typescript
// React example
import { useEffect, useState } from 'react';
import { WalletManager, Adapters } from 'xrpl-connect';

export function useWalletConnect() {
  const [walletManager] = useState(
    () =>
      new WalletManager({
        adapters: [new Adapters.Xaman({ apiKey: 'YOUR_KEY' }), new Adapters.Crossmark()],
      })
  );

  return walletManager;
}
```

---

### 4. **TypeScript Projects**

Full TypeScript support with proper types:

```typescript
import {
  WalletManager,
  Adapters,
  AccountInfo,
  WalletError,
  WalletErrorCode,
  SignedTransaction,
} from 'xrpl-connect';

async function handleWalletConnection(): Promise<AccountInfo> {
  const walletManager = new WalletManager({
    adapters: [new Adapters.Xaman({ apiKey: 'key' })],
  });

  try {
    const account: AccountInfo = await walletManager.connect('xaman', {
      apiKey: 'key',
    });
    return account;
  } catch (error) {
    if (error instanceof WalletError) {
      switch (error.code) {
        case WalletErrorCode.CONNECTION_REJECTED:
          console.log('User rejected');
          break;
        // ... more cases
      }
    }
    throw error;
  }
}
```

---

## Package Dependencies

The meta-package depends on:

```json
{
  "dependencies": {
    "@xrpl-connect/core": "workspace:*",
    "@xrpl-connect/ui": "workspace:*",
    "@xrpl-connect/adapter-xaman": "workspace:*",
    "@xrpl-connect/adapter-crossmark": "workspace:*",
    "@xrpl-connect/adapter-gemwallet": "workspace:*",
    "@xrpl-connect/adapter-walletconnect": "workspace:*"
  }
}
```

This is a monorepo structure where all packages are workspaces, so they're always in sync.

---

## File Organization

The main export consolidates code from multiple packages:

```
xrpl-connect (this package)
  ↓
  Exports from:
  ├── @xrpl-connect/core/
  │   ├── WalletManager
  │   ├── WalletError
  │   ├── Types (AccountInfo, NetworkInfo, etc.)
  │   └── Constants (STANDARD_NETWORKS)
  ├── @xrpl-connect/ui/
  │   └── WalletConnectorElement (web component)
  └── @xrpl-connect/adapter-*/
      ├── XamanAdapter
      ├── CrossmarkAdapter
      ├── GemWalletAdapter
      └── WalletConnectAdapter
```

---

## Development Patterns

### Pattern 1: Using the Convenience Object

The `Adapters` object provides cleaner syntax:

```typescript
// Without Adapters object
import { XamanAdapter, CrossmarkAdapter } from 'xrpl-connect';

const adapters = [new XamanAdapter({ apiKey: 'key' }), new CrossmarkAdapter()];

// With Adapters object
import { Adapters } from 'xrpl-connect';

const adapters = [new Adapters.Xaman({ apiKey: 'key' }), new Adapters.Crossmark()];
```

---

### Pattern 2: Selective Imports

You don't have to import everything; import only what you need:

```typescript
// Only import what you use
import { WalletManager, Adapters } from 'xrpl-connect';

// Tree-shaking will remove unused code from your bundle
```

---

### Pattern 3: Re-exporting for Your App

In large applications, create your own wrapper:

```typescript
// src/wallet/index.ts
export {
  WalletManager,
  Adapters,
  STANDARD_NETWORKS,
  type AccountInfo,
  type WalletError,
} from 'xrpl-connect';

export * from './custom-adapter.ts';
export * from './wallet-hooks.ts';
```

Then import from your local module:

```typescript
import { WalletManager, Adapters } from '@/wallet';
```

---

## Comparison with Individual Imports

### Scenario: Building a Wallet Connection Feature

**Without meta-package** (multiple imports):

```typescript
import { WalletManager, STANDARD_NETWORKS } from '@xrpl-connect/core';
import { WalletConnectorElement } from '@xrpl-connect/ui';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';

// 7 lines just to import!
```

**With meta-package** (single import):

```typescript
import { WalletManager, STANDARD_NETWORKS, WalletConnectorElement, Adapters } from 'xrpl-connect';

// 1 import, cleaner and easier to maintain
```

---

## Extending the Meta-Package

If you need custom functionality, you can:

1. **Create a wrapper package** that re-exports from xrpl-connect
2. **Add custom adapters** and export them alongside the originals
3. **Create custom hooks** (for React) or composables (for Vue)

Example:

```typescript
// src/wallet-integration.ts
export { WalletManager, Adapters, STANDARD_NETWORKS } from 'xrpl-connect';

export { CustomWalletAdapter } from './adapters/custom.js';

export { useWallet, useWalletConnect } from './hooks.js';
```

---

## Best Practices

1. **Use Named Imports**: Be explicit about what you're importing

   ```typescript
   // Good
   import { WalletManager, Adapters } from 'xrpl-connect';

   // Avoid
   import * as xrplConnect from 'xrpl-connect';
   ```

2. **Leverage the Adapters Object**: Use `Adapters.Xaman` instead of importing `XamanAdapter`

   ```typescript
   // Good
   const adapter = new Adapters.Xaman({ apiKey });

   // Also good
   import { XamanAdapter } from 'xrpl-connect';
   const adapter = new XamanAdapter({ apiKey });
   ```

3. **Type-Only Imports**: In TypeScript, use `type` imports for types to reduce bundle size

   ```typescript
   import type { AccountInfo, NetworkInfo } from 'xrpl-connect';
   import { WalletManager } from 'xrpl-connect';
   ```

4. **Document Your Own Wrappers**: If you create framework-specific wrappers, document them clearly

---

## Troubleshooting

### Issue: Large Bundle Size

**Problem**: The meta-package includes all adapters, but your app only needs one.

**Solution**: Use tree-shaking by importing specific adapters:

```typescript
// Instead of importing everything
import { WalletManager, Adapters } from 'xrpl-connect';
const manager = new WalletManager({
  adapters: [new Adapters.Xaman({ apiKey })], // Only includes Xaman
});
```

Or import from the specific adapter package:

```typescript
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

const manager = new WalletManager({
  adapters: [new XamanAdapter({ apiKey })],
});
```

---

### Issue: Type Conflicts

**Problem**: Types from different adapters conflict.

**Solution**: Use qualified names or type guards:

```typescript
import type { XamanAdapterOptions, CrossmarkAdapterOptions } from 'xrpl-connect';

function createAdapter(type: 'xaman' | 'crossmark', opts: any) {
  if (type === 'xaman') {
    return new Adapters.Xaman(opts as XamanAdapterOptions);
  }
  return new Adapters.Crossmark(opts as CrossmarkAdapterOptions);
}
```

---

## Common Patterns

### Initialize with All Adapters

```typescript
import { WalletManager, Adapters, STANDARD_NETWORKS } from 'xrpl-connect';

const allAdapters = Object.values(Adapters).map((AdapterClass) => {
  if (AdapterClass === Adapters.Xaman) {
    return new AdapterClass({ apiKey: process.env.XUMM_API_KEY });
  }
  if (AdapterClass === Adapters.WalletConnect) {
    return new AdapterClass({ projectId: process.env.WALLETCONNECT_ID });
  }
  return new AdapterClass();
});

const walletManager = new WalletManager({
  adapters: allAdapters,
  network: STANDARD_NETWORKS.mainnet,
});
```

### Conditional Adapter Loading

```typescript
import { WalletManager, Adapters } from 'xrpl-connect';

function getAdapters() {
  const adapters = [];

  if (process.env.XUMM_API_KEY) {
    adapters.push(new Adapters.Xaman({ apiKey: process.env.XUMM_API_KEY }));
  }

  adapters.push(new Adapters.Crossmark());

  if (process.env.WALLETCONNECT_ID) {
    adapters.push(new Adapters.WalletConnect({ projectId: process.env.WALLETCONNECT_ID }));
  }

  return adapters;
}

const walletManager = new WalletManager({
  adapters: getAdapters(),
});
```

---

## Summary

The `@xrpl-connect/xrpl-connect` meta-package:

- ✅ Provides a single import point for all XRPL Connect functionality
- ✅ Re-exports core, UI, and all adapters
- ✅ Includes a convenient `Adapters` object for cleaner code
- ✅ Simplifies developer experience
- ✅ Enables framework integration and rapid prototyping
- ✅ Maintains full type safety with TypeScript
