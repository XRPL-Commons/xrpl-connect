# @xrpl-connect/ui - Code Documentation

## Overview

`@xrpl-connect/ui` is a framework-agnostic web component that provides a production-ready user interface for wallet connection. It wraps the `WalletManager` from `@xrpl-connect/core` and multiple wallet adapters from `@xrpl-connect/adapters`, presenting users with a polished modal-based experience for connecting to XRPL wallets.

**Key Responsibility**: Render a beautiful, accessible, responsive UI component that handles wallet selection, QR code display, loading states, error handling, and user feedback—all wrapped in a custom HTML element that works in any JavaScript environment.

---

## What is a Web Component?

A Web Component is a reusable, encapsulated HTML element built using the Web Components standard APIs:

- **Custom Elements**: Define your own HTML elements (e.g., `<xrpl-wallet-connector>`)
- **Shadow DOM**: Encapsulate internal DOM and styles so they don't leak to the host application
- **HTML Templates**: Define reusable markup
- **Slots**: Allow content projection into the component

### Why Web Components for xrpl-connect/ui?

1. **Framework-agnostic**: Works with React, Vue, Angular, Svelte, vanilla JS, etc.
2. **Reusable**: Include the same element in multiple places
3. **Isolated Styles**: CSS inside Shadow DOM doesn't interfere with app styles
4. **Native**: Uses browser standards, no additional dependencies
5. **Easy Integration**: Just include a script tag or import in your app

---

## The `<xrpl-wallet-connector>` Component

### Basic Usage

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="module">
      import { WalletManager } from '@xrpl-connect/core';
      import { XamanAdapter, CrossmarkAdapter } from '@xrpl-connect/adapters';

      const walletManager = new WalletManager({
        adapters: [
          new XamanAdapter({ apiKey: 'YOUR_KEY' }),
          new CrossmarkAdapter()
        ],
        network: 'mainnet',
        autoConnect: true
      });

      const connector = document.querySelector('xrpl-wallet-connector');
      connector.setWalletManager(walletManager);
    </script>
  </head>
  <body>
    <xrpl-wallet-connector
      primary-wallet="xaman"
      style="
        --xrpl-primary-color: #0EA5E9;
        --xrpl-background-color: #000637;
        --xrpl-text-color: #F5F4E7;
      "
    ></xrpl-wallet-connector>
  </body>
</html>
```

### HTML Attributes

All attributes are optional and control the behavior of the component:

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `primary-wallet` | string | - | Wallet ID to display first (e.g., `'xaman'`) |
| `wallets` | string | - | Comma-separated list of wallet IDs to include (e.g., `'xaman,crossmark,walletconnect'`) |

All styling is controlled exclusively via CSS variables (see [Customization](./CUSTOMIZATION.md) guide).

### JavaScript API

The web component provides a public API for programmatic control:

```typescript
interface WalletConnectorElement extends HTMLElement {
  setWalletManager(manager: WalletManager): void;
  open(): void;
  close(): void;
  toggle(): void;
}
```

#### `setWalletManager(manager: WalletManager)`

Assigns the `WalletManager` instance to the component. **Required** before the component can function.

```typescript
const connector = document.querySelector('xrpl-wallet-connector');
const walletManager = new WalletManager({ adapters: [...] });
connector.setWalletManager(walletManager);
```

#### `open()`

Opens the wallet connection modal.

```typescript
const connector = document.querySelector('xrpl-wallet-connector');
connector.open();
```

#### `close()`

Closes the wallet connection modal.

```typescript
const connector = document.querySelector('xrpl-wallet-connector');
connector.close();
```

#### `toggle()`

Toggles the modal open/closed.

```typescript
const connector = document.querySelector('xrpl-wallet-connector');
connector.toggle();
```

---

## Events

The component emits custom events that applications can listen to:

### `open` Event

Emitted when the modal opens.

```typescript
const connector = document.querySelector('xrpl-wallet-connector');

