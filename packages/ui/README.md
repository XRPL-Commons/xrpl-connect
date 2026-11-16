# @xrpl-connect/ui - Code Documentation

## Overview

`@xrpl-connect/ui` is a framework-agnostic web component that provides a production-ready user interface for wallet connection. It wraps the `WalletManager` from `@xrpl-connect/core` and adapters from the individual `@xrpl-connect/adapter-*` packages, presenting users with a polished modal-based experience for connecting to XRPL wallets.

Applications install and import it from the published `xrpl-connect` package, which re-exports the
component together with the core manager and every adapter. Importing from `xrpl-connect` also
registers the element.

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
<!doctype html>
<html>
  <head></head>
  <body>
    <xrpl-wallet-connector
      primary-wallet="xaman"
      style="
        --xc-primary-color: #0EA5E9;
        --xc-background-color: #000637;
        --xc-text-color: #F5F4E7;
      "
    ></xrpl-wallet-connector>
    <script type="module">
      import { WalletManager, XamanAdapter, CrossmarkAdapter } from 'xrpl-connect';

      const walletManager = new WalletManager({
        adapters: [new XamanAdapter({ apiKey: 'YOUR_KEY' }), new CrossmarkAdapter()],
        network: 'mainnet',
        autoConnect: true,
      });

      await customElements.whenDefined('xrpl-wallet-connector');
      document.querySelector('xrpl-wallet-connector').setWalletManager(walletManager);
    </script>
  </body>
