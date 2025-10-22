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
