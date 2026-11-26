import { defineConfig } from 'vite-plus';
import { createPackConfig } from '../../vite.pack.config';

export default defineConfig({
  pack: createPackConfig({
    entry: ['src/index.ts', 'src/testing.ts'],
    deps: {
      neverBundle: [
        'xrpl-connect',
        'xrpl-connect/core',
        'xrpl',
        '@privy-io/js-sdk-core',
        '@noble/curves/secp256k1',
      ],
    },
  }),
});
