import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: 'vite-dist',
    rollupOptions: {
      input: fileURLToPath(new URL('./vite-entry.mjs', import.meta.url)),
    },
  },
});
