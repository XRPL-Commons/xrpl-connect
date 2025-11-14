---
description: Real-world examples and pre-built theme configurations for implementing XRPL-Connect.
---

# Examples

Real-world examples and pre-built theme configurations.

## Live React Example

We now have a comprehensive React example application that demonstrates all features of XRPL-Connect, including:

- Multiple wallet adapter support (Xaman, WalletConnect, Crossmark, GemWallet, Ledger)
- Custom React hooks for wallet management
- Transaction and message signing
- Dynamic theme customization
- Real-time event logging
- Proper TypeScript integration with web components

**Check out the full example:** [`examples/react/`](https://github.com/XRPL-Commons/xrpl-connect/tree/main/examples/react)

The example includes detailed setup instructions, best practices for React integration, and demonstrates how to properly handle web component lifecycle in React applications.

## Vanilla JavaScript Example

Complete example with wallet connection and transaction signing:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>XRPL-Connect Example</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 2rem;
      background: #f5f5f5;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    button {
      padding: 0.75rem 1.5rem;
      background: #3b99fc;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }
    button:hover {
      background: #2a7fd8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>XRPL-Connect Example</h1>
      <xrpl-wallet-connector id="wallet-connector"></xrpl-wallet-connector>
    </div>

    <div class="card" id="account-info">
      <p>No wallet connected</p>
    </div>

    <div class="card" id="transaction-section" style="display: none;">
      <h2>Send Transaction</h2>
      <form id="tx-form">
        <div>
          <label>Destination:</label>
          <input type="text" id="destination" required>
        </div>
        <div>
          <label>Amount (drops):</label>
          <input type="number" id="amount" required>
        </div>
        <button type="submit">Send Transaction</button>
      </form>
      <div id="tx-result"></div>
    </div>
  </div>

  <script type="module">
    import { WalletManager, XamanAdapter, CrossmarkAdapter, LedgerAdapter } from 'xrpl-connect';

    const walletManager = new WalletManager({
      adapters: [
        new XamanAdapter({ apiKey: 'YOUR_API_KEY' }),
        new CrossmarkAdapter(),
        new LedgerAdapter(), // Hardware wallet support
      ],
      network: 'testnet',
      autoConnect: true,
    });

    const connector = document.getElementById('wallet-connector');
    connector.setWalletManager(walletManager);

    const accountInfo = document.getElementById('account-info');
    const txSection = document.getElementById('transaction-section');
    const txForm = document.getElementById('tx-form');
    const txResult = document.getElementById('tx-result');

    function updateUI() {
      if (walletManager.connected) {
        const account = walletManager.account;
        accountInfo.innerHTML = `
          <h2>Connected Account</h2>
          <p><strong>Address:</strong> ${account.address}</p>
          <p><strong>Network:</strong> ${account.network.name}</p>
        `;
        txSection.style.display = 'block';
      } else {
        accountInfo.innerHTML = '<p>No wallet connected. Click the button above to connect.</p>';
        txSection.style.display = 'none';
      }
    }

    walletManager.on('connect', updateUI);
    walletManager.on('disconnect', updateUI);
    updateUI();

    txForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const destination = document.getElementById('destination').value;
      const amount = document.getElementById('amount').value;

      try {
        txResult.innerHTML = '<p>Signing transaction...</p>';

        const result = await walletManager.signAndSubmit({
          TransactionType: 'Payment',
          Account: walletManager.account.address,
          Destination: destination,
          Amount: amount,
        });

        txResult.innerHTML = `
          <div style="background: #d4edda; padding: 1rem; border-radius: 8px;">
            <h3>Success!</h3>
            <p><strong>Hash:</strong> ${result.hash || 'Pending'}</p>
          </div>
        `;
      } catch (error) {
        txResult.innerHTML = `
          <div style="background: #f8d7da; padding: 1rem; border-radius: 8px;">
            <h3>Error</h3>
            <p>${error.message}</p>
          </div>
        `;
      }
    });
  </script>
</body>
</html>
```

## React Example

> **Note:** For a complete, production-ready React example with all features, see the [React example application](https://github.com/XRPL-Commons/xrpl-connect/tree/main/examples/react).

```jsx
import { useEffect, useRef, useState } from 'react';
import { WalletManager, XamanAdapter, CrossmarkAdapter, LedgerAdapter } from 'xrpl-connect';

