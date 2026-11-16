import { defineConfig } from 'vite-plus';
import { createPackConfig } from '../../vite.pack.config';

export default defineConfig({
  pack: createPackConfig({
    deps: {
      neverBundle: ['xrpl-connect', 'xrpl', '@privy-io/js-sdk-core', '@noble/curves/secp256k1'],
    },
  }),
});
