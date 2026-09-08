import path from 'node:path';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  root: path.resolve(__dirname, '../../../..'),
  resolve: {
    alias: {
      '@xrpl-connect/core': path.resolve(__dirname, '../../../core/src'),
      react: path.resolve(__dirname, '../../../react/node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../../react/node_modules/react-dom'),
    },
  },
});
