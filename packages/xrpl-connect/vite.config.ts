import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Vite config for publishing a fully-bundled version of xrpl-connect
 * This bundles all dependencies into a single file suitable for npm
 *
 * Usage: vite build -c vite.config.ts
 */
export default defineConfig({
  resolve: {
    alias: {
      '@xrpl-connect/core': resolve(__dirname, '../core/src/index.ts'),
      '@xrpl-connect/ui': resolve(__dirname, '../ui/src/index.ts'),
      '@xrpl-connect/adapter-xaman': resolve(__dirname, '../adapters/xaman/src/index.ts'),
      '@xrpl-connect/adapter-crossmark': resolve(__dirname, '../adapters/crossmark/src/index.ts'),
      '@xrpl-connect/adapter-gemwallet': resolve(__dirname, '../adapters/gemwallet/src/index.ts'),
      '@xrpl-connect/adapter-walletconnect': resolve(__dirname, '../adapters/walletconnect/src/index.ts'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'XRPLConnect',
      formats: ['es', 'umd'],
      fileName: (format) => {
        if (format === 'es') return 'xrpl-connect.mjs';
        return 'xrpl-connect.umd.js';
      },
    },
    rollupOptions: {
      external: ['xrpl'],
      output: {
        // Provide global variables to use in the UMD build for externalized deps
        globals: {
          xrpl: 'xrpl',
        },
      },
    },
    outDir: 'dist-publish',
    emptyOutDir: true,
  },
});