</html>
```

### HTML Attributes

All attributes are optional and control the behavior of the component:

The native `nonce` attribute authorizes connector styles under CSP. Set it before mounting; see
[Strict CSP](#strict-csp).

| Attribute          | Type    | Default | Description                                                                               |
| ------------------ | ------- | ------- | ----------------------------------------------------------------------------------------- |
| `primary-wallet`   | string  | -       | Wallet ID to display first (e.g., `'xaman'`)                                              |
| `wallets`          | string  | -       | Comma-separated list of wallet IDs to include (e.g., `'xaman,crossmark,walletconnect'`)   |
| `show-unavailable` | boolean | false   | Show unavailable wallets with an Install link, or a disabled row when no URL is available |

Use the supported CSS variables and stable shadow parts documented in the
[Customization Guide](https://github.com/XRPL-Commons/xrpl-connect/blob/develop/docs/guide/customization.md).

### Strict CSP

Set the native `nonce` attribute to the server-generated style nonce **before** mounting the
connector. It is copied to every internal stylesheet,
including the wallet and account portals. No Google Fonts are loaded.

```html
<xrpl-wallet-connector nonce="RESPONSE_NONCE" class="wallet-theme"></xrpl-wallet-connector>
```

Allow that nonce in `style-src` (and `style-src-elem` if specified), keep
`style-src-attr 'none'`, and put static theme overrides in an allowed external stylesheet.
Use `element.nonce` when reading it; browsers hide `getAttribute('nonce')`.

When a sign-in prompt requires a CAPTCHA, the connector loads the provider's script on demand from
`https://challenges.cloudflare.com` (Turnstile) or `https://js.hcaptcha.com` (hCaptcha). Allow that
origin in `script-src`, along with the `frame-src` and `connect-src` entries the provider documents
for its widget. The script element carries the connector's `nonce`.
See the [complete CSP setup and limitations](https://github.com/XRPL-Commons/xrpl-connect/blob/develop/docs/guide/production.md#strict-content-security-policy).

### JavaScript API

The web component provides a public API for programmatic control:

```typescript
interface WalletConnectorElementInstance extends HTMLElement {
  socialLogins: readonly SocialLogin[];
  setWalletManager(manager: WalletManager): void;
  open(): Promise<void>;
  openAndWait(): Promise<AccountInfo>;
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

#### `socialLogins`

Optional application entries for the **Sign in with socials** chooser. It is a JavaScript
property, not an HTML attribute. Each `SocialLogin` has an `id`, a `label`, the `adapterId` of a
registered adapter, an optional `icon`, and optional `connectOptions` passed to that adapter's
`connect()`. Entries without an ID or label, with a duplicate ID, or naming an adapter the manager
does not register are ignored. An entry always shows its adapter, even when `wallets` omits it.

```typescript
connector.socialLogins = [
  {
    id: 'company',
    label: 'Company account',
    adapterId: 'privy',
    connectOptions: { loginMethod: 'company' },
  },
];
```

Adapters that implement `getLoginMethods()`, such as the Privy adapter, add their methods to the
chooser without this property; those adapters follow the `wallets` attribute.

#### `open()`

Opens the wallet connection modal immediately. Availability discovery starts when the mounted
connector has a manager and runs in the background. Each available wallet appears as soon as its
check finishes, while the loading status remains for pending checks. Cached available wallets stay
usable during refresh. Unavailable wallets are rechecked on open and retried promptly while the
list stays open, allowing extensions that initialize later to appear without a page reload.
`await open()` waits for the modal to open, not for discovery or a wallet connection.

```typescript
const connector = document.querySelector('xrpl-wallet-connector');
connector.open();
```

#### `openAndWait()`

Opens the modal and resolves with the connected account. It resolves immediately
if the manager is already connected, and rejects if no manager is configured or
the user closes the modal first.

```typescript
const account = await connector.openAndWait();
console.log(account.address);
```

Successful connections also update the most-recently-used ordering stored at
`localStorage["xrpl-connect:mru-wallets"]`. The `primary-wallet` attribute still
has priority over this ordering.

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

**Event Detail**: None.

---

### `close` Event

Emitted when the modal closes.

```typescript
connector.addEventListener('close', () => {
  console.log('Modal closed');
  // Clean up, analytics, etc.
});
```

**Event Detail**: `{ connectionAttemptId: number }` when closing cancels an active connection
attempt; otherwise no detail.

---

### `cancelled` Event

Emitted when an in-progress connection flow is cancelled while the modal remains open, such as
when the user returns to the wallet list.

```typescript
connector.addEventListener('cancelled', (e) => {
  console.log('Connection flow cancelled:', e.detail.reason);
});
```

**Event Detail**:

```typescript
{
  reason: 'wallet-list';
  connectionAttemptId: number; // The active attempt cancelled by returning to the list
}
```

This settles every active connection attempt started by this connector. It does not mean the modal
closed and does not disconnect an established wallet session.

---

### `connecting` Event

Emitted immediately before the component hands a connection attempt to the wallet manager.

```typescript
connector.addEventListener('connecting', (e) => {
  console.log('Connecting to wallet:', e.detail.walletId);
  // Show connecting state to user, disable buttons, etc.
});
```

**Event Detail**:

```typescript
{
  walletId: string; // ID of the wallet being connected (e.g., 'xaman')
  connectionAttemptId?: number; // Correlates this attempt with connected/error when present
  accountIndex?: number; // Ledger account selection only
  derivationPath?: string; // Ledger custom derivation path only
}
```

---

### `connected` Event

Emitted when the user successfully connects to a wallet.
For UI-owned connections, this event is dispatched before the connector closes the modal.

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
  walletId: string; // ID of the connected wallet
  connectionAttemptId?: number; // Matches the connecting event when both include an ID
  accountIndex?: number; // Ledger account selection only
  derivationPath?: string; // Ledger custom derivation path only
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
  error: Error | WalletError; // The error object
  walletId: string; // ID of the wallet
  errorType: 'rejected' | 'unavailable' | 'failed';
  connectionAttemptId?: number; // Correlates this failure with its attempt when present
}
```

`connected`, `error`, and `cancelled` settle connection attempts. When `connectionAttemptId` is
present, use it to correlate a `connecting` event with `connected` or `error`; consumers must also
tolerate producers that omit the optional ID. `cancelled` identifies the active flow invalidated by
returning to the list, so consumers can reject a late preflight error even when no `connecting`
event was emitted first.
Validation, availability checks, and Ledger account discovery can fail before a `connecting` event
is emitted. Those preflight `error` events can still include a `connectionAttemptId`, so do not
require a preceding `connecting` event before handling an error.

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
- A **Sign in with socials** entry when a social login is available. Adapters that provide social
  logins are listed behind it rather than as wallet rows.

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

### 5. Social Sign-In View

Lists the social login methods, such as Google or email, offered by social-login adapters.

**Displays when**:

- User selects **Sign in with socials** in the wallet list

**UI Elements**:

- One button per method: `socialLogins` entries first, then the methods each adapter's
  `getLoginMethods()` returns, fetched again every time the view opens
- A loading status while methods load, and a "Try again" button for an adapter whose methods
  failed to load or timed out
- "Back" button to return to wallet list

---

### 6. Authentication Prompt View

Shows input a wallet requests through `onAuthPrompt()` while this component connects it, such as
the Privy adapter's email or SMS code step.

**UI Elements**:

- Title, description, and the fields the wallet asks for
- A one-time code entered in a row of digit cells, with paste support
- A Cloudflare Turnstile or hCaptcha challenge when the prompt requires one
  (see [Strict CSP](#strict-csp) for its script origins)
- A QR code and an "Open authentication page" link for sign-ins approved in another app,
  such as Farcaster
- Submit button and an optional secondary action, such as "Resend code"; "Back" cancels the step

---

### 7. Transaction Review View

Shows a transaction that a connected wallet, such as the Privy embedded wallet, is
waiting to sign. The wallet sends it as an `onAuthPrompt()` prompt with a `review`;
the component listens to the connected wallet for as long as it stays connected.

**Displays when**:

- A connected wallet asks the user to approve a transaction. The component opens
  the modal for it if it was closed (emitting `open`) and closes it once the review
  is answered or withdrawn (emitting `close`). An open account modal is closed first.

**UI Elements**:

- Title, description, and a scrollable list of every transaction detail the wallet
  provided, rendered as text
- "Reject" and "Approve" buttons. "Approve" stays disabled for one second after a
  review appears, so a double click or a click aimed at the page cannot approve it

**Behavior**:

- "Reject", the close button, an overlay click, and Escape reject the transaction.
  So do disconnecting the wallet, removing the component, and replacing its manager.
- One review is shown at a time. A newer review from the same wallet rejects the one
  on screen. When several components share a manager, only one of them shows a review.
- A review without details or an approval handler is rejected without being shown.
- Sign-in prompts are only shown during the connection attempt that requested them.

---

## Customization

The component exposes exact CSS variables plus stable shadow parts. See the
[Customization Guide](https://github.com/XRPL-Commons/xrpl-connect/blob/develop/docs/guide/customization.md)
for the complete contract.

### Theme Colors

Control the appearance via CSS variables:

```html
<xrpl-wallet-connector
  style="
    --xc-background-color: #1a1a2e;
    --xc-text-color: #eaeaea;
    --xc-primary-color: #00d4ff;
    --xc-font-family: 'Inter', sans-serif;
  "
></xrpl-wallet-connector>
```

Or define variables in your stylesheet:

```css
:root {
  --xc-background-color: #1a1a2e;
  --xc-text-color: #eaeaea;
  --xc-primary-color: #00d4ff;
  --xc-font-family: 'Inter', sans-serif;
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

React and Vue applications can use the official bindings, `@xrpl-commons/xrpl-connect-react` and
`@xrpl-commons/xrpl-connect-vue`, instead of wiring the element by hand.

### React

```typescript
import { useEffect, useRef, type CSSProperties } from 'react';
import { WalletManager, XamanAdapter } from 'xrpl-connect';

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
      style={{ '--xc-primary-color': '#0EA5E9' } as CSSProperties}
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
import { WalletManager, XamanAdapter } from 'xrpl-connect';

const connector = ref();

onMounted(() => {
  const walletManager = new WalletManager({
    adapters: [new XamanAdapter({ apiKey: 'YOUR_KEY' })],
    network: 'mainnet',
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
import { WalletManager, XamanAdapter, CrossmarkAdapter } from 'xrpl-connect';

// Initialize wallet manager
const walletManager = new WalletManager({
  adapters: [new XamanAdapter({ apiKey: 'YOUR_KEY' }), new CrossmarkAdapter()],
  network: 'mainnet',
  autoConnect: true,
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

The custom element owns modal lifecycle, focus restoration, body-scroll locking,
availability refreshes, and cancellation of stale connection work. Rendering and
interaction logic are split into view and service modules. Treat those modules as
implementation details; the supported integration surface is the element's
attributes, CSS variables, methods, and events documented above.

### Shadow DOM Structure

The connect button uses the component's shadow root. Each modal uses a separate body-level portal
host so fixed positioning is not constrained by transformed ancestors:

```html
<xrpl-wallet-connector>
  #shadow-root (open)
  <button part="connect-button">Connect Wallet</button>
</xrpl-wallet-connector>

<div data-xrpl-overlay-portal>
  #shadow-root (open)
  <div part="overlay">
    <div part="modal">...</div>
  </div>
</div>

<div data-xrpl-account-modal-portal>
  #shadow-root (open)
  <div part="overlay">
    <div part="modal">...</div>
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

When the modal opens, the component asks compatible WalletConnect adapters to
prepare a proposal and caches the resulting QR code for the active modal session.
Closing the modal or replacing the manager invalidates that work and tears down
the pending proposal.

### Browser Detection

The connection service preserves Safari's user gesture requirements and selects
the configured WalletConnect modal mode for mobile browsers.

### Lazy Rendering

The component only renders the active view, not hidden views, for efficiency.

---

## File Structure

```
packages/ui/src/
├── index.ts                    # Public registration and exports
├── wallet-connector.ts         # Custom-element lifecycle and orchestration
├── customization.ts            # CSS-variable customization contract
├── security.ts                 # URL and rendering safety helpers
├── services/                   # Wallet operations and DOM event binding
├── styles/                     # Component styles
├── views/                      # Modal, list, social sign-in, auth prompt, QR, loading, error, and account views
├── constants.ts                # Shared UI constants
├── utils.ts                    # Browser, color, and QR helpers
└── types.ts                    # Public and internal TypeScript types
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
// Importing from xrpl-connect registers <xrpl-wallet-connector>
import { WalletManager } from 'xrpl-connect';
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

1. Use a key exported by `WALLET_CONNECTOR_CSS_VARIABLES` (for example, `--xc-primary-color`)
2. Use valid hex colors or CSS color values (e.g., `#0EA5E9`, not `blue`)
3. Set variables via `style` attribute or CSS before the component renders

```html
<!-- Correct -->
<xrpl-wallet-connector
  style="
    --xc-background-color: #000637;
    --xc-text-color: #F5F4E7;
  "
></xrpl-wallet-connector>

<!-- Also correct (in stylesheet) -->
<style>
  xrpl-wallet-connector {
    --xc-background-color: #000637;
    --xc-text-color: #f5f4e7;
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
<button onclick="document.querySelector('xrpl-wallet-connector').open()">Connect Wallet</button>
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
    --xc-background-color: #000637;
    --xc-text-color: #F5F4E7;
    --xc-primary-color: #0EA5E9;
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

4. **Handle All Event Types**: Listen to `connecting`, `connected`, `error`, and `cancelled` for a complete flow

5. **Close Modal on Success**: Use the `close()` method or auto-close on successful connection

6. **Persist Connection**: Use `autoConnect: true` in `WalletManager` to remember the user's wallet.
   The connector follows the manager's policy: with `autoConnect` omitted or `false`, mounting or
   replacing the element does not restore a session. Call `walletManager.reconnect()` when an
   explicit restore is needed.

7. **Show Network Info**: Display the connected network to the user from `walletManager.account.network`

8. **Graceful Error Handling**: Catch and display errors rather than letting them silently fail

9. **Test Mobile UX**: Test QR code scanning on actual mobile devices

---

## Extending the Component

The component is designed to be self-contained, but you can extend it by:

1. **CSS Customization**: Use the supported CSS variables and stable shadow parts in the [Customization Guide](https://github.com/XRPL-Commons/xrpl-connect/blob/develop/docs/guide/customization.md)
2. **Wrapping in Framework Components**: Create React/Vue wrappers if needed
3. **Custom Adapters**: Create custom wallet adapters for additional wallet support
4. **Event Monitoring**: Listen to all events and send to analytics

```typescript
// Example: Custom error tracking
connector.addEventListener('error', (e) => {
  analytics.track('wallet_connection_failed', {
    walletId: e.detail.walletId,
    errorCode: e.detail.error.code,
    errorMessage: e.detail.error.message,
  });
});
```
