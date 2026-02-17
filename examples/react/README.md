# XRPL Connect - React Example

This is a demo application showcasing the XRPL Connect wallet toolkit with a React frontend, using the web component for wallet connectivity.

## Features

- Connect to multiple XRPL wallets (Xaman, WalletConnect, Crossmark, GemWallet)
- React integration with XRPL Connect web component
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

Open `src/App.tsx` and add your API keys:

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

## React Integration with Web Component

This example demonstrates how to integrate the XRPL Connect web component in a React application. Key integration points:

### 1. Import the UI Package

First, import the `@xrpl-connect/ui` package in your entry point (`main.tsx`) to register the custom elements:

```typescript
import '@xrpl-connect/ui'; // Import to register web components
```

This ensures the `<xrpl-wallet-connector>` custom element is registered before React renders.

### 2. TypeScript Declarations

The `vite-env.d.ts` file contains TypeScript declarations for the web component:

```typescript
declare namespace JSX {
  interface IntrinsicElements {
    'xrpl-wallet-connector': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        'primary-wallet'?: string;
        ref?: React.Ref<any>;
      },
      HTMLElement
    >;
  }
}
```

### 3. Using the Web Component

The web component is used in the JSX like a regular React component:

```tsx
<xrpl-wallet-connector
  ref={walletConnectorRef}
  id="wallet-connector"
  style={
    {
      /* CSS variables */
    }
  }
  primary-wallet="xaman"
/>
```

### 4. Accessing the Component

Use a ref to access the web component instance and call its methods. **Important**: Wait for the custom element to be fully defined before calling methods:

```tsx
const walletConnectorRef = useRef<WalletConnectorElement | null>(null);

// Set up the web component after it's fully initialized
useEffect(() => {
  const setupConnector = async () => {
    // Wait for custom element to be defined
    await customElements.whenDefined('xrpl-wallet-connector');

    // Now it's safe to call methods
    if (walletConnectorRef.current) {
      walletConnectorRef.current.setWalletManager(walletManager);
    }
  };

  setupConnector();
}, []);
```

### 5. Event Handling

Listen to custom events from the web component:

```tsx
walletConnector.addEventListener('connected', (e: any) => {
  console.log('Connected!', e.detail);
});
```

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

The example is configured to use the **testnet** by default. You can change this in `src/App.tsx`:

```typescript
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

Make sure you've added your WalletConnect Project ID in `src/App.tsx`.

### "Xaman API key is required"

Make sure you've added your Xaman API key in `src/App.tsx`.

### Popup Blocked

If the Xaman authorization popup is blocked, enable popups for this site in your browser settings.

### WalletConnect Modal Not Showing

Ensure your WalletConnect Project ID is valid and your internet connection is stable.

### TypeScript Errors with Web Component

Make sure the `vite-env.d.ts` file is included in your TypeScript configuration.

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
