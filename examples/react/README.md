# XRPL Connect - React Example

This demo application uses the official XRPL Connect React provider, hooks, and modal component.
It can also add the optional Privy adapter for social login and an embedded XRPL testnet wallet.

## Features

- Connect to Xaman, WalletConnect, Crossmark, GemWallet, Xyra, Otsu, MetaMask Snap, and (when
  configured) Privy social login
- Create or restore a user-owned embedded XRPL wallet through Privy
- Typed React provider, hooks, and wallet modal integration
- Manually request testnet funds, sign XRPL transactions, or sign and submit them
- Sign arbitrary messages when the connected wallet supports it
- Dynamic theme customization
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

#### Privy app ID (optional)

1. Create a browser app in the [Privy dashboard](https://dashboard.privy.io/)
2. Enable the login methods you want to show
3. Add `http://localhost:5173` as an allowed origin and
   `http://localhost:5173/wallet/privy` as an allowed callback URL
4. Copy the public app ID. A client ID is optional when the app uses Privy's default client.

The adapter reads the enabled methods from the dashboard when the social-login chooser opens, so
this example does not maintain a provider list or pass `socialLogins` to the modal.

### 2. Configure API Keys

Open `src/main.tsx` and add your API keys:

```typescript
// Configuration - ADD YOUR API KEYS HERE
const XAMAN_API_KEY = 'YOUR_XAMAN_API_KEY'; // Get from https://apps.xumm.dev/
const WALLETCONNECT_PROJECT_ID = 'YOUR_WALLETCONNECT_PROJECT_ID'; // Get from https://cloud.walletconnect.com
```

To enable Privy, copy the example environment file and set the public values:

```bash
# Run this from examples/react.
cp .env.example .env.local
```

```dotenv
VITE_PRIVY_APP_ID=your_privy_app_id
# Optional:
VITE_PRIVY_CLIENT_ID=your_privy_client_id
# Optional; defaults to http://localhost:5173/wallet/privy.
VITE_PRIVY_REDIRECT_URI=http://localhost:5173/wallet/privy
```

Never put a Privy app secret in frontend configuration. Leave `VITE_PRIVY_APP_ID` empty to run the
existing external-wallet demo without Privy.

### 3. Install Dependencies

From the monorepo root:

```bash
pnpm install
pnpm --filter react-example... build
```

The monorepo uses workspace links. When copying this example into a standalone project, install
the published stable packages explicitly:

```bash
pnpm add @xrpl-commons/xrpl-connect-react @xrpl-commons/xrpl-connect-privy xrpl-connect xrpl@^4 react react-dom
```

### 4. Run Development Server

From this directory:

```bash
pnpm dev
```

Or from the monorepo root:

```bash
pnpm --filter react-example dev
```

The application will be available at [http://localhost:5173](http://localhost:5173). The same app is
served at [http://localhost:5173/wallet/privy](http://localhost:5173/wallet/privy) so an OAuth return
can finish in the React provider. Keep Vite's `strictPort` setting enabled: changing the port changes
the OAuth origin and callback URL.

For deployment, configure an SPA history fallback so `/wallet/privy` serves this
application, and allow the deployed origin and callback in Privy. Restart Vite
after changing `.env.local`.

### 5. Try the Privy flow

When `VITE_PRIVY_APP_ID` is configured, open the wallet modal and choose **Sign in with socials**.
Select an enabled dashboard method and complete authentication. The callback route restores the
same manager session and waits for the embedded XRPL wallet to be ready before showing the account.

After connecting:

1. Click **Fund Testnet Wallet** to request funds manually from the XRPL testnet faucet.
2. Enter a destination and amount in drops.
3. Click **Sign Transaction** to inspect a signed transaction without submitting it, or click
   **Sign & Submit Transaction** to submit it and wait for validation.

Nothing funds an account or signs/submits a transaction automatically. Privy supports XRPL
transaction signing, but not arbitrary message signing; the message form reports that capability
instead of offering an action. Reload the page to test session restoration, use the connector button
to log out, and close a login flow to verify cancellation and retry. Existing external-wallet
adapters remain available whether or not Privy is configured.

## React Integration

This example uses the official React provider, hooks, and modal component. No custom JSX
declarations or manual manager wiring are required.

### 1. Configure the provider once

Create the adapter configuration outside React rendering and pass it to the provider in `main.tsx`:

```tsx
const config: XrplConnectConfig = {
  adapters: [
    new XamanAdapter({ apiKey: XAMAN_API_KEY }),
    new WalletConnectAdapter({ projectId: WALLETCONNECT_PROJECT_ID }),
    new CrossmarkAdapter(),
  ],
  network: 'testnet',
  autoConnect: true,
};

createRoot(document.getElementById('root')!).render(
  <XrplConnectProvider config={config}>
    <App />
  </XrplConnectProvider>
);
```

### 2. Render the React modal component

Use the typed `WalletConnector` wrapper and its callbacks:

```tsx
<WalletConnector
  primaryWallet="xaman"
  theme="dark"
  onConnect={(account) => console.log('Connected', account.address)}
  onError={(error) => console.error(error.code, error.message)}
/>
```

### 3. Consume wallet state and signing actions

Components below the provider share the same manager through `useWallet()` and `useSigner()`:

```tsx
const { connected, account, disconnect, manager } = useWallet();
const { signAndSubmit, signMessage } = useSigner();

const canSignMessage = manager.supports('signMessage');
```

See `src/main.tsx` for provider configuration and `src/components/` for complete state, modal,
transaction, message-signing, and error-handling examples.

## Usage

### Connecting a Wallet

1. Click the "Connect Wallet" button in the top-right corner
2. Select your preferred wallet from the modal
3. For Xaman: A popup window will open for authorization
4. For WalletConnect: A QR code modal will appear - scan with your mobile wallet
5. Once connected, your account info will be displayed

### Changing Themes

1. Use the theme buttons to switch between Dark, Light, and Purple themes
2. The CSS variables are applied dynamically to the web component
3. You can switch themes even while the modal is open!

### Signing a Transaction

1. Enter a destination XRPL address (e.g., `rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT`)
2. Enter an amount in drops (1 XRP = 1,000,000 drops)
3. Click "Sign Transaction" to create a signed blob without submitting, or click "Sign & Submit Transaction"
4. Approve the transaction in your wallet
5. The signed or submitted transaction hash will be displayed

### Signing a Message

The form is available only when the connected wallet declares message-signing support.

1. Connect a wallet that supports message signing
2. Enter any text message
3. Click "Sign Message"
4. Approve the signing request in your wallet
5. The signature will be displayed

### Event Log

All wallet events (connect, disconnect, errors, signatures) are logged in the Event Log section at the bottom of the page.

## Network Configuration

The example is configured to use the **testnet** by default. You can change this in `src/main.tsx`:

```typescript
const config: XrplConnectConfig = {
  adapters: [/* ... */],
  network: 'testnet', // Change to 'mainnet', 'devnet', or provide custom config
  autoConnect: true,
  logger: { level: 'info' },
};
```

## Build for Production

```bash
pnpm build
```

The built files will be in the `dist/` directory.

## Troubleshooting

### "WalletConnect project ID is required"

Make sure you've added your WalletConnect Project ID in `src/main.tsx`.

### "Xaman API key is required"

Make sure you've added your Xaman API key in `src/main.tsx`.

### Popup Blocked

If the Xaman authorization popup is blocked, enable popups for this site in your browser settings.

### WalletConnect Modal Not Showing

Ensure your WalletConnect Project ID is valid and your internet connection is stable.

### TypeScript errors

Install both `@xrpl-commons/xrpl-connect-react` and `xrpl-connect`, and import the provider, hooks, and
component from `@xrpl-commons/xrpl-connect-react`. The package supplies its own declarations; no custom JSX
declaration is required.

## Technologies Used

- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **XRPL Connect Core** - Wallet management
- **XRPL Connect UI** - Web components
- **Xaman Adapter** - Xaman Wallet integration
- **WalletConnect Adapter** - WalletConnect protocol
- **Crossmark Adapter** - Crossmark browser extension
- **GemWallet Adapter** - GemWallet browser extension
- **Privy Adapter** - Optional social login and embedded XRPL wallet
- **xrpl.js** - XRPL JavaScript library

## Learn More

- [XRPL Connect Documentation](../../README.md)
- [React Documentation](https://react.dev/)
- [Xaman Developer Portal](https://xumm.readme.io/)
- [WalletConnect Docs](https://docs.walletconnect.com/)
- [XRPL.org](https://xrpl.org/)

## License

MIT
