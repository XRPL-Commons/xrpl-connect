/**
 * @xrpl-connect/ui
 * Web component UI library for XRPL Connect
 */

// Preserve the historical side effect of importing the UI package while
// keeping the registration operation available as an explicit entrypoint for
// framework bindings and applications that import only focused runtime code.
import './register';

export { WalletConnectorElement, type WalletConnectorElementInstance } from './wallet-connector';
export * from './customization';

// Export constants and utilities for advanced use cases
export * from './constants';
export * from './utils';

// Export types for TypeScript users
export type { WalletManager } from '@xrpl-connect/core';
export type { SocialLogin } from './types';
