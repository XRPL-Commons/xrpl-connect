import { defineConfig, type Options } from 'tsup';

/**
 * Canonical tsup settings shared by every package in this monorepo.
 * Each package's `tsup.config.ts` calls `createTsupConfig({ ... })` and only
 * overrides what is truly package-specific (typically `entry` and `external`).
 *
 * Output convention: CJS → `.js`, ESM → `.mjs`. Packages must not set
 * `"type": "module"` so the `.js` output is interpreted as CommonJS.
 */
export function createTsupConfig(overrides: Options = {}): Options {
  return {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    bundle: true,
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    outDir: 'dist',
    outExtension({ format }) {
      return { js: format === 'cjs' ? '.js' : '.mjs' };
    },
    ...overrides,
  };
}

export default defineConfig(createTsupConfig());
