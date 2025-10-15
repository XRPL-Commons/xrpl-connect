import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ['xrpl', '@xrpl-connect/core', 'xumm', 'xumm-oauth2-pkce'],
  outDir: 'dist',
});
