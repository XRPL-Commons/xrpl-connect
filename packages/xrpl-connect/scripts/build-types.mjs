import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectFolder = path.join(__dirname, '..');

/**
 * Build the rolled-up type declarations for the *published* npm artifact (#56).
 *
 * The runtime bundle (`vite.config.ts`) is fully self-contained: it inlines every
 * `@xrpl-connect/*` package and declares none of them as dependencies. The
 * default `vp pack` build emits `dist/index.d.ts`, but that only *re-exports*
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
 * `vp run -t build` first — building this package *and*
 * all its workspace dependencies in topological order):
 *   - `dist/index.d.ts` exists for this package.
 *   - Each `@xrpl-connect/*` workspace package has been built (its
 *     `dist/index.d.ts` exists) so api-extractor can follow its types.
 */

const entry = path.join(projectFolder, 'dist', 'index.d.ts');
if (!existsSync(entry)) {
  console.error(
    `✗ Missing ${entry}. Run the package build (vp pack) before build-types — ` +
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
    // references the consumer can't resolve. The published bundle declares no
    // runtime deps, so every type a public declaration references must either be
    // inlined here or resolvable via a declared (peer)dependency:
    //   - `@xrpl-connect/*` — all workspace packages (the re-exported surface).
    //   - `eventemitter3`   — `WalletManager extends EventEmitter`, bundled into
    //                         the JS, so `manager.on(...)` needs its type inlined.
    // Left EXTERNAL on purpose (declared as deps by prepare-publish.mjs so they
    // resolve in the consumer's tree — see ALLOWED_EXTERNAL_IMPORTS below):
    //   - `xrpl`                 — consumer-installed peer dependency.
    //   - `@walletconnect/types` — `WalletConnectAdapterOptions.metadata` is
    //       `SignClientTypes.Metadata`. Inlining it is NOT viable: api-extractor
    //       drags in the whole `SignClientTypes` namespace, which pulls a cascade
    //       of `@walletconnect/*` packages plus Node's `events` — several of which
    //       cannot be bundled. A single declared dependency is far cleaner and
    //       its own transitive types resolve for free.
    //   - Wallet SDK packages   — intentionally preserved as namespace exports,
    //       so consumers receive their complete upstream APIs and types.
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

// Treat warnings as failures: this is a publish step, and the canonical
// `ae-forgotten-export` warning is exactly how api-extractor flags a public
// declaration that references a type which was NOT inlined — i.e. a type that
// would ship broken. Fail loudly so it can be added to `bundledPackages`.
if (!result.succeeded || result.warningCount > 0) {
  console.error(
    `✗ api-extractor reported ${result.errorCount} error(s) and ${result.warningCount} warning(s). ` +
      'Treating warnings as fatal for the publish artifact (a forgotten/unresolved export ships broken types).'
  );
  process.exit(1);
}

// Enforce the "self-contained types" invariant. api-extractor does NOT warn
// about external-package imports it leaves in the rollup, so a public
// declaration that references an un-inlined dependency type ships an
// unresolvable `import ... from '<pkg>'` (or a silent `any` under
// `skipLibCheck`). Every external import the rollup keeps MUST be a module the
// consumer is guaranteed to have — i.e. one declared in the published manifest
// by prepare-publish.mjs. Keep this allow-list in lock-step with that script.
const ALLOWED_EXTERNAL_IMPORTS = new Set([
  'xrpl', // peerDependency
  '@walletconnect/types', // dependency
  '@xyrawallet/sdk', // dependency (public Xyra option/network types)
  'xumm', // dependency (public XamanSDK namespace)
  'xumm-oauth2-pkce', // dependency (public XamanOAuth2 namespace)
  '@gemwallet/api', // dependency (public GemWalletAPI namespace)
  '@crossmarkio/typings/sdk', // dependency (public CrossmarkSDK typings namespace)
]);
const rolledPath = path.join(projectFolder, 'dist-publish', 'index.d.ts');
let rolled = readFileSync(rolledPath, 'utf-8');

// Crossmark's public typings use the global `chrome` namespace without declaring
// a reference to it. Preserve the complete upstream types while making them work
// for consumers that intentionally restrict `compilerOptions.types`.
const chromeTypesReference = '/// <reference types="chrome" />\n';
if (!rolled.startsWith(chromeTypesReference)) {
  rolled = chromeTypesReference + rolled;
}

// API Extractor inlines the UI package's exported element interface but drops
// its `declare global` block. Restore the custom-element tag mapping so the
// packed facade keeps the same `document.createElement()` inference as the
// standalone UI package.
const walletConnectorTagDeclaration = `
declare global {
    interface HTMLElementTagNameMap {
        'xrpl-wallet-connector': WalletConnectorElementInstance;
    }
}
`;
if (!rolled.includes("'xrpl-wallet-connector': WalletConnectorElementInstance")) {
  rolled += walletConnectorTagDeclaration;
}
writeFileSync(rolledPath, rolled);

const importedModules = new Set();
for (const m of rolled.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/gm)) {
  importedModules.add(m[1]);
}
const leaked = [...importedModules].filter((mod) => !ALLOWED_EXTERNAL_IMPORTS.has(mod)).sort();
if (leaked.length > 0) {
  console.error(
    '✗ Rolled types are not self-contained — these external imports are neither inlined ' +
      'nor declared as dependencies, so consumers cannot resolve them:\n' +
      leaked.map((m) => `    - ${m}`).join('\n') +
      '\n  Fix: add each package to `bundledPackages` above (to inline it) OR declare it ' +
      'in prepare-publish.js and add it to ALLOWED_EXTERNAL_IMPORTS.'
  );
  process.exit(1);
}

console.log(
  '✓ Rolled up types to dist-publish/index.d.ts (self-contained: only ' +
    [...ALLOWED_EXTERNAL_IMPORTS].join(', ') +
    ' left external)'
);
