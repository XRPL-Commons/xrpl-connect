import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  bundle: true,
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
});
