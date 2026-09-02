---
description: Customize the XRPL-Connect wallet component colors, styling, and appearance with CSS variables and themes.
---

# Customization Guide

Learn how to customize the XRPL-Connect wallet component to match your application's design and branding.

## Overview

The `<xrpl-wallet-connector>` web component exposes a stable customization contract. You can control:

- **Colors** - All UI colors via CSS variables
- **Styling** - Typography, spacing, and borders
- **Behavior** - Which wallets to show and which one to feature

## CSS Variable Customization

The component supports the exact CSS custom properties listed below. They are exported as
`WALLET_CONNECTOR_CSS_VARIABLES`; TypeScript consumers can use
`WalletConnectorCssVariable` and `WalletConnectorCssVars` from `xrpl-connect` or
`@xrpl-connect/ui`. Unknown `--xc-*` names are not forwarded into modal portals.

### How to Apply CSS Variables

You have three ways to apply CSS variables:

#### 1. Inline (Single Component)

```html
<xrpl-wallet-connector
  style="
    --xc-primary-color: #667eea;
    --xc-background-color: #1a202c;
    --xc-text-color: #ffffff;
  "
></xrpl-wallet-connector>
```

#### 2. Global (Entire Application)

In your CSS file or global styles:

```css
:root {
  --xc-primary-color: #667eea;
  --xc-background-color: #1a202c;
  --xc-text-color: #ffffff;
}
```

#### 3. Scoped (Parent Container)

```html
<div class="my-theme">
  <xrpl-wallet-connector></xrpl-wallet-connector>
</div>

<style>
  .my-theme {
    --xc-primary-color: #667eea;
    --xc-background-color: #1a202c;
    --xc-text-color: #ffffff;
  }
</style>
```

## Available CSS Variables

### Color Variables

#### Primary Colors

| Variable                    | Default   | Purpose                                        |
| --------------------------- | --------- | ---------------------------------------------- |
| `--xc-primary-color`        | `#0EA5E9` | Main accent color (buttons, links, highlights) |
| `--xc-background-color`     | `#000637` | Primary background color                       |
| `--xc-background-secondary` | `#1a1a3e` | Secondary background (cards, panels)           |
| `--xc-background-tertiary`  | `#242452` | Tertiary background (hover states)             |

#### Text Colors

| Variable                | Default                    | Purpose              |
| ----------------------- | -------------------------- | -------------------- |
| `--xc-text-color`       | `#F5F4E7`                  | Primary text color   |
| `--xc-text-muted-color` | `rgba(245, 244, 231, 0.6)` | Secondary/muted text |

#### Status Colors

| Variable            | Default                   | Purpose                          |
| ------------------- | ------------------------- | -------------------------------- |
| `--xc-danger-color` | `#ef4444`                 | Error and destructive states     |
| `--xc-focus-color`  | `var(--xc-primary-color)` | Keyboard focus indicator outline |

#### Overlay & Modal

| Variable                       | Default                          | Purpose                    |
| ------------------------------ | -------------------------------- | -------------------------- |
| `--xc-overlay-background`      | `rgba(0, 0, 0, 0.7)`             | Modal backdrop color       |
| `--xc-overlay-backdrop-filter` | `blur(0px)`                      | Blur effect on backdrop    |
| `--xc-modal-background`        | `#000637`                        | Modal container background |
| `--xc-modal-border-radius`     | `12px`                           | Modal border roundness     |
| `--xc-modal-box-shadow`        | `0 10px 40px rgba(0, 0, 0, 0.2)` | Modal shadow               |

### Spacing & Typography Variables

| Variable             | Default           | Purpose                 |
| -------------------- | ----------------- | ----------------------- |
| `--xc-font-family`   | System font stack | Typography for all text |
| `--xc-border-radius` | `12px`            | Default modal roundness |

### Connect Button Variables

