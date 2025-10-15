# @xrpl-connect/ui

Web component UI library for XRPL Connect. Provides a beautiful, framework-agnostic wallet connection modal inspired by modern web3 UX patterns.

## Features

- 🎨 **Customizable Design**: Easily customize background colors with automatic text color adjustment
- 🔌 **Framework Agnostic**: Works with any JavaScript framework or vanilla JS
- 📱 **Responsive**: Mobile-friendly modal design
- ♿ **Accessible**: Keyboard navigation and ARIA labels
- 🎯 **Type Safe**: Full TypeScript support
- ⚡ **Lightweight**: ~12KB minified

## Installation

```bash
pnpm add @xrpl-connect/ui @xrpl-connect/core
```

## Usage

### Basic Setup

```html
<!DOCTYPE html>
<html>
<head>
  <title>My XRPL App</title>
</head>
<body>
  <!-- Add the web component to your HTML -->
  <xrpl-wallet-connector
    id="wallet-connector"
    background-color="#1a202c"
    primary-wallet="xaman"
    show-help="true">
  </xrpl-wallet-connector>

  <button id="connect-btn">Connect Wallet</button>

  <script type="module">
    import { WalletManager } from '@xrpl-connect/core';
    import { XamanAdapter } from '@xrpl-connect/adapter-xaman';
    import { WalletConnectAdapter } from '@xrpl-connect/adapter-walletconnect';
    import { CrossmarkAdapter } from '@xrpl-connect/adapter-crossmark';
    import { GemWalletAdapter } from '@xrpl-connect/adapter-gemwallet';
    import { WalletConnectorElement } from '@xrpl-connect/ui';

    // Initialize wallet manager
    const walletManager = new WalletManager({
      adapters: [
        new XamanAdapter({ apiKey: 'YOUR_API_KEY' }),
        new WalletConnectAdapter({ projectId: 'YOUR_PROJECT_ID' }),
        new CrossmarkAdapter(),
        new GemWalletAdapter(),
      ],
      network: 'testnet',
      autoConnect: true,
    });

    // Get the web component
    const walletConnector = document.getElementById('wallet-connector');

    // Set the wallet manager instance
    walletConnector.setWalletManager(walletManager);

    // Open the modal when button is clicked
    document.getElementById('connect-btn').addEventListener('click', () => {
      walletConnector.open();
    });

    // Listen to events
    walletConnector.addEventListener('connected', (e) => {
      console.log('Connected to:', e.detail.walletId);
    });

    walletManager.on('connect', (account) => {
      console.log('Account:', account);
      // Modal automatically closes on successful connection
    });
  </script>
</body>
</html>
```

## Attributes

The `<xrpl-wallet-connector>` element accepts the following attributes:

### `background-color`
- **Type**: String (hex color)
- **Default**: `#2d3748`
- **Description**: Background color of the modal. Text color is automatically adjusted for optimal contrast.

```html
<xrpl-wallet-connector background-color="#1a202c"></xrpl-wallet-connector>
```

### `primary-wallet`
- **Type**: String (wallet ID)
- **Default**: None
- **Description**: ID of the wallet to display as the primary/featured option with a blue button.

Available wallet IDs:
- `xaman` - Xaman Wallet
- `walletconnect` - WalletConnect
- `crossmark` - Crossmark
- `gemwallet` - GemWallet

```html
<xrpl-wallet-connector primary-wallet="xaman"></xrpl-wallet-connector>
```

### `show-help`
- **Type**: Boolean (string)
- **Default**: `true`
- **Description**: Whether to show the help button (?) in the header.

```html
<xrpl-wallet-connector show-help="false"></xrpl-wallet-connector>
```

## Methods

### `setWalletManager(manager: WalletManager)`

Sets the WalletManager instance that the component will use for wallet connections.

```javascript
walletConnector.setWalletManager(walletManager);
```

### `open()`

Opens the wallet connection modal.

```javascript
walletConnector.open();
```

### `close()`

Closes the wallet connection modal.

```javascript
walletConnector.close();
```

### `toggle()`

Toggles the modal open/closed state.

```javascript
walletConnector.toggle();
```

