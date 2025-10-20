/**
 * UI Constants for Wallet Connector
 * Centralized configuration for sizes, timings, colors, and other magic values
 */

/**
 * Size constants (in pixels)
 */
export const SIZES = {
  QR_CODE: 260,
  LOADING_LOGO: 80,
  MODAL_WIDTH: 343,
  MODAL_BORDER_RADIUS: 20,
  QR_CARD_PADDING: 28,
  BUTTON_PADDING_VERTICAL: 16,
  BUTTON_PADDING_HORIZONTAL: 20,
  BUTTON_BORDER_RADIUS: 12,
  ICON_SMALL: 24,
  ICON_MEDIUM: 28,
  ICON_LARGE: 80,
  CLOSE_BUTTON_SIZE: 34,
  HEADER_PADDING: 18,
} as const;

/**
 * Timing constants (in milliseconds)
 */
export const TIMINGS = {
  QR_RENDER_DELAY: 100,
  COPY_FEEDBACK_DURATION: 2000,
  ANIMATION_DURATION: 200,
  SAFARI_CONNECT_DELAY: 0,
  NON_SAFARI_CONNECT_DELAY: 100,
} as const;

/**
 * Z-Index layers
 */
export const Z_INDEX = {
  OVERLAY: 9999,
  LOADING_BORDER_AFTER: 1,
  LOADING_LOGO: 2,
} as const;

/**
 * Default theme colors
 */
export const DEFAULT_THEME = {
  BACKGROUND_COLOR: '#000637',
  TEXT_COLOR: '#F5F4E7',
  PRIMARY_COLOR: '#0ea5e9',
  FONT_FAMILY: "'Karla', sans-serif",
} as const;

/**
 * QR Code configuration
 */
export const QR_CONFIG = {
  SIZE: 260,
  MARGIN: 0,
  IMAGE_MARGIN: 6,
  IMAGE_SIZE: 0.25,
  DOT_COLOR: '#000637',
  ERROR_CORRECTION_LEVEL: 'Q' as const,
  DOT_TYPE: 'rounded' as const,
  BACKGROUND_COLOR: 'transparent',
};

/**
 * WCAG luminance constants
 */
export const LUMINANCE = {
  THRESHOLD: 0.5,
  GAMMA_CORRECTION_THRESHOLD: 0.03928,
  GAMMA_CORRECTION_DIVISOR: 12.92,
  GAMMA_CORRECTION_OFFSET: 0.055,
  GAMMA_CORRECTION_POWER: 2.4,
  GAMMA_CORRECTION_BASE: 1.055,
  RED_WEIGHT: 0.2126,
  GREEN_WEIGHT: 0.7152,
  BLUE_WEIGHT: 0.0722,
} as const;

/**
 * Color adjustment constants
 */
export const COLOR_ADJUSTMENT = {
  HOVER_BRIGHTNESS: 0.15,
  MAX_COLOR_VALUE: 255,
} as const;

/**
 * Browser detection patterns
 */
export const BROWSER_PATTERNS = {
  SAFARI: /^((?!chrome|android).)*safari/i,
  MOBILE: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i,
} as const;

/**
 * Error codes for wallet operations
 */
export const ERROR_CODES = {
  USER_REJECTED: 4001,
  POPUP_CLOSED: -32002,
} as const;

/**
 * Xaman specific constants
 */
export const XAMAN = {
  QR_URL_PATTERN: 'xumm.app/sign',
  QR_IMAGE_EXTENSION: '.png',
} as const;

/**
 * Font weights
 */
export const FONT_WEIGHTS = {
  LIGHT: 300,
  REGULAR: 400,
  MEDIUM: 500,
  SEMIBOLD: 600,
} as const;