| Variable                               | Default                              | Purpose                         |
| -------------------------------------- | ------------------------------------ | ------------------------------- |
| `--xc-connect-button-border-radius`    | `8px`                                | Connect button roundness        |
| `--xc-connect-button-font-size`        | `16px`                               | Connect button text size        |
| `--xc-connect-button-font-weight`      | `600`                                | Connect button text weight      |
| `--xc-connect-button-color`            | `var(--xc-text-color)`               | Connect button text color       |
| `--xc-connect-button-background`       | `var(--xc-background-color)`         | Connect button background       |
| `--xc-connect-button-border`           | `1px solid rgba(255, 255, 255, 0.1)` | Connect button border           |
| `--xc-connect-button-hover-background` | derived from `--xc-background-color` | Connect button hover background |

### Primary Button Variables

| Variable                               | Default                           | Purpose                         |
| -------------------------------------- | --------------------------------- | ------------------------------- |
| `--xc-primary-button-border-radius`    | `8px`                             | Primary button roundness        |
| `--xc-primary-button-font-weight`      | `600`                             | Primary button text weight      |
| `--xc-primary-button-color`            | `#ffffff`                         | Primary button text color       |
| `--xc-primary-button-background`       | `var(--xc-primary-color)`         | Primary button background       |
| `--xc-primary-button-hover-background` | derived from `--xc-primary-color` | Primary button hover background |

### Secondary Button Variables

| Variable                                 | Default                          | Purpose                           |
| ---------------------------------------- | -------------------------------- | --------------------------------- |
| `--xc-secondary-button-border-radius`    | `8px`                            | Secondary button roundness        |
| `--xc-secondary-button-font-weight`      | `500`                            | Secondary button text weight      |
| `--xc-secondary-button-color`            | `var(--xc-text-color)`           | Secondary button text color       |
| `--xc-secondary-button-background`       | `var(--xc-background-secondary)` | Secondary button background       |
| `--xc-secondary-button-hover-background` | `var(--xc-background-tertiary)`  | Secondary button hover background |

### Account Modal Variables

| Variable                                  | Default                           | Purpose                                |
| ----------------------------------------- | --------------------------------- | -------------------------------------- |
| `--xc-account-address-button-hover-color` | derived from `--xc-primary-color` | Hover color of the address copy button |

### Other Variables

| Variable                    | Default   | Purpose               |
| --------------------------- | --------- | --------------------- |
| `--xc-loading-border-color` | `#0EA5E9` | Loading spinner color |

> Variables marked "derived" are automatically computed from `--xc-primary-color` / `--xc-background-color`. You can still override them explicitly.

### Typed overrides

React and Vue use the same exact `WalletConnectorCssVars` contract as the web component:

```ts
import type { WalletConnectorCssVars } from 'xrpl-connect';

const walletTheme = {
  '--xc-primary-color': '#7c3aed',
  '--xc-modal-border-radius': '16px',
} satisfies WalletConnectorCssVars;
```

Pass `walletTheme` to React's `cssVars` prop or Vue's `:css-vars` prop. Misspelled or unsupported
keys are rejected by TypeScript.

## Shadow parts and portal hosts

The connect button stays inside `<xrpl-wallet-connector>`, while both modals render into separate
body-level shadow hosts so transformed ancestors cannot interfere with their fixed positioning.
The following selectors and part names are stable public API:

| Shadow host                        | Part selector                    | Target                     | Lifecycle                                             |
| ---------------------------------- | -------------------------------- | -------------------------- | ----------------------------------------------------- |
| `xrpl-wallet-connector`            | `::part(connect-button)`         | Connect/account button     | Present while the connector is mounted                |
| `[data-xrpl-overlay-portal]`       | `::part(overlay)`                | Wallet modal backdrop      | Shadow content exists while the wallet modal is open  |
| `[data-xrpl-overlay-portal]`       | `::part(modal)`                  | Wallet modal container     | Shadow content exists while the wallet modal is open  |
| `[data-xrpl-overlay-portal]`       | `::part(close-button)`           | Wallet modal close button  | Present in every wallet modal view                    |
| `[data-xrpl-account-modal-portal]` | `::part(overlay)`                | Account modal backdrop     | Shadow content exists while the account modal is open |
| `[data-xrpl-account-modal-portal]` | `::part(modal)`                  | Account modal container    | Shadow content exists while the account modal is open |
| `[data-xrpl-account-modal-portal]` | `::part(close-button)`           | Account modal close button | Present while the account modal is open               |
| `[data-xrpl-account-modal-portal]` | `::part(account-address-button)` | Address/copy button        | Present while the account modal is open               |
| `[data-xrpl-account-modal-portal]` | `::part(disconnect-button)`      | Disconnect button          | Present while the account modal is open               |