connector.addEventListener('open', () => {
  console.log('Modal opened');
  // Track user interaction, etc.
});
```

**Event Detail**: None

---

### `close` Event

Emitted when the modal closes.

```typescript
connector.addEventListener('close', () => {
  console.log('Modal closed');
  // Clean up, analytics, etc.
});
```

**Event Detail**: None

---

### `connecting` Event

Emitted when the user clicks on a wallet to initiate connection.

```typescript
connector.addEventListener('connecting', (e) => {
  console.log('Connecting to wallet:', e.detail.walletId);
  // Show connecting state to user, disable buttons, etc.
});
```

**Event Detail**:
```typescript
{
  walletId: string  // ID of the wallet being connected (e.g., 'xaman')
}
```

---

### `connected` Event

Emitted when the user successfully connects to a wallet.

```typescript
connector.addEventListener('connected', (e) => {
  const { walletId } = e.detail;
  const { address, network } = walletManager.account;

  console.log(`Connected to ${walletId}`);
  console.log(`Address: ${address}`);
  console.log(`Network: ${network.name}`);

  // Auto-close modal on successful connection
  connector.close();

  // Update your app UI with connected state
  showConnectedUI(address);
});
```

**Event Detail**:
```typescript
{
  walletId: string  // ID of the connected wallet
}
```

---

### `error` Event

Emitted when connection fails.

```typescript
connector.addEventListener('error', (e) => {
  const { error, walletId, errorType } = e.detail;

  console.error(`Failed to connect to ${walletId}`);
  console.error(`Error: ${error.message}`);
  console.error(`Type: ${errorType}`);

  // Show error message to user, log to analytics, etc.
});
```

**Event Detail**:
```typescript
{
  error: Error | WalletError;    // The error object
  walletId: string;              // ID of the wallet
  errorType: string;             // Error type ('connection_rejected', 'wallet_not_available', etc.)
}
```

---

## Component States & UI Views

The component displays different views based on the current state:

### 1. List View (Default)

Shows available wallets as a grid of cards.

**Displays when**:
- Modal is opened
- No wallet selected yet
- User clicked "back" from another view

**UI Elements**:
- Wallet cards with icon, name, and status
- Primary wallet (if configured) displayed prominently
- Status badges (e.g., "Installed", "Not installed")

---

### 2. QR Code View

Shows a QR code for mobile scanning (for QR-based adapters like WalletConnect and Xaman).

**Displays when**:
- User selects a QR-code-based wallet
- QR code URI is generated

**UI Elements**:
- Large QR code image
- Wallet icon and name
- "Copy to Clipboard" button for manual pairing
- "Back" button to return to wallet list
- Loading indicator while generating QR code

---

### 3. Loading View

Shows loading state while awaiting wallet response.

**Displays when**:
- Connection is in progress
- Waiting for user action in wallet app
- Polling for transaction response

**UI Elements**:
- Spinning loader animation
- Wallet icon and name
- Status text (e.g., "Waiting for approval...")
- Can be interrupted by "Back" button

---

### 4. Error View

Shows error message and recovery options.

**Displays when**:
- Connection attempt failed
- Wallet rejected the request
- Wallet is not available
- Wallet does not support the network

**UI Elements**:
- Error icon and message
- Error details
- "Retry" button to try again
- "Back" button to return to wallet list
- Action buttons based on error type

---

## Customization

The component is fully customizable using CSS variables. See the [Customization Guide](./CUSTOMIZATION.md) for comprehensive documentation.

### Theme Colors

Control the appearance via CSS variables:

```html
<xrpl-wallet-connector
  style="
    --xrpl-background-color: #1a1a2e;
    --xrpl-text-color: #eaeaea;
    --xrpl-primary-color: #00d4ff;
    --xrpl-font-family: 'Inter', sans-serif;
  "
></xrpl-wallet-connector>
```

Or define variables in your stylesheet:

```css
:root {
  --xrpl-background-color: #1a1a2e;
  --xrpl-text-color: #eaeaea;
  --xrpl-primary-color: #00d4ff;
  --xrpl-font-family: 'Inter', sans-serif;
}
```

### Primary Wallet

Make a wallet appear first (useful for default choice):

```html
<xrpl-wallet-connector primary-wallet="xaman"></xrpl-wallet-connector>
```

### Wallet Selection

Specify which wallets to include:

```html
<xrpl-wallet-connector wallets="xaman,crossmark,walletconnect"></xrpl-wallet-connector>
```

---

## Integration Patterns

### React

```typescript
import { useEffect, useRef } from 'react';
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapters';

