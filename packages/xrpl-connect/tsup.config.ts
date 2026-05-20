import { defineConfig } from 'tsup';
import { createTsupConfig } from '../../tsup.base.config';

// The umbrella package re-exports every workspace package. Externalize all of
// them (and `xrpl`) so consumers resolve them via their own published builds.
// For npm publishing, use `pnpm publish:build` which runs the Vite bundle.
export default defineConfig(
  createTsupConfig({
    external: [
      'xrpl',
      '@xrpl-connect/core',
      '@xrpl-connect/ui',
      '@xrpl-connect/adapter-xaman',
      '@xrpl-connect/adapter-crossmark',
      '@xrpl-connect/adapter-gemwallet',
      '@xrpl-connect/adapter-walletconnect',
      '@xrpl-connect/adapter-xyra',
      '@xrpl-connect/adapter-otsu',
      '@xrpl-connect/adapter-ledger',
    ],
  }),
);
