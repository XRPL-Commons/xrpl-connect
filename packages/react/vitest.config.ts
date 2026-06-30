/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      // The package imports only core-level APIs (WalletManager, WalletError, …)
      // from the `xrpl-connect` meta-package. Resolving it to core *source* in
      // tests avoids evaluating the full bundle — every wallet SDK runs
      // browser-only / network code at import time, which hangs the jsdom test
      // run (and would otherwise need a `matchMedia` polyfill). Production builds
      // still import from `xrpl-connect`.
      'xrpl-connect': path.resolve(__dirname, '../core/src'),
    },
  },
});
