/// <reference types="vite-plus/test" />
import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
