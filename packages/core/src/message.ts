/**
 * Message helpers shared by wallet adapters.
 */

import { createWalletError } from './errors';

/**
 * Return the exact text a wallet must sign for a `signMessage()` request.
 *
 * Byte input must be valid UTF-8. Lossy decoding would replace invalid
 * sequences with U+FFFD, and the default decoder strips a leading byte order
 * mark; either way the wallet would sign different bytes than the caller passed.
 *
 * @throws WalletError with `INVALID_MESSAGE` when the bytes are not valid UTF-8.
 */
export function decodeMessage(message: string | Uint8Array): string {
  if (typeof message === 'string') return message;
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(message);
  } catch (error) {
    throw createWalletError.invalidMessage(
      'Message bytes must be valid UTF-8.',
      error instanceof Error ? error : undefined
    );
  }
}
