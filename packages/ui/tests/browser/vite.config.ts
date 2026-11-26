import path from 'node:path';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  root: path.resolve(__dirname, '../../../..'),
  resolve: {
    alias: {
      '@xrpl-connect/core': path.resolve(__dirname, '../../../core/src'),
      // The Privy adapter source imports the public package name, whose
      // runtime surface is core's; resolving it to core's source keeps a
      // single copy of core (and of the web component) in browser fixtures.
      'xrpl-connect/core': path.resolve(__dirname, '../../../core/src'),
      'xrpl-connect': path.resolve(__dirname, '../../../core/src'),
      '@noble/curves': path.resolve(__dirname, '../../../privy/node_modules/@noble/curves'),
      react: path.resolve(__dirname, '../../../react/node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../../react/node_modules/react-dom'),
    },
  },
});
