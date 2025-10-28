# Vanilla JavaScript

Integrate XRPL-Connect into your Vanilla JavaScript application.

## Basic Setup

Here's a complete example with a single HTML file:

```html
<!DOCTYPE html>
<html>
<head>
  <title>XRPL-Connect Example</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
    }
    #account-info {
      margin-top: 20px;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 8px;
      display: none;
    }
  </style>
</head>
<body>
  <h1>XRPL-Connect Demo</h1>
  <xrpl-wallet-connector id="wallet-connector"></xrpl-wallet-connector>

  <div id="account-info">
    <h2>Connected Account</h2>
    <p><strong>Address:</strong> <span id="address">-</span></p>
    <p><strong>Network:</strong> <span id="network">-</span></p>
    <p><strong>Wallet:</strong> <span id="wallet">-</span></p>
    <button id="disconnect-btn">Disconnect</button>
  </div>

  <script type="module">
    import { WalletManager } from 'xrpl-connect';
    import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
    import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';

    // Initialize WalletManager
    const walletManager = new WalletManager({
      adapters: [
        new XamanAdapter({ apiKey: 'YOUR_API_KEY' }),
        new CrossmarkAdapter(),
      ],
      network: 'testnet',
      autoConnect: true,
    });

    // Get DOM elements
    const connector = document.getElementById('wallet-connector');
    const accountInfo = document.getElementById('account-info');
    const addressEl = document.getElementById('address');
    const networkEl = document.getElementById('network');
    const walletEl = document.getElementById('wallet');
    const disconnectBtn = document.getElementById('disconnect-btn');

    // Connect component to wallet manager
    connector.setWalletManager(walletManager);

    // Handle connection
    walletManager.on('connect', (account) => {
      console.log('Connected:', account.address);
      addressEl.textContent = account.address;
      networkEl.textContent = account.network.name;
      walletEl.textContent = walletManager.wallet.name;
      accountInfo.style.display = 'block';
    });

    // Handle disconnection
    walletManager.on('disconnect', () => {
      console.log('Disconnected');
      accountInfo.style.display = 'none';
    });

    // Handle errors
    walletManager.on('error', (error) => {
      console.error('Error:', error.message);
      alert('Connection error: ' + error.message);
    });

    // Disconnect button
    disconnectBtn.addEventListener('click', async () => {
      await walletManager.disconnect();
    });
  </script>
</body>
</html>
```

## Handling Wallet Events

Listen to wallet events to keep your UI in sync:

```javascript
// Connection event
walletManager.on('connect', (account) => {
  console.log('Connected to:', account.address);
  console.log('Network:', account.network.name);
});

// Disconnection event
walletManager.on('disconnect', () => {
  console.log('Disconnected');
});

// Error event
walletManager.on('error', (error) => {
  console.error('Error code:', error.code);
  console.error('Error message:', error.message);
});

// Account change (user switched accounts)
walletManager.on('accountChange', (account) => {
  console.log('Account changed:', account.address);
});

// Network change (user switched networks)
walletManager.on('networkChange', (network) => {
  console.log('Network changed:', network.name);
});
```

## Signing Transactions

Sign and submit transactions to the XRP Ledger:

```javascript
// Simple payment transaction
async function sendPayment() {
  try {
    const result = await walletManager.signAndSubmit({
      TransactionType: 'Payment',
      Account: walletManager.account.address,
      Destination: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT',
      Amount: '1000000',  // 1 XRP in drops
    });

    console.log('Transaction submitted:', result.hash);
    alert('Payment sent! Hash: ' + result.hash);
  } catch (error) {
    console.error('Transaction failed:', error.message);
    alert('Transaction failed: ' + error.message);
  }
}
```

## Signing Messages

Sign messages with the connected wallet:

```javascript
async function signMessage() {
  try {
    const result = await walletManager.signMessage('Hello XRPL');

    console.log('Message signed:', result.signature);
    console.log('Signed message:', result.message);
  } catch (error) {
    console.error('Sign failed:', error.message);
  }
}
```

