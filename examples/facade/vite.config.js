import { defineConfig } from 'vite-plus';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    // Address.importByMnemonic()/importByXaman() pull in bip39, which needs
    // Node's Buffer/crypto in the browser — without this, checksum validation
    // silently computes the wrong result instead of throwing.
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
  ],
  server: {
    port: 5180,
    fs: {
      // Allow serving the workspace facade package from outside this example's root
      allow: ['..', '../..'],
    },
  },
  optimizeDeps: {
    // Force Vite to not pre-bundle the workspace package so changes are reflected immediately
    exclude: ['xrpl-connect'],
  },
});
