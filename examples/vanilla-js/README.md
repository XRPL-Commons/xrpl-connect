# XRPL Connect - Vanilla JS Example

This is a demo application showcasing the XRPL Connect wallet toolkit with a vanilla JavaScript frontend.

## Features

- Connect to Xaman Wallet (OAuth2 PKCE flow)
- Connect to WalletConnect (QR code modal)
- Optionally sign in with Privy and use an embedded XRPL wallet
- Sign XRPL transactions
- Request testnet funding and sign a transaction without submitting it
- Sign arbitrary messages when the connected wallet supports it
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

To enable the optional Privy social-login adapter, copy the example environment file and set your
public app ID:

```bash
cp .env.example .env.local
```

```dotenv
VITE_PRIVY_APP_ID=your-public-privy-app-id
# Optional:
VITE_PRIVY_CLIENT_ID=your-public-privy-client-id
VITE_PRIVY_REDIRECT_URI=http://localhost:5170/wallet/privy
```

In the Privy dashboard, enable the login methods you want and allow both
`http://localhost:5170` as an app origin and `http://localhost:5170/wallet/privy` as a callback URL.
The wallet picker discovers enabled methods from the dashboard; no provider list or social-login
configuration is duplicated in this example. The app ID and client ID are public values. Never put
a Privy app secret or another backend secret in frontend configuration.

### 3. Install Dependencies

From the monorepo root:

```bash
pnpm install
pnpm build
```

`pnpm build` is required before running the example because its XRPL Connect and adapter packages
are workspace dependencies.

The monorepo uses workspace links. When copying this example into a standalone project, install the
published stable package and its XRPL peer explicitly:

```bash
pnpm add xrpl-connect @xrpl-commons/xrpl-connect-privy xrpl@^4
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

The application will be available at [http://localhost:5170](http://localhost:5170). The Vite server
uses a strict port so the origin remains stable for wallet and Privy callback configuration.

## Usage

### Connecting a Wallet

1. Click **Connect Wallet** and choose an adapter from the wallet picker.
2. For Xaman: A popup window will open for authorization.
3. For WalletConnect: A QR code modal will appear - scan with your mobile wallet.
4. If Privy is configured, choose **Sign in with socials** and select one of the methods enabled in
   the Privy dashboard. The callback route is `/wallet/privy` on the same origin.
5. Once connected, your account info will be displayed

### Signing a Transaction

1. For a new embedded Privy account, click **Fund Testnet Account** and wait for the faucet payment
   to confirm.
2. Click **Sign AccountSet Only** to test signing without submitting a transaction.
3. To send a payment, enter a destination XRPL address (e.g.,
   `rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT`) and an amount in drops (1 XRP = 1,000,000 drops), then
   click **Sign & Submit Transaction**.
4. Approve the transaction in your wallet. The signed transaction hash and validated result are
   displayed.

The demo never submits a transaction automatically during login or restoration. Privy supports XRPL
transaction signing and submission, but not arbitrary message signing, so the message form remains
hidden when a Privy wallet is connected.

### Signing a Message

The form is shown only when the connected wallet declares message-signing support.

1. Connect a wallet that supports message signing
2. Enter any text message
3. Click "Sign Message"
4. Approve the signing request in your wallet
5. The signature will be displayed

### Event Log

All wallet events (connect, disconnect, errors, signatures) are logged in the Event Log section at the bottom of the page.

## Network Configuration

The example is configured to use the **testnet** by default. You can change this in `src/main.js`:

```javascript
const walletManager = new WalletManager({
  adapters: [/* ... */],
  network: 'testnet', // Change to 'mainnet', 'devnet', or provide custom config
  autoConnect: false,
  logger: { level: 'info' },
});
```

The demo calls `walletManager.reconnect()` explicitly after installing the web component and its
listeners so saved sessions and Privy OAuth returns have visible restoration/error status.

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
- **Privy Adapter** - Optional Privy social login and embedded XRPL wallets
- **MetaMask Snap Adapter** - XRPL accounts and transactions through MetaMask Snaps
- **xrpl.js** - XRPL JavaScript library

## Learn More

- [XRPL Connect Documentation](../../README.md)
- [Xaman Developer Portal](https://xumm.readme.io/)
- [WalletConnect Docs](https://docs.walletconnect.com/)
- [XRPL.org](https://xrpl.org/)

## License

MIT