Each portal host is created on its modal's first open, kept with an empty shadow root after close for
reuse, and removed when its owning connector is unmounted. Every variable in
`WALLET_CONNECTOR_CSS_VARIABLES` is copied from the connector's computed style to both portal hosts.

### Styling both modals

```css
xrpl-wallet-connector::part(connect-button) {
  min-width: 12rem;
}

[data-xrpl-overlay-portal]::part(modal),
[data-xrpl-account-modal-portal]::part(modal) {
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
}

[data-xrpl-account-modal-portal]::part(disconnect-button) {
  text-transform: uppercase;
}
```

The portal hosts are direct children of `<body>`, not descendants of your Vue component. Put portal
rules in an unscoped/global stylesheet. In a Vue single-file component, either use a separate
unscoped block:

```vue
<style>
[data-xrpl-overlay-portal]::part(modal),
[data-xrpl-account-modal-portal]::part(modal) {
  max-width: 30rem;
}
</style>
```

or explicitly escape a scoped block:

```vue
<style scoped>
:global([data-xrpl-overlay-portal]::part(modal)),
:global([data-xrpl-account-modal-portal]::part(modal)) {
  max-width: 30rem;
}
</style>
```

For Nuxt, place the portal rules in a global asset:

```css
/* assets/css/xrpl-connect.css */
[data-xrpl-overlay-portal]::part(modal),
[data-xrpl-account-modal-portal]::part(modal) {
  max-width: 30rem;
}
```

and register it in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  css: ['~/assets/css/xrpl-connect.css'],
});
```

Scoped descendant selectors and `:deep()` cannot reach these body-level portal hosts.

## Primary Wallet Attribute

The `primary-wallet` attribute controls which wallet is featured or highlighted in the connection UI.

### Usage

```html
<!-- Feature Xaman as the primary wallet -->
<xrpl-wallet-connector primary-wallet="xaman"></xrpl-wallet-connector>

<!-- Feature Crossmark as the primary wallet -->
<xrpl-wallet-connector primary-wallet="crossmark"></xrpl-wallet-connector>
```

### Supported Values

| Value           | Wallet                |
| --------------- | --------------------- |
| `xaman`         | Xaman (formerly Xumm) |
| `crossmark`     | Crossmark             |
| `gemwallet`     | GemWallet             |
| `walletconnect` | WalletConnect         |
| `ledger`        | Ledger hardware       |
| `xyra`          | Xyra                  |
| `otsu`          | Otsu                  |

### Effect

When you set a `primary-wallet`:

- That wallet appears first or highlighted in the wallet selection list
- It may be featured more prominently in the UI
- Users see your recommended wallet immediately

### Example

```html
<!-- Recommend Xaman to users -->
<xrpl-wallet-connector
  primary-wallet="xaman"
  wallets="xaman,crossmark,gemwallet"
></xrpl-wallet-connector>
```

## Limiting Available Wallets

Use the `wallets` attribute to specify which wallets to show:

```html
<!-- Show only Xaman and Crossmark -->
<xrpl-wallet-connector wallets="xaman,crossmark"></xrpl-wallet-connector>