function App() {
  const connectorRef = useRef(null);
  const [account, setAccount] = useState(null);
  const [walletManager, setWalletManager] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const manager = new WalletManager({
      adapters: [
        new XamanAdapter({ apiKey: 'YOUR_API_KEY' }),
        new CrossmarkAdapter(),
        new LedgerAdapter(), // Hardware wallet support
      ],
      network: 'testnet',
      autoConnect: true,
    });

    manager.on('connect', (acc) => {
      setAccount(acc);
    });

    manager.on('disconnect', () => {
      setAccount(null);
    });

    manager.on('error', (error) => {
      console.error('Error:', error);
    });

    setWalletManager(manager);

    if (connectorRef.current) {
      connectorRef.current.setWalletManager(manager);
    }
  }, []);

  const handleSignTransaction = async () => {
    if (!walletManager) return;

    setIsLoading(true);
    try {
      const result = await walletManager.signAndSubmit({
        TransactionType: 'Payment',
        Account: walletManager.account.address,
        Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
        Amount: '1000000',
      });

      console.log('Transaction submitted:', result.hash);
    } catch (error) {
      console.error('Failed to sign:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>XRPL-Connect React Example</h1>

      <xrpl-wallet-connector ref={connectorRef} />

      {account && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Connected Account</h2>
          <p>Address: {account.address}</p>
          <p>Network: {account.network.name}</p>
          <button
            onClick={handleSignTransaction}
            disabled={isLoading}
          >
            {isLoading ? 'Signing...' : 'Send Payment'}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
```

## Vue 3 Example

```vue
<template>
  <div style="padding: 2rem">
    <h1>XRPL-Connect Vue 3 Example</h1>

    <xrpl-wallet-connector ref="connectorRef" />

    <div v-if="account" style="marginTop: '2rem'">
      <h2>Connected Account</h2>
      <p>Address: {{ account.address }}</p>
      <p>Network: {{ account.network.name }}</p>
      <button
        @click="handleSignTransaction"
        :disabled="isLoading"
      >
        {{ isLoading ? 'Signing...' : 'Send Payment' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { WalletManager, XamanAdapter, CrossmarkAdapter, LedgerAdapter } from 'xrpl-connect';

const connectorRef = ref(null);
const account = ref(null);
const isLoading = ref(false);
let walletManager;

onMounted(() => {
  walletManager = new WalletManager({
    adapters: [
      new XamanAdapter({ apiKey: 'YOUR_API_KEY' }),
      new CrossmarkAdapter(),
      new LedgerAdapter(), // Hardware wallet support
    ],
    network: 'testnet',
    autoConnect: true,
  });

  walletManager.on('connect', (acc) => {
    account.value = acc;
  });

  walletManager.on('disconnect', () => {
    account.value = null;
  });

  connectorRef.value?.setWalletManager(walletManager);
});

const handleSignTransaction = async () => {
  if (!walletManager) return;

  isLoading.value = true;
  try {
    const result = await walletManager.signAndSubmit({
      TransactionType: 'Payment',
      Account: walletManager.account.address,
      Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
      Amount: '1000000',
    });

    console.log('Transaction submitted:', result.hash);
  } catch (error) {
    console.error('Failed to sign:', error);
  } finally {
    isLoading.value = false;
  }
};
</script>
```

## Theme Switching Example

Dynamically switch themes based on user preference:

```javascript
const themes = {
  dark: {
    '--xc-background-color': '#000637',
    '--xc-primary-color': '#3b99fc',
    '--xc-text-color': '#F5F4E7',
  },
  light: {
    '--xc-background-color': '#ffffff',
    '--xc-primary-color': '#2563eb',
    '--xc-text-color': '#111111',
  },
  purple: {
    '--xc-background-color': '#1e1b4b',
    '--xc-primary-color': '#a78bfa',
    '--xc-text-color': '#f3e8ff',
  },
};

function applyTheme(themeName) {
  const connector = document.getElementById('wallet-connector');
  const theme = themes[themeName];

  Object.entries(theme).forEach(([key, value]) => {
    connector.style.setProperty(key, value);
  });

  localStorage.setItem('theme', themeName);
}

// Load saved theme or use system preference
const saved = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(saved || (prefersDark ? 'dark' : 'light'));
```

## Global CSS Theme Definition

Define themes globally for consistent application-wide styling:

```css
:root {
  color-scheme: light dark;

  /* Light theme (default) */
  --xc-primary-color: #2563eb;
  --xc-background-color: #ffffff;
  --xc-text-color: #111111;
}

@media (prefers-color-scheme: dark) {
  :root {
    --xc-primary-color: #3b99fc;
    --xc-background-color: #000637;
    --xc-text-color: #F5F4E7;
  }
}

/* App-specific overrides */
.app-purple {
  --xc-primary-color: #a78bfa;
  --xc-background-color: #1e1b4b;
  --xc-text-color: #f3e8ff;
}
```

## Ledger Hardware Wallet Example

Complete example integrating Ledger hardware wallet:

```html
<!DOCTYPE html>
<html>
<head>
  <title>XRPL-Connect Ledger Example</title>
</head>
<body>
  <div class="container">
    <h1>Ledger Hardware Wallet Demo</h1>
    <xrpl-wallet-connector id="wallet-connector"></xrpl-wallet-connector>

    <div id="device-status"></div>
    <div id="account-info"></div>
  </div>

  <script type="module">
    import { WalletManager, LedgerAdapter, LedgerDeviceState } from 'xrpl-connect';

    const ledgerAdapter = new LedgerAdapter({
      accountIndex: 0, // First account (44'/144'/0'/0/0)
      timeout: 60000,  // 60 seconds for user to confirm
    });

    const walletManager = new WalletManager({
      adapters: [ledgerAdapter],
      network: 'testnet',
    });

    const connector = document.getElementById('wallet-connector');
    connector.setWalletManager(walletManager);

    // Check device status before connecting
    const statusDiv = document.getElementById('device-status');

    ledgerAdapter.getDeviceState().then(state => {
      switch (state) {
        case LedgerDeviceState.NOT_CONNECTED:
          statusDiv.innerHTML = '<p>⚠️ Please connect your Ledger device via USB</p>';
          break;
        case LedgerDeviceState.LOCKED:
          statusDiv.innerHTML = '<p>🔒 Please unlock your Ledger device</p>';
          break;
        case LedgerDeviceState.APP_NOT_OPEN:
          statusDiv.innerHTML = '<p>📱 Please open the XRP app on your Ledger</p>';
          break;
        case LedgerDeviceState.READY:
          statusDiv.innerHTML = '<p>✅ Ledger is ready to connect!</p>';
          break;
      }
    });

    walletManager.on('connect', (account) => {
      document.getElementById('account-info').innerHTML = `
        <h2>✅ Connected to Ledger</h2>
        <p><strong>Address:</strong> ${account.address}</p>
        <p><strong>Path:</strong> 44'/144'/0'/0/0</p>
      `;
    });

    // Sign transaction with hardware confirmation
    async function signTransaction() {
      try {
        const result = await walletManager.signAndSubmit({
          TransactionType: 'Payment',
          Account: walletManager.account.address,
          Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
          Amount: '1000000',
        });
        console.log('Transaction signed on device:', result.hash);
      } catch (error) {
        console.error('User rejected on device or error:', error);
      }
    }
  </script>
</body>
</html>
```

**Important Notes for Ledger:**
- Requires Chrome, Edge, or Opera browser (WebHID/WebUSB support)
- Must be served over HTTPS (localhost is OK for development)
- Close Ledger Live application before connecting
- User must physically confirm transactions on the device
- Private keys never leave the hardware device

## Common Use Cases

### DeFi Application

For DeFi apps, use a dark professional theme with high contrast:

```html
<xrpl-wallet-connector
  style="
    --xc-primary-color: #1f2937;
    --xc-background-color: #0f172a;
    --xc-text-color: #f1f5f9;
    --xc-success-color: #10b981;
    --xc-danger-color: #ef4444;
  "
  wallets="xaman,crossmark"
  primary-wallet="xaman"
></xrpl-wallet-connector>
```

### Payment Application

For payment apps, use clean light theme with friendly colors:

```html
<xrpl-wallet-connector
  style="
    --xc-primary-color: #ec4899;
    --xc-background-color: #ffffff;
    --xc-text-color: #374151;
    --xc-border-radius: 12px;
  "
  wallets="xaman,crossmark,walletconnect"
  primary-wallet="xaman"
></xrpl-wallet-connector>
```

### NFT Marketplace

For NFT apps, use creative dark theme with vibrant accents:

```html
<xrpl-wallet-connector
  style="
    --xc-primary-color: #f59e0b;
    --xc-background-color: #111827;
    --xc-text-color: #f3f4f6;
    --xc-border-radius: 16px;
  "
  wallets="xaman,crossmark,walletconnect"
></xrpl-wallet-connector>
```
