import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  // Skip DTS since we're just re-exporting from other packages
  // Users will get types from those packages directly
  dts: false,
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
  ],
  outDir: 'dist',
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.js' : '.mjs',
    };
  },
});
