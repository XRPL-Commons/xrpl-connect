# @xrpl-connect/ui - Customization Guide

The `<xrpl-wallet-connector>` web component is fully customizable using CSS variables. This allows you to style the component to match your application's design system without modifying the HTML structure.

## CSS Variables Reference

### General

Control the overall appearance and feel of the component.

```css
xrpl-wallet-connector {
  /* Font family for all text */
  --xrpl-font-family: Inter, system-ui, sans-serif;

  /* Border radius for modals and buttons */
  --xrpl-border-radius: 12px;

  /* Overlay background (modal backdrop) */
  --xrpl-overlay-background: rgba(0, 0, 0, 0.7);

  /* Overlay backdrop filter (e.g., blur) */
  --xrpl-overlay-backdrop-filter: blur(0px);
}
```

### Colors

Core color variables used throughout the component.

```css
xrpl-wallet-connector {
  /* Primary accent color (used for highlights, important elements) */
  --xrpl-primary-color: #0EA5E9;

  /* Background colors */
  --xrpl-background-color: #000637;
  --xrpl-background-secondary: #1a1a3e;
  --xrpl-background-tertiary: #242452;

  /* Text colors */
  --xrpl-text-color: #F5F4E7;
  --xrpl-text-muted-color: rgba(245, 244, 231, 0.6);

  /* Status colors */
  --xrpl-danger-color: #ef4444;      /* For destructive actions */
  --xrpl-success-color: #10b981;     /* For success states */
  --xrpl-warning-color: #f59e0b;     /* For warnings */
  --xrpl-focus-color: #0EA5E9;       /* For focused elements */
}
```

### Connect Button

Customize the main wallet connection button.

```css
xrpl-wallet-connector {
  /* Button sizing and shape */
  --xrpl-connect-button-border-radius: 8px;
  --xrpl-connect-button-font-size: 16px;
  --xrpl-connect-button-font-weight: 600;

  /* Default state */
  --xrpl-connect-button-color: #F5F4E7;
  --xrpl-connect-button-background: #000637;
  --xrpl-connect-button-border: 1px solid rgba(255, 255, 255, 0.1);

  /* Hover state */
  --xrpl-connect-button-hover-background: #1a1a3e;
}
```

### Primary Button

Style primary action buttons (e.g., "Continue with..." buttons).

```css
xrpl-wallet-connector {
  /* Button styling */
  --xrpl-primary-button-border-radius: 8px;
  --xrpl-primary-button-font-weight: 600;

  /* Default state */
  --xrpl-primary-button-color: #ffffff;
  --xrpl-primary-button-background: #0EA5E9;

  /* Hover state */
  --xrpl-primary-button-hover-background: #0284C7;
}
```

### Secondary Button

Style secondary action buttons (wallet list items, secondary actions).

```css
xrpl-wallet-connector {
  /* Button styling */
  --xrpl-secondary-button-border-radius: 8px;
  --xrpl-secondary-button-font-weight: 500;

  /* Default state */
  --xrpl-secondary-button-color: #F5F4E7;
  --xrpl-secondary-button-background: #1a1a3e;

  /* Hover state */
  --xrpl-secondary-button-hover-background: #242452;
}
```

### Modal

Customize the appearance of modals (wallet selection, account details).

```css
xrpl-wallet-connector {
  /* Modal container */
  --xrpl-modal-background: #000637;
  --xrpl-modal-border-radius: 12px;
  --xrpl-modal-box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}
```

## Usage Examples

### Light Theme

```html
<xrpl-wallet-connector
  style="
    --xrpl-background-color: #ffffff;
    --xrpl-background-secondary: #f5f5f5;
    --xrpl-background-tertiary: #eeeeee;
    --xrpl-text-color: #111111;
    --xrpl-text-muted-color: rgba(17, 17, 17, 0.6);
    --xrpl-primary-color: #3b82f6;
    --xrpl-overlay-background: rgba(0, 0, 0, 0.5);
    --xrpl-connect-button-background: #ffffff;
    --xrpl-connect-button-color: #111111;
    --xrpl-connect-button-border: 1px solid #e5e5e5;
  "
  wallets="xaman,crossmark,walletconnect"
  primary-wallet="xaman"
></xrpl-wallet-connector>
```

### Dark Theme (Default)

