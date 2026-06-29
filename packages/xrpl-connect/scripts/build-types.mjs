import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectFolder = path.join(__dirname, '..');

/**
 * Build the rolled-up type declarations for the *published* npm artifact (#56).
 *
 * The runtime bundle (`vite.config.ts`) is fully self-contained: it inlines every
 * `@xrpl-connect/*` package and declares none of them as dependencies. The
 * default `tsup` build emits `dist/index.d.ts`, but that only *re-exports*
 * (`export * from '@xrpl-connect/core'` …), which a consumer of `xrpl-connect`
 * cannot resolve because the sub-packages aren't installed.
 *
 * api-extractor reads that re-exporting entry and, because every workspace
 * package is listed in `bundledPackages`, follows each one's built
 * `dist/index.d.ts` and inlines the declarations into a single
 * `dist-publish/index.d.ts` — the type-level mirror of the JS bundle. `xrpl`
 * stays external (peer dependency installed by the consumer).
 *
 * Prerequisites (satisfied by `publish:build`, which runs
 * `turbo run build --filter=xrpl-connect...` first — building this package *and*
 * all its workspace dependencies in topological order):
 *   - `dist/index.d.ts` exists for this package.
 *   - Each `@xrpl-connect/*` workspace package has been built (its
 *     `dist/index.d.ts` exists) so api-extractor can follow its types.
 */

const entry = path.join(projectFolder, 'dist', 'index.d.ts');
if (!existsSync(entry)) {
  console.error(
    `✗ Missing ${entry}. Run the package build (tsup) before build-types — ` +
      'publish:build does this automatically.'
  );
  process.exit(1);
}

const config = ExtractorConfig.prepare({
  configObjectFullPath: path.join(projectFolder, 'api-extractor.json'),
  packageJsonFullPath: path.join(projectFolder, 'package.json'),
  configObject: {
    projectFolder,
    mainEntryPointFilePath: '<projectFolder>/dist/index.d.ts',
    // Inline these instead of leaving them as bare `import ... from '...'`
    // references the consumer can't resolve. The workspace packages are all
    // inlined; `eventemitter3` is bundled into the JS too (so the published
    // package declares no runtime deps), so its `EventEmitter` base type —
    // which `WalletManager` extends — must be inlined as well, otherwise
    // `manager.on(...)` is unresolved for consumers. `xrpl` is intentionally
    // left external: it is the consumer-installed peer dependency.
    bundledPackages: ['@xrpl-connect/*', 'eventemitter3'],
    compiler: {
      tsconfigFilePath: '<projectFolder>/tsconfig.json',
    },
    dtsRollup: {
      enabled: true,
      untrimmedFilePath: '<projectFolder>/dist-publish/index.d.ts',
    },
    apiReport: { enabled: false },
    docModel: { enabled: false },
    tsdocMetadata: { enabled: false },
  },
});

const result = Extractor.invoke(config, {
  localBuild: true,
  showVerboseMessages: true,
});

if (!result.succeeded) {
  console.error(
    `✗ api-extractor failed with ${result.errorCount} error(s) and ${result.warningCount} warning(s).`
  );
  process.exit(1);
}

console.log('✓ Rolled up types to dist-publish/index.d.ts');
