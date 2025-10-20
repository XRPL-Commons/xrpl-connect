# Vanilla JavaScript Guide

This guide shows how to integrate XRPL Connect into a vanilla JavaScript project without any framework.

## Table of Contents

- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Complete Example](#complete-example)
- [Using the UI Component](#using-the-ui-component)
- [Advanced Patterns](#advanced-patterns)
- [TypeScript Support](#typescript-support)

## Installation

### Via npm/pnpm/yarn

```bash
# Install UI package and wallet adapters
npm install @xrpl-connect/ui @xrpl-connect/adapter-xaman @xrpl-connect/adapter-crossmark
```

### Via CDN (ES Modules)

```html
<script type="module">
  import '@xrpl-connect/ui';
  import { WalletManager } from 'https://cdn.jsdelivr.net/npm/@xrpl-connect/core/+esm';
  import { XamanAdapter } from 'https://cdn.jsdelivr.net/npm/@xrpl-connect/adapter-xaman/+esm';
</script>
```

## Quick Start (Web Component)

The easiest way to integrate XRPL Connect is using the web component:

### 1. HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XRPL Connect - Vanilla JS</title>
</head>
<body>
  <div id="app">
    <h1>XRPL Wallet Connection</h1>

    <!-- Connection status -->
    <div id="connection-status">
      <p>Status: <span id="status">Disconnected</span></p>
      <p>Address: <span id="address">-</span></p>
      <p>Network: <span id="network">-</span></p>
    </div>

    <!-- Connect button -->
    <button id="connect-btn">Connect Wallet</button>
    <button id="disconnect" style="display: none;">Disconnect</button>

    <!-- Transaction section (shown after connection) -->
    <div id="transaction-section" style="display: none;">
      <h2>Send Transaction</h2>
      <input type="text" id="destination" placeholder="Destination Address">
      <input type="number" id="amount" placeholder="Amount (XRP)">
      <button id="send-tx">Send Payment</button>
    </div>
  </div>

  <!-- XRPL Wallet Connector Web Component -->
  <xrpl-wallet-connector
    id="wallet-connector"
    background-color="#1a202c"
    primary-wallet="xaman">
  </xrpl-wallet-connector>

  <script type="module" src="./main.js"></script>
</body>
</html>
```

### 2. JavaScript Setup

```javascript
// main.js
import '@xrpl-connect/ui';
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';

// Initialize wallet manager
const walletManager = new WalletManager({
  adapters: [
    new XamanAdapter(),
    new CrossmarkAdapter(),
  ],
  network: 'testnet',
  autoConnect: true,
});

// Connect UI component to wallet manager
const connector = document.getElementById('wallet-connector');
connector.setWalletManager(walletManager);

// DOM elements
const elements = {
  status: document.getElementById('status'),
  address: document.getElementById('address'),
  network: document.getElementById('network'),
  connectBtn: document.getElementById('connect-btn'),
  disconnect: document.getElementById('disconnect'),
  transactionSection: document.getElementById('transaction-section'),
  destination: document.getElementById('destination'),
  amount: document.getElementById('amount'),
  sendTx: document.getElementById('send-tx'),
};

// Open wallet connector modal
elements.connectBtn.addEventListener('click', () => {
  connector.open();
});

// Disconnect
elements.disconnect.addEventListener('click', async () => {
  await walletManager.disconnect();
});

// Update UI based on connection state
function updateUI() {
  const isConnected = walletManager.connected;

  elements.status.textContent = isConnected ? 'Connected' : 'Disconnected';
  elements.address.textContent = walletManager.account?.address || '-';
  elements.network.textContent = walletManager.account?.network.name || '-';

  elements.connectBtn.style.display = isConnected ? 'none' : 'block';
  elements.disconnect.style.display = isConnected ? 'block' : 'none';
  elements.transactionSection.style.display = isConnected ? 'block' : 'none';
}

// Event listeners for wallet manager
walletManager.on('connect', (account) => {
  console.log('Connected:', account);
  updateUI();
});

walletManager.on('disconnect', () => {
  console.log('Disconnected');
  updateUI();
});

// Sign transaction
elements.sendTx.addEventListener('click', async () => {
  const destination = elements.destination.value;
  const amount = elements.amount.value;

  if (!destination || !amount) {
    alert('Please enter destination and amount');
    return;
  }

  try {
    const transaction = {
      TransactionType: 'Payment',
      Account: walletManager.account.address,
      Destination: destination,
      Amount: String(parseFloat(amount) * 1_000_000),
    };

    const signed = await walletManager.sign(transaction);
    alert(`Transaction signed! Hash: ${signed.hash}`);
    console.log('Signed transaction:', signed);
  } catch (error) {
    alert(`Transaction failed: ${error.message}`);
  }
});

// Initialize UI
updateUI();
```

That's it! The web component handles all the wallet selection UI, QR codes, loading states, and errors automatically.

## Complete Example

Here's a complete, production-ready example:

```javascript
// app.js
import { WalletManager, WalletError, WalletErrorCode } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';

class XRPLWalletApp {
  constructor() {
    this.walletManager = new WalletManager({
      adapters: [
        new XamanAdapter(),
        new CrossmarkAdapter(),
        new GemWalletAdapter(),
        new WalletConnectAdapter({
          projectId: 'YOUR_WALLETCONNECT_PROJECT_ID',
        }),
      ],
      network: 'testnet',
      autoConnect: true,
      logger: {
        level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
      },
    });

    this.initializeEventListeners();
    this.initializeWalletEvents();
    this.renderAvailableWallets();
  }

  initializeEventListeners() {
    document.getElementById('disconnect')?.addEventListener('click', () => {
      this.disconnect();
    });

    document.getElementById('send-payment')?.addEventListener('click', () => {
      this.sendPayment();
    });

    document.getElementById('sign-message')?.addEventListener('click', () => {
      this.signMessage();
    });
  }

  initializeWalletEvents() {
    this.walletManager.on('connect', (account) => {
      this.updateConnectionUI(true, account);
    });

    this.walletManager.on('disconnect', () => {
      this.updateConnectionUI(false);
    });

    this.walletManager.on('accountChanged', (account) => {
      console.log('Account changed:', account);
      this.updateConnectionUI(true, account);
    });

    this.walletManager.on('networkChanged', (network) => {
      console.log('Network changed:', network);
      this.showNotification(`Network changed to ${network.name}`, 'info');
    });

    this.walletManager.on('error', (error) => {
      console.error('Wallet error:', error);
      this.showNotification(error.message, 'error');
    });
  }

  async renderAvailableWallets() {
    const wallets = await this.walletManager.getAvailableWallets();
    const container = document.getElementById('wallet-list');

    if (!container) return;

    container.innerHTML = wallets
      .map(
        (wallet) => `
        <button
          class="wallet-button"
          data-wallet-id="${wallet.id}"
          onclick="app.connect('${wallet.id}')">
          ${wallet.icon ? `<img src="${wallet.icon}" alt="${wallet.name}">` : ''}
          <span>${wallet.name}</span>
        </button>
      `
      )
      .join('');
  }

  async connect(walletId) {
    try {
      this.showNotification('Connecting...', 'info');
      const account = await this.walletManager.connect(walletId);
      this.showNotification(`Connected to ${account.address}`, 'success');
    } catch (error) {
      this.handleError(error);
    }
  }

  async disconnect() {
    try {
      await this.walletManager.disconnect();
      this.showNotification('Disconnected', 'info');
    } catch (error) {
      this.handleError(error);
    }
  }

  async sendPayment() {
    const destination = document.getElementById('destination').value;
    const amount = document.getElementById('amount').value;

    if (!destination || !amount) {
      this.showNotification('Please fill in all fields', 'error');
      return;
    }

    try {
      const transaction = {
        TransactionType: 'Payment',
        Account: this.walletManager.account.address,
        Destination: destination,
        Amount: String(parseFloat(amount) * 1_000_000),
      };

      this.showNotification('Waiting for signature...', 'info');
      const signed = await this.walletManager.sign(transaction);
      this.showNotification('Transaction signed!', 'success');
      console.log('Signed transaction:', signed);

      // Display transaction hash
      document.getElementById('tx-hash').textContent = signed.hash;
    } catch (error) {
      this.handleError(error);
    }
  }

  async signMessage() {
    const message = document.getElementById('message').value;

    if (!message) {
      this.showNotification('Please enter a message', 'error');
      return;
    }

    try {
      this.showNotification('Waiting for signature...', 'info');
      const signed = await this.walletManager.signMessage(message);
      this.showNotification('Message signed!', 'success');

      document.getElementById('signature').textContent = signed.signature;
      console.log('Signed message:', signed);
    } catch (error) {
      this.handleError(error);
    }
  }

  updateConnectionUI(connected, account = null) {
    const statusElement = document.getElementById('connection-status');
    const addressElement = document.getElementById('wallet-address');
    const networkElement = document.getElementById('network-name');
    const walletListElement = document.getElementById('wallet-list');
    const connectedSection = document.getElementById('connected-section');

    if (connected && account) {
      statusElement.textContent = 'Connected';
      statusElement.className = 'status connected';
      addressElement.textContent = account.address;
      networkElement.textContent = account.network.name;
      walletListElement.style.display = 'none';
      connectedSection.style.display = 'block';
    } else {
      statusElement.textContent = 'Disconnected';
      statusElement.className = 'status disconnected';
      addressElement.textContent = '-';
      networkElement.textContent = '-';
      walletListElement.style.display = 'grid';
      connectedSection.style.display = 'none';
    }
  }

  handleError(error) {
    if (error instanceof WalletError) {
      switch (error.code) {
        case WalletErrorCode.WALLET_NOT_INSTALLED:
          this.showNotification(
            'Wallet not installed. Please install it first.',
            'error'
          );
          break;
        case WalletErrorCode.CONNECTION_REJECTED:
          this.showNotification('Connection rejected by user', 'warning');
          break;
        case WalletErrorCode.SIGN_REJECTED:
          this.showNotification('Signing rejected by user', 'warning');
          break;
        default:
          this.showNotification(error.message, 'error');
      }
    } else {
      this.showNotification('An unknown error occurred', 'error');
      console.error(error);
    }
  }

  showNotification(message, type = 'info') {
    // Simple notification implementation
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize app
const app = new XRPLWalletApp();
window.app = app; // Make it globally accessible for onclick handlers
```

## Using the UI Component

XRPL Connect provides a web component for easy UI integration:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>XRPL Connect UI</title>
</head>
<body>
  <xrpl-wallet-connector
    id="wallet-connector"
    network="testnet"
    theme-background="#000637"
    theme-text="#F5F4E7"
    theme-primary="#0ea5e9">
  </xrpl-wallet-connector>

  <script type="module">
    import '@xrpl-connect/ui';
    import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
    import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';

    const connector = document.getElementById('wallet-connector');

    // Set adapters
    connector.adapters = [
      new XamanAdapter(),
      new CrossmarkAdapter(),
    ];

    // Listen to events
    connector.addEventListener('connect', (event) => {
      console.log('Connected:', event.detail);
    });

    connector.addEventListener('disconnect', () => {
      console.log('Disconnected');
    });

    connector.addEventListener('sign', (event) => {
      console.log('Transaction signed:', event.detail);
    });
  </script>
</body>
</html>
```

## Advanced Patterns

### Loading States

```javascript
class WalletUI {
  async connectWithLoading(walletId) {
    const button = document.querySelector(`[data-wallet-id="${walletId}"]`);
    button.disabled = true;
    button.textContent = 'Connecting...';

    try {
      const account = await walletManager.connect(walletId);
      return account;
    } finally {
      button.disabled = false;
      button.textContent = 'Connect';
    }
  }
}
```

### Debounced Input

```javascript
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Usage
const handleAmountChange = debounce((amount) => {
  console.log('Amount changed:', amount);
}, 300);

document.getElementById('amount').addEventListener('input', (e) => {
  handleAmountChange(e.target.value);
});
```

### Custom Storage (Session Storage)

```javascript
class SessionStorageAdapter {
  async get(key) {
    return sessionStorage.getItem(key);
  }

  async set(key, value) {
    sessionStorage.setItem(key, value);
  }

  async remove(key) {
    sessionStorage.removeItem(key);
  }

  async clear() {
    sessionStorage.clear();
  }
}

const walletManager = new WalletManager({
  adapters: [...],
  storage: new SessionStorageAdapter(),
});
```

## TypeScript Support

If you're using TypeScript with vanilla JS:

```typescript
import { WalletManager, AccountInfo, WalletError } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

const walletManager: WalletManager = new WalletManager({
  adapters: [new XamanAdapter()],
  network: 'testnet',
});

walletManager.on('connect', (account: AccountInfo) => {
  console.log('Connected:', account.address);
});

async function connect(): Promise<void> {
  try {
    const account: AccountInfo = await walletManager.connect('xaman');
    console.log('Account:', account);
  } catch (error) {
    if (error instanceof WalletError) {
      console.error('Wallet error:', error.code, error.message);
    }
  }
}
```

## Best Practices

1. **Always handle errors** - Use try-catch for async operations
2. **Update UI reactively** - Listen to events instead of polling state
3. **Validate user input** - Check destination addresses and amounts
4. **Show loading states** - Provide feedback during async operations
5. **Handle rejections gracefully** - Users may reject connections or signatures
6. **Use autoConnect** - Improve UX by auto-reconnecting on page load
7. **Log appropriately** - Use different log levels for dev vs production

## Complete Project Example

For a complete working example, see the [vanilla-js example](../examples/vanilla-js) in the repository.

## Next Steps

- [React Integration](./REACT.md)
- [Vue Integration](./VUE.md)
- [Getting Started Guide](./GETTING_STARTED.md)