## Checking Connection Status

Check if a wallet is connected and access account information:

```javascript
// Check connection
if (walletManager.connected) {
  console.log('Wallet address:', walletManager.account.address);
  console.log('Network:', walletManager.account.network.name);
  console.log('Wallet name:', walletManager.wallet.name);
} else {
  console.log('No wallet connected');
}

// Access current state
const { connected, account, wallet } = walletManager;
```

## Multiple Wallet Adapters

Give users choice by supporting multiple wallets:

```javascript
import { WalletManager } from 'xrpl-connect';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';
import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';

const walletManager = new WalletManager({
  adapters: [
    new XamanAdapter({ apiKey: 'YOUR_API_KEY' }),
    new CrossmarkAdapter(),
    new GemWalletAdapter(),
    new WalletConnectAdapter({ projectId: 'YOUR_PROJECT_ID' }),
  ],
  network: 'testnet',
  autoConnect: true,
});
```

Now users will see all four wallets in the connection modal!

## Error Handling

Always handle errors gracefully:

```javascript
walletManager.on('error', (error) => {
  console.error('Error code:', error.code);
  console.error('Error message:', error.message);
  console.error('Error details:', error.details);

  // Handle specific errors
  switch (error.code) {
    case 'WALLET_NOT_FOUND':
      alert('Please install a wallet to continue');
      break;
    case 'CONNECTION_FAILED':
      alert('Failed to connect. Please try again.');
      break;
    case 'SIGN_FAILED':
      alert('You rejected the transaction');
      break;
    default:
      alert('An error occurred: ' + error.message);
  }
});
```

Or use try-catch with promise-based methods:

```javascript
try {
  const result = await walletManager.signAndSubmit(transaction);
  console.log('Success:', result);
} catch (error) {
  if (error.code === 'SIGN_FAILED') {
    console.error('User rejected the transaction');
  } else if (error.code === 'NETWORK_ERROR') {
    console.error('Network problem:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Web Component Attributes

Customize the component with attributes:

```html
<!-- Feature a specific wallet -->
<xrpl-wallet-connector
  id="wallet-connector"
  primary-wallet="xaman"
></xrpl-wallet-connector>

<!-- Show only specific wallets -->
<xrpl-wallet-connector
  id="wallet-connector"
  wallets="xaman,crossmark"
></xrpl-wallet-connector>

<!-- Customize styling -->
<xrpl-wallet-connector
  id="wallet-connector"
  style="
    --xc-primary-color: #667eea;
    --xc-background-color: #1a202c;
    --xc-text-color: #ffffff;
  "
></xrpl-wallet-connector>
```

## Component Methods

The component has useful methods you can call:

```javascript
const connector = document.getElementById('wallet-connector');

// Open wallet selection modal
await connector.open();

// Close any open modals
connector.close();
```

## Best Practices

1. **Initialize Once** - Create the WalletManager at app startup, not in loops or event handlers

2. **Use Event Listeners** - Listen to events to keep UI in sync with wallet state

3. **Handle Errors** - Always have error handlers for wallet operations

4. **Validate Transactions** - Check transaction parameters before signing

5. **Check Connection** - Always verify `walletManager.connected` before accessing account info

6. **Support Multiple Wallets** - Include at least Xaman and Crossmark for good UX

7. **Test Thoroughly** - Test with different wallets and networks

8. **Use TypeScript** - Consider migrating to TypeScript for better type safety

## Complete Example with TypeScript

If you want to add TypeScript:

```typescript
import { WalletManager, Account, WalletError } from 'xrpl-connect';
import { XamanAdapter } from '@xrpl-connect/adapter-xaman';

const walletManager: WalletManager = new WalletManager({
  adapters: [new XamanAdapter({ apiKey: 'YOUR_API_KEY' })],
  network: 'testnet',
  autoConnect: true,
});

walletManager.on('connect', (account: Account) => {
  console.log('Connected:', account.address);
});

walletManager.on('error', (error: WalletError) => {
  console.error('Error:', error.message);
});
```
