import { defineConfig } from 'vite';
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
    port: 5170,
    fs: {
      // Allow serving files from workspace packages
      allow: ['..', '../..'],
    },
  },
  optimizeDeps: {
    // Force Vite to not pre-bundle workspace packages so changes are reflected immediately
    exclude: [
      '@xrpl-connect/adapter-ledger',
      '@xrpl-connect/core',
      '@xrpl-connect/ui',
    ],
  },
  build: {
    rollupOptions: {
      external: [
        // Don't try to bundle polyfill shims in production build
        /^vite-plugin-node-polyfills\//,
      ],
    },
  },
});