<!-- Show all available wallets (default) -->
<xrpl-wallet-connector wallets="xaman,crossmark,gemwallet,walletconnect"></xrpl-wallet-connector>
```

## Common Customization Examples

### Light Theme

```html
<xrpl-wallet-connector
  primary-wallet="xaman"
  style="
    --xc-background-color: #ffffff;
    --xc-background-secondary: #f5f5f5;
    --xc-background-tertiary: #eeeeee;
    --xc-text-color: #111111;
    --xc-text-muted-color: rgba(17, 17, 17, 0.6);
    --xc-primary-color: #2563eb;
    --xc-overlay-background: rgba(0, 0, 0, 0.5);
  "
></xrpl-wallet-connector>
```

### Dark Theme

```html
<xrpl-wallet-connector
  primary-wallet="xaman"
  style="
    --xc-background-color: #000637;
    --xc-background-secondary: #1a1a3e;
    --xc-background-tertiary: #242452;
    --xc-text-color: #F5F4E7;
    --xc-text-muted-color: rgba(245, 244, 231, 0.6);
    --xc-primary-color: #3b99fc;
    --xc-overlay-background: rgba(0, 0, 0, 0.7);
  "
></xrpl-wallet-connector>
```

### Purple Theme

```html
<xrpl-wallet-connector
  style="
    --xc-background-color: #1e1b4b;
    --xc-background-secondary: #2d2659;
    --xc-background-tertiary: #3d3261;
    --xc-text-color: #f3e8ff;
    --xc-text-muted-color: rgba(243, 232, 255, 0.6);
    --xc-primary-color: #a78bfa;
    --xc-danger-color: #f87171;
  "
></xrpl-wallet-connector>
```

## Dynamic Theming

Change colors at runtime using JavaScript:

```javascript
const connector = document.getElementById('wallet-connector');

// Apply dark theme
connector.style.setProperty('--xc-background-color', '#000637');
connector.style.setProperty('--xc-primary-color', '#3b99fc');
connector.style.setProperty('--xc-text-color', '#F5F4E7');

// Or apply multiple at once
const theme = {
  '--xc-background-color': '#ffffff',
  '--xc-primary-color': '#2563eb',
  '--xc-text-color': '#111111',
};

Object.entries(theme).forEach(([key, value]) => {
  connector.style.setProperty(key, value);
});
```

## Responsive Design

Use media queries to adapt colors based on user preferences:

```css
/* Light theme for light mode preference */
@media (prefers-color-scheme: light) {
  :root {
    --xc-background-color: #ffffff;
    --xc-text-color: #111111;
    --xc-primary-color: #2563eb;
  }
}

/* Dark theme for dark mode preference */
@media (prefers-color-scheme: dark) {
  :root {
    --xc-background-color: #000637;
    --xc-text-color: #f5f4e7;
    --xc-primary-color: #3b99fc;
  }
}
```

## Best Practices

1. **Define Globally** - Define CSS variables in your root styles for consistency across your app

2. **Test Contrast** - Ensure text has sufficient contrast against backgrounds for accessibility:
   - **WCAG AA:** 4.5:1 contrast ratio for normal text
   - **WCAG AAA:** 7:1 contrast ratio for enhanced contrast

3. **Match Your Brand** - Use colors that match your application's design system

4. **Test All States** - Test the component in different states (connecting, error, success, connected)

5. **Consider Dark Mode** - Support both light and dark modes with media queries

6. **Document Your Theme** - If customizing, document your color scheme for consistency

7. **Keep It Simple** - Start with just primary colors; add more if needed

## Interactive Theme Builder

Want to see your customizations in real-time? Check out the **[Customization Builder](/customization-builder)** page where you can interactively customize colors and see the changes instantly!

## Troubleshooting

### CSS Variables Not Working

- Ensure variables are prefixed with `--xc-`
- Check that CSS is loaded before the component renders
- Use browser DevTools to inspect computed styles

### Color Not Applied

- Make sure you're using valid CSS color values (hex, rgb, rgba, etc.)
- Check for CSS specificity conflicts
- Verify the variable name spelling

### Need More Control?

Use the stable portal-host and shadow-part selectors above. For component methods and events, see
the [API Reference](/guide/api-reference).
