# XRPL Connect - React Example

This demo application uses the official XRPL Connect React provider, hooks, and modal component.

## Features

- Connect to Xaman, WalletConnect, Crossmark, GemWallet, Xyra, Otsu, and MetaMask Snap
- Typed React provider, hooks, and wallet modal integration
- Sign XRPL transactions
- Sign arbitrary messages
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

### 2. Configure API Keys

Open `src/main.tsx` and add your API keys:

```typescript
// Configuration - ADD YOUR API KEYS HERE
const XAMAN_API_KEY = 'YOUR_XAMAN_API_KEY'; // Get from https://apps.xumm.dev/
const WALLETCONNECT_PROJECT_ID = 'YOUR_WALLETCONNECT_PROJECT_ID'; // Get from https://cloud.walletconnect.com
```

### 3. Install Dependencies

From the monorepo root:

```bash
pnpm install
```

The monorepo uses workspace links. When copying this example into a standalone project, install
the published release candidates explicitly:

```bash
pnpm add @xrpl-commons/xrpl-connect-react@rc xrpl-connect@rc xrpl@^4 react react-dom
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

The application will be available at [http://localhost:5173](http://localhost:5173)

## React Integration

This example uses the official React provider, hooks, and modal component. No custom JSX
declarations, element refs, or manual event listeners are required.

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
const { connected, account, disconnect } = useWallet();
const { signAndSubmit, signMessage } = useSigner();
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
3. Click "Sign & Submit Transaction"
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

Install both `@xrpl-commons/xrpl-connect-react@rc` and `xrpl-connect@rc`, and import the provider, hooks, and
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
- **xrpl.js** - XRPL JavaScript library

## Learn More

- [XRPL Connect Documentation](../../README.md)
- [React Documentation](https://react.dev/)
- [Xaman Developer Portal](https://xumm.readme.io/)
- [WalletConnect Docs](https://docs.walletconnect.com/)
- [XRPL.org](https://xrpl.org/)

## License

MIT
