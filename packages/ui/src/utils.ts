/**
 * Utility functions for Wallet Connector
 */

import { LUMINANCE, COLOR_ADJUSTMENT, BROWSER_PATTERNS } from './constants';

/**
 * Calculate luminance to determine if text should be black or white
 * Based on WCAG relative luminance formula
 * @param hex - Hex color string (with or without #)
 * @returns Luminance value between 0 and 1
 */
export function calculateLuminance(hex: string): number {
  const color = hex.replace('#', '');

  const r = parseInt(color.substring(0, 2), 16) / COLOR_ADJUSTMENT.MAX_COLOR_VALUE;
  const g = parseInt(color.substring(2, 4), 16) / COLOR_ADJUSTMENT.MAX_COLOR_VALUE;
  const b = parseInt(color.substring(4, 6), 16) / COLOR_ADJUSTMENT.MAX_COLOR_VALUE;

  const [rs, gs, bs] = [r, g, b].map((c) => {
    return c <= LUMINANCE.GAMMA_CORRECTION_THRESHOLD
      ? c / LUMINANCE.GAMMA_CORRECTION_DIVISOR
      : Math.pow(
          (c + LUMINANCE.GAMMA_CORRECTION_OFFSET) / LUMINANCE.GAMMA_CORRECTION_BASE,
          LUMINANCE.GAMMA_CORRECTION_POWER
        );
  });

  return (
    LUMINANCE.RED_WEIGHT * rs +
    LUMINANCE.GREEN_WEIGHT * gs +
    LUMINANCE.BLUE_WEIGHT * bs
  );
}

/**
 * Get contrasting text color (black or white) based on background luminance
 * Ensures WCAG contrast compliance
 * @param backgroundColor - Background color in hex format
 * @returns '#ffffff' for dark backgrounds, '#000000' for light backgrounds
 */
export function getContrastTextColor(backgroundColor: string): string {
  const luminance = calculateLuminance(backgroundColor);
  return luminance < LUMINANCE.THRESHOLD ? '#ffffff' : '#000000';
}

/**
 * Adjust color brightness
 * @param hex - Hex color string
 * @param amount - Amount to adjust (0-1), positive for lighter, negative for darker
 * @returns Adjusted hex color
 */
export function adjustColorBrightness(hex: string, amount: number): string {
  const color = hex.replace('#', '');
  const num = parseInt(color, 16);

  const adjustValue = Math.round(COLOR_ADJUSTMENT.MAX_COLOR_VALUE * amount);

  let r = (num >> 16) + adjustValue;
  let g = ((num >> 8) & 0x00ff) + adjustValue;
  let b = (num & 0x0000ff) + adjustValue;

  r = Math.max(0, Math.min(COLOR_ADJUSTMENT.MAX_COLOR_VALUE, r));
  g = Math.max(0, Math.min(COLOR_ADJUSTMENT.MAX_COLOR_VALUE, g));
  b = Math.max(0, Math.min(COLOR_ADJUSTMENT.MAX_COLOR_VALUE, b));

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Detect if browser is Safari
 * Safari requires immediate connection (user gesture preservation)
 * @returns true if Safari browser
 */
export function isSafari(): boolean {
  return BROWSER_PATTERNS.SAFARI.test(navigator.userAgent);
}

/**
 * Detect if user is on mobile device
 * @returns true if mobile device
 */
export function isMobile(): boolean {
  return BROWSER_PATTERNS.MOBILE.test(navigator.userAgent);
}

/**
 * Check if URI is a Xaman QR code image
 * Xaman provides PNG images directly instead of WalletConnect URIs
 * @param uri - URI to check
 * @returns true if Xaman QR code image URL
 */
export function isXamanQRImage(uri: string): boolean {
  return uri.includes('xumm.app/sign') && uri.includes('.png');
}

/**
 * Truncate string with ellipsis
 * @param str - String to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated string with '...'
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

/**
 * Create a promise that resolves after a delay
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