```html
<xrpl-wallet-connector
  style="
    --xrpl-background-color: #000637;
    --xrpl-background-secondary: #1a1a3e;
    --xrpl-background-tertiary: #242452;
    --xrpl-text-color: #F5F4E7;
    --xrpl-primary-color: #0EA5E9;
    --xrpl-overlay-background: rgba(0, 0, 0, 0.7);
  "
  wallets="xaman,crossmark,walletconnect"
  primary-wallet="xaman"
></xrpl-wallet-connector>
```

### Purple Theme

```html
<xrpl-wallet-connector
  style="
    --xrpl-background-color: #1e1b4b;
    --xrpl-background-secondary: #2d2659;
    --xrpl-background-tertiary: #3d3261;
    --xrpl-text-color: #f3e8ff;
    --xrpl-primary-color: #a78bfa;
    --xrpl-danger-color: #f87171;
    --xrpl-connect-button-background: #2d2659;
    --xrpl-connect-button-color: #f3e8ff;
  "
  wallets="xaman,crossmark,walletconnect"
></xrpl-wallet-connector>
```

### Global CSS Variables

Define variables globally in your CSS file for consistent theming across your application:

```css
:root {
  /* General */
  --xrpl-font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  --xrpl-border-radius: 10px;

  /* Colors */
  --xrpl-primary-color: #3b82f6;
  --xrpl-background-color: #ffffff;
  --xrpl-background-secondary: #f9fafb;
  --xrpl-background-tertiary: #f3f4f6;
  --xrpl-text-color: #111827;
  --xrpl-text-muted-color: rgba(17, 24, 39, 0.6);

  /* Buttons */
  --xrpl-connect-button-border-radius: 12px;
  --xrpl-primary-button-border-radius: 10px;
  --xrpl-secondary-button-border-radius: 8px;

  /* Modal */
  --xrpl-modal-border-radius: 16px;
  --xrpl-modal-box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  /* Status */
  --xrpl-danger-color: #ef4444;
  --xrpl-success-color: #10b981;
  --xrpl-warning-color: #f59e0b;
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
  --xrpl-primary-color: #667eea;
  --xrpl-border-radius: 20px;
}

/* Or target the component specifically */
xrpl-wallet-connector {
  --xrpl-primary-color: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --xrpl-border-radius: 20px;
}
```

## Variable Inheritance

Child elements inherit CSS variables from the parent, allowing for powerful theming:

```css
/* All components on the page inherit these variables */
body {
  --xrpl-primary-color: #0EA5E9;
  --xrpl-font-family: "Helvetica Neue", Arial, sans-serif;
}

/* Override for a specific section */
.dark-section {
  --xrpl-background-color: #1a1a1a;
  --xrpl-text-color: #ffffff;
}

/* Override for a specific component */
.custom-wallet-connector {
  --xrpl-primary-button-border-radius: 20px;
  --xrpl-modal-box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
```

## Best Practices

1. **Define variables globally** - Use CSS variables in a global stylesheet for consistent theming
2. **Use semantic names** - Variable names like `--xrpl-danger-color` are more maintainable than `--xrpl-error-red`
3. **Test all states** - Test your theme in different modal states (connecting, error, success)
4. **Consider contrast** - Ensure sufficient color contrast for accessibility
5. **Document your theme** - Document any custom color schemes used in your application
6. **Use consistent spacing** - Keep border radius values consistent across your design system

## Accessibility Considerations

When customizing colors, ensure:
- Text color has sufficient contrast against backgrounds (WCAG AA: 4.5:1 for normal text)
- Status colors (danger, success, warning) are not the only way to convey information
- Focus colors are clearly visible (use `--xrpl-focus-color` for proper focus states)

## Customizing with CSS Variables

All styling customization is done exclusively through CSS variables. Use the `style` attribute for instance-specific customization:

```html
<xrpl-wallet-connector
  style="
    --xrpl-background-color: #1a1a2e;
    --xrpl-text-color: #eaeaea;
    --xrpl-primary-color: #00d4ff;
    --xrpl-font-family: 'Segoe UI', sans-serif;
    --xrpl-modal-border-radius: 14px;
    --xrpl-border-radius: 10px;
  "
  primary-wallet="xaman"
></xrpl-wallet-connector>
```

Or define variables in your global CSS for consistent theming across your application:

```css
:root {
  --xrpl-background-color: #1a1a2e;
  --xrpl-text-color: #eaeaea;
  --xrpl-primary-color: #00d4ff;
  --xrpl-font-family: 'Segoe UI', sans-serif;
}
```

Both approaches work! Use whichever fits your application architecture best.