## Events

The component dispatches the following custom events:

### `open`

Fired when the modal is opened.

```javascript
walletConnector.addEventListener('open', () => {
  console.log('Modal opened');
});
```

### `close`

Fired when the modal is closed.

```javascript
walletConnector.addEventListener('close', () => {
  console.log('Modal closed');
});
```

### `connecting`

Fired when a wallet connection is initiated.

```javascript
walletConnector.addEventListener('connecting', (e) => {
  console.log('Connecting to:', e.detail.walletId);
});
```

### `connected`

Fired when a wallet connection succeeds.

```javascript
walletConnector.addEventListener('connected', (e) => {
  console.log('Connected to:', e.detail.walletId);
});
```

### `error`

Fired when a wallet connection fails.

```javascript
walletConnector.addEventListener('error', (e) => {
  console.error('Connection error:', e.detail.error);
  console.error('Wallet ID:', e.detail.walletId);
});
```

## Styling

The component uses Shadow DOM for style encapsulation. You can customize certain aspects using CSS custom properties (CSS variables) or by using the `::part()` pseudo-element for exposed parts.

### CSS Parts

The following parts are exposed for styling:

- `overlay` - The backdrop overlay
- `modal` - The modal container
- `help-button` - The help button
- `close-button` - The close button

```css
xrpl-wallet-connector::part(modal) {
  border-radius: 32px;
}

xrpl-wallet-connector::part(overlay) {
  backdrop-filter: blur(4px);
}
```

## Color Customization

The component automatically adjusts text color (black or white) based on the background color's luminance using the WCAG relative luminance formula. This ensures optimal readability regardless of your chosen background color.

```html
<!-- Light theme -->
<xrpl-wallet-connector background-color="#f7fafc"></xrpl-wallet-connector>

<!-- Dark theme -->
<xrpl-wallet-connector background-color="#1a202c"></xrpl-wallet-connector>

<!-- Brand colors -->
<xrpl-wallet-connector background-color="#6366f1"></xrpl-wallet-connector>
```

## Framework Integration

### Vue 3

```vue
<template>
  <div>
    <button @click="openWallet">Connect Wallet</button>
    <xrpl-wallet-connector
      ref="connector"
      background-color="#1a202c"
      primary-wallet="xaman"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { WalletManager } from '@xrpl-connect/core';
import '@xrpl-connect/ui';

const connector = ref(null);
const walletManager = new WalletManager({ /* ... */ });

onMounted(() => {
  connector.value.setWalletManager(walletManager);
});

function openWallet() {
  connector.value.open();
}
</script>
```

### React

```jsx
import { useEffect, useRef } from 'react';
import { WalletManager } from '@xrpl-connect/core';
import '@xrpl-connect/ui';

function App() {
  const connectorRef = useRef(null);
  const walletManager = new WalletManager({ /* ... */ });

  useEffect(() => {
    if (connectorRef.current) {
      connectorRef.current.setWalletManager(walletManager);
    }
  }, []);

  const openWallet = () => {
    connectorRef.current?.open();
  };

  return (
    <div>
      <button onClick={openWallet}>Connect Wallet</button>
      <xrpl-wallet-connector
        ref={connectorRef}
        background-color="#1a202c"
        primary-wallet="xaman"
      />
    </div>
  );
}
```

### Angular

```typescript
import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { WalletManager } from '@xrpl-connect/core';
import '@xrpl-connect/ui';

@Component({
  selector: 'app-root',
  template: `
    <button (click)="openWallet()">Connect Wallet</button>
    <xrpl-wallet-connector
      #connector
      background-color="#1a202c"
      primary-wallet="xaman">
    </xrpl-wallet-connector>
  `
})
export class AppComponent implements OnInit {
  @ViewChild('connector') connector!: ElementRef;
  walletManager = new WalletManager({ /* ... */ });

  ngOnInit() {
    this.connector.nativeElement.setWalletManager(this.walletManager);
  }

  openWallet() {
    this.connector.nativeElement.open();
  }
}
```

## Browser Support

- Chrome/Edge 79+
- Firefox 63+
- Safari 13.1+

## License

MIT
