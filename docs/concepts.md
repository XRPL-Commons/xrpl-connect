---
description: Learn the key concepts behind XRPL-Connect including WalletManager, adapters, events, and web components.
---

# Core Concepts

XRPL-Connect is built on a few key concepts that work together to provide a seamless wallet integration experience. Understanding these concepts will help you use XRPL-Connect effectively.

## WalletManager

The **WalletManager** is the central orchestrator of XRPL-Connect. It manages wallet connections, handles events, maintains state, and provides methods for signing transactions.

### What It Does

- **Manages adapters** - Holds and coordinates multiple wallet adapters
- **Maintains state** - Tracks current connection status, account info, and network
- **Event system** - Emits events when connections change, errors occur, etc.
- **Session persistence** - Automatically saves and restores wallet sessions
- **Transaction signing** - Provides unified API for signing and submitting transactions

### Lifecycle

```javascript
// 1. Create WalletManager with adapters
const walletManager = new WalletManager({
  adapters: [new XamanAdapter({ apiKey: 'YOUR_API_KEY' })],
  network: 'testnet',
  autoConnect: true,  // Auto-reconnect to previous session
});

// 2. Listen to events
walletManager.on('connect', (account) => {
  console.log('Connected:', account.address);
});

// 3. Use the manager
const result = await walletManager.signAndSubmit(transaction);

// 4. Disconnect when done
await walletManager.disconnect();
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `connected` | `boolean` | Whether a wallet is currently connected |
| `account` | `Account \| null` | Currently connected account info |
| `wallet` | `Wallet \| null` | Currently connected wallet adapter |
| `adapters` | `WalletAdapter[]` | Array of available wallet adapters |

### Key Methods

- `signAndSubmit(transaction)` - Sign and submit transaction to ledger
- `signMessage(message)` - Sign a message with the wallet
- `disconnect()` - Disconnect current wallet
- `on(event, listener)` - Listen to events
- `off(event, listener)` - Remove event listener

## Adapters

**Adapters** are plugins that add support for specific wallets. Each adapter implements a standard interface, making it easy to work with different wallets using the same API.

### What Adapters Do

An adapter acts as a bridge between your application and a specific wallet:

```
Your App → WalletManager → Adapter → Wallet (Xaman/Crossmark/etc)
```

The adapter handles:
- **Wallet detection** - Checking if the wallet is installed/available
- **Connection** - Initiating connection to the wallet
- **Communication** - Sending requests to the wallet and receiving responses
- **Error handling** - Converting wallet-specific errors to standard format
- **Feature support** - Declaring what this wallet can do (signing, message signing, etc)

### Built-in Adapters

#### Xaman Adapter
Connect to Xaman (formerly Xumm) - the most popular XRPL wallet.

```javascript
import { XamanAdapter } from 'xrpl-connect';

const adapter = new XamanAdapter({
  apiKey: 'YOUR_API_KEY',        // Get from https://apps.xumm.dev
  apiSecret: 'YOUR_API_SECRET',  // Optional
});
```

**Features:** Transaction signing, message signing, QR codes, push notifications

#### Crossmark Adapter
Connect to Crossmark - a secure browser extension for XRPL.

```javascript
import { CrossmarkAdapter } from 'xrpl-connect';

const adapter = new CrossmarkAdapter();
```

**Features:** Transaction signing, message signing, no API keys required

#### GemWallet Adapter
Connect to GemWallet - a privacy-focused XRPL wallet.

```javascript
import { GemWalletAdapter } from 'xrpl-connect';

const adapter = new GemWalletAdapter();
```

**Features:** Transaction signing, message signing, no API keys required

#### WalletConnect Adapter
Connect to any wallet using the WalletConnect protocol. Great for mobile wallets.

```javascript
import { WalletConnectAdapter } from 'xrpl-connect';

