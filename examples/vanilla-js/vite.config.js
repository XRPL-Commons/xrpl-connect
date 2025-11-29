import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  define: {
    global: 'globalThis',
  },
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
      '@xrpl-connect/adapter-web3auth',
      '@xrpl-connect/core',
      '@xrpl-connect/ui',
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
});
