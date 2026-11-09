import { defineConfig } from 'vite-plus';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { 'xrpl-connect': path.resolve(__dirname, '../core/src') } },
});
