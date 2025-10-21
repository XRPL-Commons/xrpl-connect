import { defineConfig } from 'tsup';

export default defineConfig([
  // Node.js compatible build (CommonJS + ESM)
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    external: ['xrpl'],
    outDir: 'dist',
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.js' : '.mjs',
      };
    },
  },
  // Browser-optimized build (ESM only with Node.js built-ins externalized)
  {
    entry: { index: 'src/index.browser.ts' },
    format: ['esm'],
    dts: true,
    clean: false,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    external: [
      'xrpl',
      // Externalize Node.js built-in modules for browser builds
      'events',
      'crypto',
      'zlib',
      'util',
      'stream',
      'buffer',
      'path',
      'fs',
      'os',
    ],
    outDir: 'dist',
    outExtension() {
      return {
        js: '.browser.mjs',
        dts: '.browser.d.ts',
      };
    },
  },
]);
