import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import ts from 'typescript';
import { prepareCrossmarkTypes } from './crossmark-types.mjs';

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

// Crossmark keeps its original file scopes; only its ledger dependency types
// are flattened. This preserves upstream merged class/namespace declarations.
const crossmarkTypes = prepareCrossmarkTypes(projectFolder);
function rollupTypes(mainEntryPointFilePath, outputPath, paths) {
  const config = ExtractorConfig.prepare({
    configObjectFullPath: path.join(projectFolder, 'api-extractor.json'),
    packageJsonFullPath: path.join(projectFolder, 'package.json'),
    configObject: {
      projectFolder,
      mainEntryPointFilePath,
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
      //   - Wallet SDK packages   — intentionally preserved as namespace exports.
      //       Crossmark's import is redirected to its packaged declarations below.
      bundledPackages: ['@xrpl-connect/*', 'eventemitter3'],
      compiler: {
        overrideTsconfig: {
          extends: path.join(projectFolder, 'tsconfig.json'),
          compilerOptions: paths ? { paths } : {},
        },
      },
      dtsRollup: {
        enabled: true,
        untrimmedFilePath: outputPath,
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
  if (!result.succeeded || result.warningCount > 0) {
    throw new Error(
      `api-extractor reported ${result.errorCount} error(s) and ${result.warningCount} warning(s) for ${mainEntryPointFilePath}`
    );
  }
}

try {
  rollupTypes(entry, path.join(projectFolder, 'dist-publish/index.d.ts'));
  rollupTypes(
    crossmarkTypes.transactionEntry,
    crossmarkTypes.transactionOutput,
    crossmarkTypes.paths
  );
} finally {
  crossmarkTypes.cleanup();
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
]);
const rolledPath = path.join(projectFolder, 'dist-publish', 'index.d.ts');
let rolled = readFileSync(rolledPath, 'utf-8').replaceAll(
  "'@crossmarkio/typings/sdk'",
  "'./types/crossmark/build/src/sdk'"
);

// Crossmark's public typings use the global `chrome` namespace without declaring
// a reference to it. Preserve the complete upstream types while making them work
// for consumers that intentionally restrict `compilerOptions.types`.
const chromeTypesReference = '/// <reference types="chrome" />\n';
if (!/^\s*\/\/\/ <reference types="chrome" \/>/m.test(rolled)) {
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
const publishedFolder = path.dirname(rolledPath);
for (const relative of readdirSync(publishedFolder, { recursive: true })) {
  if (!relative.endsWith('.d.ts')) continue;
  const file = path.join(publishedFolder, relative);
  const declarations = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const checkModule = (module) => {
    if (!module.startsWith('.')) {
      importedModules.add(module);
      return;
    }
    const resolved = ts.resolveModuleName(
      module,
      file,
      { moduleResolution: ts.ModuleResolutionKind.Node10 },
      ts.sys
    ).resolvedModule;
    if (!resolved || !resolved.resolvedFileName.startsWith(publishedFolder + path.sep)) {
      throw new Error(`Unresolved packaged declaration import ${module} in ${relative}`);
    }
  };
  const collectImports = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      checkModule(node.moduleSpecifier.text);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      checkModule(node.argument.literal.text);
    } else if (ts.isExternalModuleReference(node) && node.expression) {
      checkModule(node.expression.text);
    }
    ts.forEachChild(node, collectImports);
  };
  collectImports(declarations);
}
const leaked = [...importedModules].filter((mod) => !ALLOWED_EXTERNAL_IMPORTS.has(mod)).sort();
if (leaked.length > 0) {
  console.error(
    '✗ Rolled types are not self-contained — these external imports are neither inlined ' +
      'nor declared as dependencies, so consumers cannot resolve them:\n' +
      leaked.map((m) => `    - ${m}`).join('\n') +
      '\n  Fix: add each package to `bundledPackages` above (to inline it) OR declare it ' +
      'in prepare-publish.mjs and add it to ALLOWED_EXTERNAL_IMPORTS.'
  );
  process.exit(1);
}

console.log(
  '✓ Rolled up types to dist-publish/index.d.ts (self-contained: only ' +
    [...ALLOWED_EXTERNAL_IMPORTS].join(', ') +
    ' left external)'
);
