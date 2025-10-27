# @xrpl-connect/ui - Customization Guide

The `<xrpl-wallet-connector>` web component is fully customizable using CSS variables. This allows you to style the component to match your application's design system without modifying the HTML structure.

## CSS Variables Reference

### General

Control the overall appearance and feel of the component.

```css
xrpl-wallet-connector {
  /* Font family for all text */
  --xc-font-family: Inter, system-ui, sans-serif;

  /* Border radius for modals and buttons */
  --xc-border-radius: 12px;

  /* Overlay background (modal backdrop) */
  --xc-overlay-background: rgba(0, 0, 0, 0.7);

  /* Overlay backdrop filter (e.g., blur) */
  --xc-overlay-backdrop-filter: blur(0px);
}
```

### Colors

Core color variables used throughout the component.

```css
xrpl-wallet-connector {
  /* Primary accent color (used for highlights, important elements) */
  --xc-primary-color: #0EA5E9;

  /* Background colors */
  --xc-background-color: #000637;
  --xc-background-secondary: #1a1a3e;
  --xc-background-tertiary: #242452;

  /* Text colors */
  --xc-text-color: #F5F4E7;
  --xc-text-muted-color: rgba(245, 244, 231, 0.6);

  /* Status colors */
  --xc-danger-color: #ef4444;      /* For destructive actions */
  --xc-success-color: #10b981;     /* For success states */
  --xc-warning-color: #f59e0b;     /* For warnings */
  --xc-focus-color: #0EA5E9;       /* For focused elements */
}
```

### Connect Button

Customize the main wallet connection button.

```css
xrpl-wallet-connector {
  /* Button sizing and shape */
  --xc-connect-button-border-radius: 8px;
  --xc-connect-button-font-size: 16px;
  --xc-connect-button-font-weight: 600;

  /* Default state */
  --xc-connect-button-color: #F5F4E7;
  --xc-connect-button-background: #000637;
  --xc-connect-button-border: 1px solid rgba(255, 255, 255, 0.1);

  /* Hover state */
  --xc-connect-button-hover-background: #1a1a3e;
}
```

### Primary Button

Style primary action buttons (e.g., "Continue with..." buttons).

```css
xrpl-wallet-connector {
  /* Button styling */
  --xc-primary-button-border-radius: 8px;
  --xc-primary-button-font-weight: 600;

  /* Default state */
  --xc-primary-button-color: #ffffff;
  --xc-primary-button-background: #0EA5E9;

  /* Hover state (automatically calculated as darker shade of primary color) */
  --xc-primary-button-hover-background: #0284C7;
}
```

**Note:** The hover background color is automatically calculated as a darker shade of `--xc-primary-color`. When you change the primary color, the hover state will automatically adjust to maintain contrast.

### Secondary Button

Style secondary action buttons (wallet list items, secondary actions).

```css
xrpl-wallet-connector {
  /* Button styling */
  --xc-secondary-button-border-radius: 8px;
  --xc-secondary-button-font-weight: 500;

  /* Default state */
  --xc-secondary-button-color: #F5F4E7;
  --xc-secondary-button-background: #1a1a3e;

  /* Hover state */
  --xc-secondary-button-hover-background: #242452;
}
```

### Connect Button

Style the "Connect Wallet" button shown in the top right corner.

```css
xrpl-wallet-connector {
  /* Button sizing and shape */
  --xc-connect-button-border-radius: 8px;
  --xc-connect-button-font-size: 16px;
  --xc-connect-button-font-weight: 600;

  /* Default state */
  --xc-connect-button-color: #F5F4E7;
  --xc-connect-button-background: #000637;
  --xc-connect-button-border: 1px solid rgba(255, 255, 255, 0.1);

  /* Hover state (automatically calculated as lighter shade of background color) */
  --xc-connect-button-hover-background: #1a1a3e;
}
```

**Note:** The hover background color is automatically calculated as a lighter shade of `--xc-background-color`.

### Account Address Button

Style the account address button shown in the account details modal.

```css
xrpl-wallet-connector {
  /* Hover state color (automatically calculated as lighter shade of primary color) */
  --xc-account-address-button-hover-color: #0EA5E9;
}
```

**Note:** The hover color is automatically calculated as a lighter shade of `--xc-primary-color`.

### Loading State

Customize the loading spinner appearance.

```css
xrpl-wallet-connector {
  /* Loading spinner border color */
  --xc-loading-border-color: #0EA5E9;
}
```

The loading spinner uses an animated rotating border. You can change the border color to match your theme.

### Modal

Customize the appearance of modals (wallet selection, account details).

```css
xrpl-wallet-connector {
  /* Modal container */
  --xc-modal-background: #000637;
  --xc-modal-border-radius: 12px;
  --xc-modal-box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}
```

## Usage Examples

### Light Theme

