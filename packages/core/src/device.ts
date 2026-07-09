/**
 * Device / browser detection helpers.
 *
 * Framework-agnostic and safe to call in non-DOM environments (SSR, workers),
 * where they degrade to `false` instead of throwing on a missing `navigator`.
 */

/**
 * User-agent fragments emitted by mobile phones and tablets.
 */
const MOBILE_UA_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

/**
 * iPadOS 13+ in its default "desktop" mode reports a macOS (`Macintosh`)
 * user-agent, so {@link MOBILE_UA_PATTERN} alone misses it. Such tablets are
 * distinguished from a real Mac only by being touch devices.
 */
const MAC_UA_PATTERN = /Macintosh/i;

/**
 * Detect if the user is on a mobile (phone/tablet) device.
 *
 * Beyond the usual user-agent sniff, this also catches iPadOS 13+ in its default
 * "desktop" mode, which reports a `Macintosh` user-agent indistinguishable from a
 * real Mac except that it is a touch device (`maxTouchPoints > 1`; desktop Safari
 * reports `0`). Without this, iPads fall through to the desktop QR flow instead of
 * the mobile deep-link/modal flow. (#16)
 *
 * @returns true if mobile device
 */
export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (MOBILE_UA_PATTERN.test(navigator.userAgent)) return true;
  return (
    MAC_UA_PATTERN.test(navigator.userAgent) &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1
  );
}
