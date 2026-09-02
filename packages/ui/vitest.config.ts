/// <reference types="vite-plus/test" />
import { defineConfig } from 'vite-plus';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: ['tests/browser/**'],
  },
  resolve: {
    alias: {
      '@xrpl-connect/core': path.resolve(__dirname, '../core/src'),
    },
  },
});