function WalletConnection() {
  const connectorRef = useRef<any>(null);

  useEffect(() => {
    const walletManager = new WalletManager({
      adapters: [new XamanAdapter({ apiKey: 'YOUR_KEY' })],
      network: 'mainnet'
    });

    if (connectorRef.current) {
      connectorRef.current.setWalletManager(walletManager);
    }

    const handleConnected = (e) => {
      console.log('Connected:', e.detail.walletId);
      connectorRef.current?.close();
    };

    const handleError = (e) => {
      console.error('Connection error:', e.detail.error);
    };

    if (connectorRef.current) {
      connectorRef.current.addEventListener('connected', handleConnected);
      connectorRef.current.addEventListener('error', handleError);
    }

    return () => {
      if (connectorRef.current) {
        connectorRef.current.removeEventListener('connected', handleConnected);
        connectorRef.current.removeEventListener('error', handleError);
      }
    };
  }, []);

  return (
    <xrpl-wallet-connector
      ref={connectorRef}
      primary-wallet="xaman"
      primary-color="#0EA5E9"
    />
  );
}
```

### Vue

```vue
<template>
  <xrpl-wallet-connector
    ref="connector"
    primary-wallet="xaman"
    @connected="handleConnected"
    @error="handleError"
  />
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter } from '@xrpl-connect/adapters';

const connector = ref();

onMounted(() => {
  const walletManager = new WalletManager({
    adapters: [new XamanAdapter({ apiKey: 'YOUR_KEY' })],
    network: 'mainnet'
  });

  connector.value.setWalletManager(walletManager);
});

const handleConnected = (e) => {
  console.log('Connected:', e.detail.walletId);
  connector.value.close();
};

const handleError = (e) => {
  console.error('Connection error:', e.detail.error);
};
</script>
```

### Vanilla JavaScript

```javascript
import { WalletManager } from '@xrpl-connect/core';
import { XamanAdapter, CrossmarkAdapter } from '@xrpl-connect/adapters';

// Initialize wallet manager
const walletManager = new WalletManager({
  adapters: [
    new XamanAdapter({ apiKey: 'YOUR_KEY' }),
    new CrossmarkAdapter()
  ],
  network: 'mainnet',
  autoConnect: true
});

// Get component reference
const connector = document.querySelector('xrpl-wallet-connector');

// Register wallet manager
connector.setWalletManager(walletManager);

// Handle events
connector.addEventListener('connected', (e) => {
  const { address } = walletManager.account;
  console.log(`Connected: ${address}`);

  // Show success message
  showNotification('Wallet connected!', 'success');

  // Close modal
  connector.close();

  // Update UI
  updateAppState(walletManager.account);
});

connector.addEventListener('error', (e) => {
  const { error, walletId } = e.detail;
  console.error(`${walletId} failed:`, error.message);

  // Show error message
  showNotification(`Failed to connect: ${error.message}`, 'error');
});

connector.addEventListener('connecting', (e) => {
  console.log(`Connecting to ${e.detail.walletId}...`);
});

// Optional: Add button to open modal
document.getElementById('connect-button').addEventListener('click', () => {
  connector.open();
});
```

---

## Internal Architecture

### Component Class Structure

**Location**: `src/wallet-connector.ts`

The web component extends `HTMLElement` and uses the Shadow DOM for style isolation:

```typescript
class WalletConnectorElement extends HTMLElement {
  private shadow: ShadowRoot;
  private walletManager: WalletManager | null = null;

  // View state
  private viewState: 'list' | 'qr' | 'loading' | 'error' = 'list';
  private isOpen: boolean = false;

  // QR Code data
  private qrCodeData: { walletId: string; uri: string } | null = null;

  // Loading data
  private loadingData: { walletId: string; walletName: string; walletIcon?: string } | null = null;

  // Error data
  private errorData: { walletId: string; walletName: string; error: Error } | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.render();
  }

  // Lifecycle hooks
  connectedCallback(): void { /* ... */ }
  attributeChangedCallback(name: string, oldValue: string, newValue: string): void { /* ... */ }

  // Public methods
  setWalletManager(manager: WalletManager): void { /* ... */ }
  open(): void { /* ... */ }
  close(): void { /* ... */ }
  toggle(): void { /* ... */ }

  // Rendering
  private render(): void { /* ... */ }
  private renderListView(): string { /* ... */ }
  private renderQRView(): string { /* ... */ }
  private renderLoadingView(): string { /* ... */ }
  private renderErrorView(): string { /* ... */ }

  // Event handlers
  private handleWalletClick(walletId: string): void { /* ... */ }
  private handleConnect(walletId: string): Promise<void> { /* ... */ }
  private handleError(error: Error, walletId: string): void { /* ... */ }

  // Private helpers
  private showQRCode(uri: string, walletId: string): void { /* ... */ }
  private showLoading(walletId: string): void { /* ... */ }
  private showError(error: Error, walletId: string): void { /* ... */ }
  private back(): void { /* ... */ }
  private emit(eventName: string, detail?: any): void { /* ... */ }
}

