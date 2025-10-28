# Customization Guide

Learn how to customize the XRPL Connect wallet component to match your application's design and branding.

## Overview

The `<xrpl-wallet-connector>` web component is designed to be fully customizable. You can control:

- **Colors** - All UI colors via CSS variables
- **Styling** - Typography, spacing, and borders
- **Behavior** - Which wallets to show and which one to feature

## CSS Variable Customization

The component uses CSS custom properties (CSS variables) prefixed with `--xc-` (xrpl-connect). Override these variables to customize the component's appearance.

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

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-primary-color` | `#3b99fc` | Main accent color (buttons, links, highlights) |
| `--xc-background-color` | `#000637` | Primary background color |
| `--xc-background-secondary` | `#1a1a3e` | Secondary background (cards, panels) |
| `--xc-background-tertiary` | `#242452` | Tertiary background (hover states) |

#### Text Colors

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-text-color` | `#F5F4E7` | Primary text color |
| `--xc-text-muted-color` | `rgba(245, 244, 231, 0.6)` | Secondary/muted text |

#### Status Colors

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-success-color` | `#10b981` | Success state (green) |
| `--xc-warning-color` | `#f59e0b` | Warning state (yellow) |
| `--xc-danger-color` | `#ef4444` | Error/danger state (red) |
| `--xc-focus-color` | `#3b99fc` | Focus/active state |

#### Overlay & Modal

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-overlay-background` | `rgba(0, 0, 0, 0.7)` | Modal backdrop color |
| `--xc-overlay-backdrop-filter` | `blur(0px)` | Blur effect on backdrop |
| `--xc-modal-background` | `#000637` | Modal container background |
| `--xc-modal-border-radius` | `12px` | Modal border roundness |
| `--xc-modal-box-shadow` | `0 10px 40px rgba(0, 0, 0, 0.2)` | Modal shadow |

### Spacing & Typography Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-font-family` | System font stack | Typography for all text |
| `--xc-border-radius` | `12px` | Default roundness for modals and cards |

### Button Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-connect-button-border-radius` | `8px` | Connect button roundness |
| `--xc-connect-button-font-size` | `16px` | Connect button text size |
| `--xc-connect-button-font-weight` | `600` | Connect button text weight |
| `--xc-primary-button-border-radius` | `8px` | Primary button roundness |
| `--xc-primary-button-font-weight` | `600` | Primary button text weight |
| `--xc-secondary-button-border-radius` | `8px` | Secondary button roundness |
| `--xc-secondary-button-font-weight` | `500` | Secondary button text weight |

### Other Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-loading-border-color` | `#3b99fc` | Loading spinner color |

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

| Value | Wallet |
|-------|--------|
| `xaman` | Xaman (formerly Xumm) |
| `crossmark` | Crossmark |
| `gemwallet` | GemWallet |
| `walletconnect` | WalletConnect |

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
    --xc-text-color: #F5F4E7;
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

For advanced customization beyond CSS variables, check out the [API Reference](/guide/api-reference) for component methods and events you can use to build custom UI.
