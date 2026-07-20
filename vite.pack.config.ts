interface PackOverrides {
  deps?: { neverBundle?: string[] };
  loader?: Record<string, 'dataurl' | 'text'>;
}

/** Shared library packaging defaults for every published workspace package. */
export function createPackConfig(overrides: PackOverrides = {}) {
  return {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'] as const,
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    outDir: 'dist',
    platform: 'neutral' as const,
    ...overrides,
  };
}
