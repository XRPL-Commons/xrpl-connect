/// <reference types="vite-plus/test" />
import { configDefaults, defineConfig } from 'vite-plus';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    // Extend the defaults: replacing them would also collect the tests of
    // workspace packages linked under node_modules.
    exclude: [...configDefaults.exclude, 'tests/browser/**'],
  },
  resolve: {
    alias: {
      '@xrpl-connect/core': path.resolve(__dirname, '../core/src'),
    },
  },
});