customElements.define('xrpl-wallet-connector', WalletConnectorElement);
```

### Shadow DOM Structure

The component creates an isolated DOM tree inside the Shadow DOM:

```html
#shadow-root (open)
  <style>
    /* Scoped styles */
  </style>

  <div class="overlay">
    <div class="modal">
      <div class="modal-header">
        <h2>Connect Wallet</h2>
        <button class="close-btn">×</button>
      </div>

      <div class="modal-content">
        <!-- View content inserted here -->
        <!-- List view, QR view, Loading view, or Error view -->
      </div>
    </div>
  </div>
```

### Styling

The component includes comprehensive CSS for:

- **Modal layout**: Centered overlay with responsive sizing
- **Animations**: Fade-in overlay, slide-up modal, height transitions
- **Wallet cards**: Grid layout with hover effects and icons
- **QR code view**: Centered QR code with copy button
- **Loading state**: Spinner animation
- **Error state**: Error icon and messaging
- **Responsive design**: Mobile, tablet, and desktop layouts

All styles are scoped within the Shadow DOM to prevent conflicts.

---

## Connection Flow

Here's how the component orchestrates the wallet connection process:

```
User Interaction
    ↓
Click "Connect Wallet" button
    ↓
Component opens modal
    ↓
Display wallet list view
    ↓
User clicks wallet
    ↓
Is QR-based? → Yes → Generate QR code → Show QR view
    ↓ No
Show loading view
    ↓
Call walletManager.connect(walletId, options)
    ↓
Success?
    ├─ Yes → Emit 'connected' event → Close modal
    └─ No → Show error view → User clicks retry → Repeat connection
```

---

## Performance Optimizations

### QR Code Pre-generation

The component eagerly generates QR codes for WalletConnect adapters before the user sees them. This reduces perceived latency.

```typescript
private async preloadQRCode(walletId: string): Promise<void> {
  // Pre-generate QR before user sees it
  // Caches in memory for quick display
}
```

### Browser Detection

Special handling for Safari and mobile browsers optimizes the UX:

```typescript
private isSafari(): boolean { /* ... */ }
private isMobile(): boolean { /* ... */ }
```

### Lazy Rendering

The component only renders the active view, not hidden views, for efficiency.

---

## File Structure

```
packages/ui/src/
├── index.ts                    # Main export
├── wallet-connector.ts         # WalletConnectorElement class
├── constants.ts                # UI configuration (sizes, colors, timings)
├── utils.ts                    # Helper functions
│   ├── generateQRCode()        # QR code generation
│   ├── detectBrowser()         # Browser detection
│   ├── isMobile()              # Device detection
│   └── copyToClipboard()       # Clipboard helper
└── types.ts                    # TypeScript type definitions
```

---

## Accessibility

The component is designed with accessibility in mind:

- **Semantic HTML**: Uses proper heading levels, button elements, etc.
- **ARIA Labels**: Buttons and interactive elements have descriptive labels
- **Keyboard Navigation**: Tab through wallet options, Enter to select
- **Focus Management**: Focus moves appropriately as modal state changes
- **Color Contrast**: Text colors have sufficient contrast
- **Mobile-Friendly**: Touch targets are appropriately sized

---

## Browser Support

The component works in all modern browsers that support:

- Web Components (Custom Elements + Shadow DOM)
- ES2020+ JavaScript
- CSS Grid and Flexbox
- SVG for icons

**Supported Browsers**:
- Chrome/Chromium 76+
- Firefox 63+
- Safari 10.1+
- Edge 79+

---

## Common Issues & Troubleshooting

### Component Not Displaying

**Problem**: The `<xrpl-wallet-connector>` element doesn't appear.

**Solutions**:
1. Ensure the web component module is imported before using it
2. Check that JavaScript is enabled
3. Verify the component was registered with `customElements.define()`

```typescript
// Make sure to import
import '@xrpl-connect/ui';
```

---

### WalletManager Not Set

**Problem**: Click on wallet does nothing; no error in console.

**Solutions**:
1. Call `connector.setWalletManager(walletManager)` after initializing `WalletManager`
2. Ensure `WalletManager` is created before setting it on the component

```typescript
const manager = new WalletManager({ adapters: [...] });
connector.setWalletManager(manager);  // Required!
```

---

### Events Not Firing

**Problem**: `connected` or `error` event listeners don't trigger.

**Solutions**:
1. Use `addEventListener()`, not React props (unless using a wrapper)
2. Ensure listener is added after `setWalletManager()`
3. Check event name is exactly `'connected'`, `'error'`, etc.

```typescript
// Correct
connector.addEventListener('connected', (e) => {
  console.log(e.detail.walletId);
});

