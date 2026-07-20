import { defineConfig } from 'vite-plus';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync, readFileSync } from 'fs';
import inject from '@rollup/plugin-inject';
import { createPackConfig } from '../../vite.pack.config';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Vite config for publishing a fully-bundled version of xrpl-connect
 * This bundles all dependencies (including Buffer polyfill) into a single file suitable for npm
 *
 * Usage: vp build -c vite.config.ts
 */
export default defineConfig({
  pack: createPackConfig({
    deps: {
      neverBundle: [
        'xrpl',
        '@xrpl-connect/core',
        '@xrpl-connect/ui',
        '@xrpl-connect/adapter-xaman',
        '@xrpl-connect/adapter-crossmark',
        '@xrpl-connect/adapter-gemwallet',
        '@xrpl-connect/adapter-walletconnect',
        '@xrpl-connect/adapter-xyra',
        '@xrpl-connect/adapter-otsu',
        '@xrpl-connect/adapter-ledger',
      ],
    },
  }),
  resolve: {
    alias: {
      '@xrpl-connect/core': resolve(__dirname, '../core/src/index.ts'),
      '@xrpl-connect/ui': resolve(__dirname, '../ui/src/index.ts'),
      '@xrpl-connect/adapter-xaman': resolve(__dirname, '../adapters/xaman/src/index.ts'),
      '@xrpl-connect/adapter-crossmark': resolve(__dirname, '../adapters/crossmark/src/index.ts'),
      '@xrpl-connect/adapter-gemwallet': resolve(__dirname, '../adapters/gemwallet/src/index.ts'),
      '@xrpl-connect/adapter-walletconnect': resolve(
        __dirname,
        '../adapters/walletconnect/src/index.ts'
      ),
    },
  },
  plugins: [
    // Match the per-adapter pack config (`loader: { '.svg': 'text' }`). Without
    // this, Vite's default asset handler resolves `.svg` imports to a
    // `data:image/svg+xml,...` URL, and each adapter's
    // `data:image/svg+xml,${encodeURIComponent(iconSvg)}` wrapper then
    // double-encodes it into an unrenderable URI.
    {
      name: 'svg-as-text',
      enforce: 'pre',
      load(id) {
        const path = id.split('?')[0];
        if (path.endsWith('.svg')) {
          const source = readFileSync(path, 'utf-8');
          return `export default ${JSON.stringify(source)};`;
        }
      },
    },
    {
      name: 'copy-readme',
      closeBundle() {
        const rootReadmePath = resolve(__dirname, '../../README.md');
        const distReadmePath = resolve(__dirname, 'dist-publish/README.md');

        if (existsSync(rootReadmePath)) {
          copyFileSync(rootReadmePath, distReadmePath);
          console.log('✓ Copied README.md to dist-publish/');
        }
      },
    },
  ],
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
      plugins: [
        inject({
          Buffer: ['buffer', 'Buffer'],
        }),
      ],
    },
    outDir: 'dist-publish',
    emptyOutDir: true,
  },
});
