/**
 * @xrpl-connect/adapter-xaman
 * Xaman (formerly Xumm) wallet adapter for xrpl-connect
 */

export { XamanAdapter } from './xaman-adapter';
export type { XamanAdapterOptions, XamanConnectOptions, XamanReturnUrl } from './xaman-adapter';

// Namespace exports expose the complete upstream APIs without flattening generic
// names into the adapter or meta-package public surface.
export * as XamanSDK from 'xumm';
export * as XamanOAuth2 from 'xumm-oauth2-pkce';
