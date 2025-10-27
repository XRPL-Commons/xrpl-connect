---
layout: post
title: Customization
weight: 3
---

# Customization Guide

The `<xrpl-wallet-connector>` web component is fully customizable using CSS variables. Style the component to match your application without modifying HTML or JavaScript.

## Overview

### How It Works

The component uses CSS custom properties (CSS variables) prefixed with `--xc-` (xrpl-connect). You can override these variables either:

1. **Inline:** Use the `style` attribute on the component
2. **Global:** Define variables in your CSS file or root styles
3. **Scoped:** Define variables on a parent container

### Quick Example

```html
<xrpl-wallet-connector
  style="
    --xc-primary-color: #667eea;
    --xc-background-color: #1a202c;
    --xc-text-color: #ffffff;
  "
></xrpl-wallet-connector>
```

## General Variables

### Font & Spacing

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-font-family` | System font stack | Typography for all text |
| `--xc-border-radius` | `12px` | Roundness of modals and cards |

### Overlay

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-overlay-background` | `rgba(0, 0, 0, 0.7)` | Modal backdrop color |
| `--xc-overlay-backdrop-filter` | `blur(0px)` | Blur effect on backdrop |

## Color Variables

### Primary Colors

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-primary-color` | `#3b99fc` | Main accent color for highlights |
| `--xc-background-color` | `#000637` | Primary background |
| `--xc-background-secondary` | `#1a1a3e` | Secondary background |
| `--xc-background-tertiary` | `#242452` | Tertiary background |

### Text Colors

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-text-color` | `#F5F4E7` | Primary text color |
| `--xc-text-muted-color` | `rgba(245, 244, 231, 0.6)` | Secondary/muted text |

### Status Colors

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-success-color` | `#10b981` | Success state indicator |
| `--xc-warning-color` | `#f59e0b` | Warning state indicator |
| `--xc-danger-color` | `#ef4444` | Error/danger state indicator |
| `--xc-focus-color` | `#3b99fc` | Focus state color |

## Button Styling

### Connect Button

The main "Connect Wallet" button in the top right.

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-connect-button-border-radius` | `8px` | Button roundness |
| `--xc-connect-button-font-size` | `16px` | Button text size |
| `--xc-connect-button-font-weight` | `600` | Button text weight |

**Note:** Hover color is automatically calculated as a lighter shade of `--xc-background-color`.

### Primary Button

Buttons for main actions (e.g., "Continue with Xaman").

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-primary-button-border-radius` | `8px` | Button roundness |
| `--xc-primary-button-font-weight` | `600` | Button text weight |

**Note:** Hover color is automatically calculated as a lighter shade of `--xc-primary-color`.

### Secondary Button

Buttons for secondary actions (wallet list items).

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-secondary-button-border-radius` | `8px` | Button roundness |
| `--xc-secondary-button-font-weight` | `500` | Button text weight |

## Modal & Loading

### Modal

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-modal-background` | `#000637` | Modal container background |
| `--xc-modal-border-radius` | `12px` | Modal border roundness |
| `--xc-modal-box-shadow` | `0 10px 40px rgba(0, 0, 0, 0.2)` | Modal shadow |

### Loading

| Variable | Default | Purpose |
|----------|---------|---------|
| `--xc-loading-border-color` | `#3b99fc` | Loading spinner color |

## Theme Examples

### Light Theme

```html
<xrpl-wallet-connector
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

### Dark Theme (Default)

```html
<xrpl-wallet-connector
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

### Neon Theme

```html
<xrpl-wallet-connector
  style="
    --xc-background-color: #0a0e27;
    --xc-background-secondary: #1a1f3a;
    --xc-background-tertiary: #2a2f4a;
    --xc-text-color: #e0ffff;
    --xc-text-muted-color: rgba(224, 255, 255, 0.5);
    --xc-primary-color: #00ff88;
    --xc-focus-color: #00ffff;
  "
></xrpl-wallet-connector>
```

## Best Practices

1. **Define variables globally** - Use CSS variables in a global stylesheet for consistent theming

```css
:root {
  --xc-primary-color: #667eea;
  --xc-background-color: #1a202c;
  --xc-text-color: #f5f5f5;
}
```

2. **Use semantic color names** - Stick to meaningful variable names

3. **Test all states** - Test your theme in different modal states (connecting, error, success)

4. **Consider contrast** - Ensure sufficient color contrast for accessibility:
   - **WCAG AA:** 4.5:1 contrast ratio for normal text
   - **WCAG AAA:** 7:1 contrast ratio for enhanced contrast

5. **Document your theme** - Document custom color schemes used in your application

6. **Use consistent spacing** - Keep border radius values consistent across your design system

7. **Responsive Design** - CSS variables work great with media queries:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --xc-background-color: #000637;
    --xc-text-color: #F5F4E7;
  }
}

@media (prefers-color-scheme: light) {
  :root {
    --xc-background-color: #ffffff;
    --xc-text-color: #111111;
  }
}
```

8. **Dynamic Theming** - Change colors dynamically at runtime:

```javascript
const connector = document.getElementById('wallet-connector');

function applyTheme(themeName) {
  const theme = {
    dark: {
      '--xc-background-color': '#000637',
      '--xc-primary-color': '#3b99fc',
    },
    light: {
      '--xc-background-color': '#ffffff',
      '--xc-primary-color': '#2563eb',
    },
  };

  Object.entries(theme[themeName]).forEach(([key, value]) => {
    connector.style.setProperty(key, value);
  });
}

applyTheme('dark');
```

## Accessibility Considerations

When customizing colors, ensure:

- Text color has sufficient contrast against backgrounds
- Status colors (danger, success, warning) are not the only way to convey information
- Focus colors are clearly visible (use `--xc-focus-color`)
