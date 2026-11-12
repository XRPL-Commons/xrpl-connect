import { defineConfig } from 'vite-plus';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      // Enable polyfills for Buffer and other Node.js globals
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Enable polyfills for specific Node.js modules
      protocolImports: true,
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5170,
    strictPort: true,
    fs: {
      // Allow serving files from workspace packages
      allow: ['..', '../..'],
    },
  },
  optimizeDeps: {
    // Force Vite to not pre-bundle workspace packages so changes are reflected immediately
    exclude: ['@xrpl-connect/adapter-ledger', '@xrpl-connect/core', '@xrpl-connect/ui'],
  },
});