```html
<xrpl-wallet-connector
  style="
    --xc-background-color: #ffffff;
    --xc-background-secondary: #f5f5f5;
    --xc-background-tertiary: #eeeeee;
    --xc-text-color: #111111;
    --xc-text-muted-color: rgba(17, 17, 17, 0.6);
    --xc-primary-color: #3b82f6;
    --xc-overlay-background: rgba(0, 0, 0, 0.5);
    --xc-connect-button-background: #ffffff;
    --xc-connect-button-color: #111111;
    --xc-connect-button-border: 1px solid #e5e5e5;
  "
  wallets="xaman,crossmark,walletconnect"
  primary-wallet="xaman"
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
    --xc-primary-color: #0EA5E9;
    --xc-overlay-background: rgba(0, 0, 0, 0.7);
  "
  wallets="xaman,crossmark,walletconnect"
  primary-wallet="xaman"
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
    --xc-primary-color: #a78bfa;
    --xc-danger-color: #f87171;
    --xc-connect-button-background: #2d2659;
    --xc-connect-button-color: #f3e8ff;
  "
  wallets="xaman,crossmark,walletconnect"
></xrpl-wallet-connector>
```

### Global CSS Variables

Define variables globally in your CSS file for consistent theming across your application:

```css
:root {
  /* General */
  --xc-font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  --xc-border-radius: 10px;

  /* Colors */
  --xc-primary-color: #3b82f6;
  --xc-background-color: #ffffff;
  --xc-background-secondary: #f9fafb;
  --xc-background-tertiary: #f3f4f6;
  --xc-text-color: #111827;
  --xc-text-muted-color: rgba(17, 24, 39, 0.6);

  /* Buttons */
  --xc-connect-button-border-radius: 12px;
  --xc-primary-button-border-radius: 10px;
  --xc-secondary-button-border-radius: 8px;

  /* Modal */
  --xc-modal-border-radius: 16px;
  --xc-modal-box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  /* Status */
  --xc-danger-color: #ef4444;
  --xc-success-color: #10b981;
  --xc-warning-color: #f59e0b;
}
```

## Supported HTML Attributes

The component supports the following HTML attributes:

- `primary-wallet` - Specifies which wallet should be featured/highlighted (e.g., `primary-wallet="xaman"`)
- `wallets` - Comma-separated list of wallet IDs to include (e.g., `wallets="xaman,crossmark,walletconnect"`)

All styling is controlled exclusively via CSS variables using the `style` attribute or CSS stylesheets.

## Advanced Customization

For complex styling needs beyond the provided CSS variables, you can define additional CSS rules in your application's stylesheet. The component uses scoped Shadow DOM styles, but you can extend styling by targeting the component from your global CSS:

```css
/* Override default component variables globally */
:root {
  --xc-primary-color: #667eea;
  --xc-border-radius: 20px;
}

/* Or target the component specifically */
xrpl-wallet-connector {
  --xc-primary-color: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --xc-border-radius: 20px;
}
```

## Variable Inheritance

Child elements inherit CSS variables from the parent, allowing for powerful theming:

```css
/* All components on the page inherit these variables */
body {
  --xc-primary-color: #0EA5E9;
  --xc-font-family: "Helvetica Neue", Arial, sans-serif;
}

/* Override for a specific section */
.dark-section {
  --xc-background-color: #1a1a1a;
  --xc-text-color: #ffffff;
}

/* Override for a specific component */
.custom-wallet-connector {
  --xc-primary-button-border-radius: 20px;
  --xc-modal-box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
```

## Best Practices

1. **Define variables globally** - Use CSS variables in a global stylesheet for consistent theming
2. **Use semantic names** - Variable names like `--xc-danger-color` are more maintainable than `--xc-error-red`
3. **Test all states** - Test your theme in different modal states (connecting, error, success)
4. **Consider contrast** - Ensure sufficient color contrast for accessibility
5. **Document your theme** - Document any custom color schemes used in your application
6. **Use consistent spacing** - Keep border radius values consistent across your design system

## Accessibility Considerations

When customizing colors, ensure:
- Text color has sufficient contrast against backgrounds (WCAG AA: 4.5:1 for normal text)
- Status colors (danger, success, warning) are not the only way to convey information
- Focus colors are clearly visible (use `--xc-focus-color` for proper focus states)

## Customizing with CSS Variables

All styling customization is done exclusively through CSS variables. Use the `style` attribute for instance-specific customization:

```html
<xrpl-wallet-connector
  style="
    --xc-background-color: #1a1a2e;
    --xc-text-color: #eaeaea;
    --xc-primary-color: #00d4ff;
    --xc-font-family: 'Segoe UI', sans-serif;
    --xc-modal-border-radius: 14px;
    --xc-border-radius: 10px;
  "
  primary-wallet="xaman"
></xrpl-wallet-connector>
```

Or define variables in your global CSS for consistent theming across your application:

```css
:root {
  --xc-background-color: #1a1a2e;
  --xc-text-color: #eaeaea;
  --xc-primary-color: #00d4ff;
  --xc-font-family: 'Segoe UI', sans-serif;
}
```

Both approaches work! Use whichever fits your application architecture best.
