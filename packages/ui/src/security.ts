const EXECUTABLE_URL_PROTOCOLS = new Set(['blob:', 'data:', 'file:', 'javascript:', 'vbscript:']);
const SAFE_DATA_IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/svg+xml',
  'image/webp',
]);

/** Return a non-executable absolute URL, including wallet-specific deep-link schemes. */
export function getSafeDeepLinkUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return EXECUTABLE_URL_PROTOCOLS.has(url.protocol) ? null : value;
  } catch {
    return null;
  }
}

/** Return a safe HTTP(S) or image data URL for an image source. */
export function getSafeImageUrl(value: string | undefined): string | null {
  if (!value) return null;

  if (value.slice(0, 5).toLowerCase() === 'data:') {
    const separator = value.indexOf(',');
    if (separator === -1) return null;

    const [mediaType, ...parameters] = value
      .slice(5, separator)
      .split(';')
      .map((part) => part.trim().toLowerCase());
    if (!mediaType || !SAFE_DATA_IMAGE_TYPES.has(mediaType)) return null;
    if (
      parameters.some(
        (parameter) => parameter !== 'base64' && !/^charset=[a-z0-9._-]+$/.test(parameter)
      )
    ) {
      return null;
    }
    return value;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
