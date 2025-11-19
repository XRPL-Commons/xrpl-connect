# XRPL Connect - Vanilla JS Example

This is a demo application showcasing the XRPL Connect wallet toolkit with a vanilla JavaScript frontend.

## Features

- Connect to Xaman Wallet (OAuth2 PKCE flow)
- Connect to WalletConnect (QR code modal)
- Sign XRPL transactions
- Sign arbitrary messages
- Real-time event logging
- Beautiful, responsive UI

## Setup

### 1. Get API Keys

Before running the example, you need to obtain API keys:

#### Xaman API Key

1. Visit [https://apps.xumm.dev/](https://apps.xumm.dev/)
2. Create a new application
3. Copy your API key

#### WalletConnect Project ID

1. Visit [https://cloud.walletconnect.com](https://cloud.walletconnect.com)
2. Create a new project
3. Copy your Project ID

### 2. Configure API Keys

Open `src/main.js` and add your API keys:

```javascript
// Configuration - ADD YOUR API KEYS HERE
const XAMAN_API_KEY = 'YOUR_XAMAN_API_KEY'; // Get from https://apps.xumm.dev/
const WALLETCONNECT_PROJECT_ID = 'YOUR_WALLETCONNECT_PROJECT_ID'; // Get from https://cloud.walletconnect.com
```

### 3. Install Dependencies

From the monorepo root:

```bash
pnpm install
```

### 4. Run Development Server

From this directory:

```bash
pnpm dev
```

Or from the monorepo root:

```bash
pnpm --filter vanilla-js-example dev
```

The application will be available at [http://localhost:5173](http://localhost:5173)

## Usage

### Connecting a Wallet

1. Click either "Xaman Wallet" or "WalletConnect" button
2. For Xaman: A popup window will open for authorization
3. For WalletConnect: A QR code modal will appear - scan with your mobile wallet
4. Once connected, your account info will be displayed

### Signing a Transaction

1. Enter a destination XRPL address (e.g., `rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT`)
2. Enter an amount in drops (1 XRP = 1,000,000 drops)
3. Click "Sign Transaction"
4. Approve the transaction in your wallet
5. The signed transaction hash will be displayed

### Signing a Message

1. Enter any text message
2. Click "Sign Message"
3. Approve the signing request in your wallet
4. The signature will be displayed

### Event Log

All wallet events (connect, disconnect, errors, signatures) are logged in the Event Log section at the bottom of the page.

## Network Configuration

The example is configured to use the **testnet** by default. You can change this in `src/main.js`:

```javascript
const walletManager = new WalletManager({
  adapters: [
    /* ... */
  ],
  network: 'testnet', // Change to 'mainnet', 'devnet', or provide custom config
  autoConnect: true,
  logger: { level: 'info' },
});
```

## Build for Production

```bash
pnpm build
```

The built files will be in the `dist/` directory.

## Troubleshooting

### "WalletConnect project ID is required"

Make sure you've added your WalletConnect Project ID in `src/main.js`.

### "Xaman API key is required"

Make sure you've added your Xaman API key in `src/main.js`.

### Popup Blocked

If the Xaman authorization popup is blocked, enable popups for this site in your browser settings.

### WalletConnect Modal Not Showing

Ensure your WalletConnect Project ID is valid and your internet connection is stable.

## Technologies Used

- **Vite** - Build tool and dev server
- **XRPL Connect Core** - Wallet management
- **Xaman Adapter** - Xaman Wallet integration
- **WalletConnect Adapter** - WalletConnect protocol
- **xrpl.js** - XRPL JavaScript library

## Learn More

- [XRPL Connect Documentation](../../README.md)
- [Xaman Developer Portal](https://xumm.readme.io/)
- [WalletConnect Docs](https://docs.walletconnect.com/)
- [XRPL.org](https://xrpl.org/)

## License

MIT