// Incorrect - web components don't use React props
<xrpl-wallet-connector onConnected={handleConnected} />
```

---

### Styles Not Applying

**Problem**: CSS variable colors don't change appearance.

**Solutions**:
1. Ensure variable names use the `--xrpl-` prefix (e.g., `--xrpl-primary-color`)
2. Use valid hex colors or CSS color values (e.g., `#0EA5E9`, not `blue`)
3. Set variables via `style` attribute or CSS before the component renders

```html
<!-- Correct -->
<xrpl-wallet-connector
  style="
    --xrpl-background-color: #000637;
    --xrpl-text-color: #F5F4E7;
  "
></xrpl-wallet-connector>

<!-- Also correct (in stylesheet) -->
<style>
  xrpl-wallet-connector {
    --xrpl-background-color: #000637;
    --xrpl-text-color: #F5F4E7;
  }
</style>
```

---

## Migration Guide

### From Button Component to Modal

If your app previously used a button-only approach, the modal component provides a better UX:

**Before**:
```html
<button id="connect-btn">Connect Wallet</button>
<script>
  document.getElementById('connect-btn').addEventListener('click', async () => {
    // Manual wallet selection
    // Manual modal management
  });
</script>
```

**After**:
```html
<xrpl-wallet-connector primary-wallet="xaman"></xrpl-wallet-connector>
<button onclick="document.querySelector('xrpl-wallet-connector').open()">
  Connect Wallet
</button>
```

### From HTML Attributes to CSS Variables

Previous versions used HTML attributes for styling. The component now uses CSS variables exclusively for better flexibility and theming:

**Old approach (no longer supported)**:
```html
<xrpl-wallet-connector
  background-color="#000637"
  text-color="#F5F4E7"
  primary-color="#0EA5E9"
></xrpl-wallet-connector>
```

**New approach (CSS variables)**:
```html
<xrpl-wallet-connector
  style="
    --xrpl-background-color: #000637;
    --xrpl-text-color: #F5F4E7;
    --xrpl-primary-color: #0EA5E9;
  "
></xrpl-wallet-connector>
```

Benefits of CSS variables:
- **Dynamic theming** - Change colors at runtime without re-rendering
- **Cascading** - Define variables once in CSS, apply everywhere
- **Better performance** - No JavaScript parsing of color values
- **Advanced features** - Support for gradients and complex values
- **Auto-derived colors** - Hover states automatically calculated from base colors

---

## Best Practices

1. **Use CSS Variables for Theming**: Define theme colors in your stylesheet or inline styles for consistency across your app

2. **Set WalletManager After DOM Ready**: Ensure the component exists in the DOM before calling `setWalletManager()`

3. **Listen to Events Early**: Add event listeners immediately after setting up the component

4. **Handle All Event Types**: Listen to `connected`, `error`, and `connecting` for a complete flow

5. **Close Modal on Success**: Use the `close()` method or auto-close on successful connection

6. **Persist Connection**: Use `autoConnect: true` in WalletManager to remember the user's wallet

7. **Show Network Info**: Display the connected network to the user from `walletManager.account.network`

8. **Graceful Error Handling**: Catch and display errors rather than letting them silently fail

9. **Test Mobile UX**: Test QR code scanning on actual mobile devices

---

## Extending the Component

The component is designed to be self-contained, but you can extend it by:

1. **CSS Customization**: Use CSS variables to customize colors, sizing, and other visual properties (see [Customization Guide](./CUSTOMIZATION.md))
2. **Wrapping in Framework Components**: Create React/Vue wrappers if needed
3. **Custom Adapters**: Create custom wallet adapters for additional wallet support
4. **Event Monitoring**: Listen to all events and send to analytics

```typescript
// Example: Custom error tracking
connector.addEventListener('error', (e) => {
  analytics.track('wallet_connection_failed', {
    walletId: e.detail.walletId,
    errorCode: e.detail.error.code,
    errorMessage: e.detail.error.message
  });
});
```