const adapter = new WalletConnectAdapter({
  projectId: 'YOUR_PROJECT_ID',  // Get from https://cloud.walletconnect.com
});
```

**Features:** Mobile wallet support, QR code connection, enterprise features

### Creating Multiple Adapters

It's common to create a WalletManager with multiple adapters to give users choice:

```javascript
const walletManager = new WalletManager({
  adapters: [
    new XamanAdapter({ apiKey: 'YOUR_API_KEY' }),
    new CrossmarkAdapter(),
    new GemWalletAdapter(),
    new WalletConnectAdapter({ projectId: 'YOUR_PROJECT_ID' }),
  ],
  network: 'testnet',
});
```

Now users can choose which wallet to use, and they'll see all available options in the UI.

## Web Components

The **`<xrpl-wallet-connector>`** is a custom HTML element (web component) that provides a beautiful user interface for wallet selection and account management. It works with any JavaScript framework or vanilla JavaScript.

### What It Is

A web component is a reusable HTML element that encapsulates its own HTML, CSS, and JavaScript. It works like a regular HTML element but with custom functionality.

```html
<!-- Use it like any HTML element -->
<xrpl-wallet-connector id="wallet-connector"></xrpl-wallet-connector>
```

### Key Features

- **Framework agnostic** - Works with Vue, React, Angular, Svelte, or vanilla JS
- **Self-contained** - Styles don't leak in or out
- **Accessible** - Built with accessibility best practices
- **Customizable** - Style using CSS variables
- **Responsive** - Works on desktop and mobile

### What It Shows

The component displays:

1. **Connect Button** - Big button in top-right corner to open wallet selection
2. **Wallet Selection Modal** - List of available wallets when user clicks connect
3. **Loading State** - Shows while connecting to wallet
4. **Account Modal** - Shows connected account, network, and disconnect button
5. **Error States** - Clear error messages when things go wrong

### How to Use It

1. **Create a WalletManager** with your preferred adapters
2. **Add the component** to your HTML
3. **Connect them** by calling `setWalletManager()`

```javascript
// Create manager
const walletManager = new WalletManager({
  adapters: [new XamanAdapter({ apiKey: 'YOUR_API_KEY' })],
  network: 'testnet',
});

// Get component and attach manager
const connector = document.getElementById('wallet-connector');
connector.setWalletManager(walletManager);

// Now the UI works!
walletManager.on('connect', (account) => {
  console.log('User connected:', account.address);
});
```

### Customization

Use CSS variables to customize the component's appearance:

```html
<xrpl-wallet-connector
  id="wallet-connector"
  style="
    --xc-primary-color: #667eea;
    --xc-background-color: #1a202c;
    --xc-text-color: #ffffff;
  "
></xrpl-wallet-connector>
```

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `primary-wallet` | string | Wallet to feature first in the list (e.g., "xaman") |
| `wallets` | string | Comma-separated list of wallet IDs to show (e.g., "xaman,crossmark") |

## How They Work Together

Here's the complete picture of how these concepts interact:

```
1. Developer creates WalletManager
   ↓
   WalletManager({ adapters: [XamanAdapter, CrossmarkAdapter] })

2. Developer creates/gets Web Component
   ↓
   <xrpl-wallet-connector id="connector" />

3. Developer connects them
   ↓
   connector.setWalletManager(walletManager)

4. User interacts with Web Component
   ↓
   Clicks "Connect Wallet" button

5. Web Component requests list from WalletManager
   ↓
   Shows modal with Xaman, Crossmark options

6. User selects Xaman
   ↓
   Web Component calls appropriate Adapter

7. Adapter communicates with Xaman wallet
   ↓
   Opens Xaman, user approves connection

8. Adapter returns account info to WalletManager
   ↓
   WalletManager emits 'connect' event with account

9. Web Component updates to show connected account
   ↓
   User sees "Connected: rN7n7..." with disconnect option

10. Developer listens to events and uses WalletManager API
    ↓
    walletManager.on('connect', (account) => { ... })
    walletManager.signAndSubmit(transaction)
```

## Events

Both WalletManager and the Web Component emit events that you can listen to:

### WalletManager Events

- **connect** - User connected a wallet
- **disconnect** - User disconnected a wallet
- **accountChange** - User switched accounts
- **networkChange** - User switched networks
- **error** - An error occurred

### Web Component Events

- **connecting** - User started connecting
- **connected** - Connection succeeded
- **disconnected** - User disconnected
- **error** - Connection failed

## State Management

XRPL-Connect automatically manages connection state:

- **Persistence** - Saves connection in localStorage
- **Auto-reconnect** - Reconnects on page reload if user was previously connected
- **Reactive updates** - Updates reflect immediately across all listeners
- **Error recovery** - Handles connection failures gracefully

## Summary

- **WalletManager** - The brain: manages state, events, and operations
- **Adapters** - The connectors: bridge between app and specific wallets
- **Web Component** - The UI: beautiful, customizable user interface
- **Events** - The communication: keep your app in sync with wallet state

Understanding these concepts will help you effectively integrate wallet functionality into your applications!
