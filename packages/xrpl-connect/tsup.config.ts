import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  // Don't bundle - let imports work during development
  // For publishing to npm, use: pnpm publish:build
  external: [
    'xrpl',
    // Externalize all internal packages (they're re-exported)
    '@xrpl-connect/core',
    '@xrpl-connect/ui',
    '@xrpl-connect/adapter-xaman',
    '@xrpl-connect/adapter-crossmark',
    '@xrpl-connect/adapter-gemwallet',
    '@xrpl-connect/adapter-walletconnect',
    '@xrpl-connect/adapter-xyra',
    '@xrpl-connect/adapter-otsu',
  ],
  outDir: 'dist',
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.js' : '.mjs',
    };
  },
});
