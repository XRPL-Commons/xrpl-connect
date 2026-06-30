import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPkgPath = path.join(__dirname, '../package.json');
const distPkgPath = path.join(__dirname, '../dist-publish/package.json');

// Read main package.json
const mainPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));

// The rolled-up `index.d.ts` keeps `import { SignClientTypes } from
// '@walletconnect/types'` external (inlining it drags in an unbundleable cascade
// of @walletconnect/* + node `events` types — see scripts/build-types.mjs). So
// the published package must declare `@walletconnect/types` as a real dependency
// for that import (and its transitive types) to resolve in the consumer's tree.
// Read the version range from the WalletConnect adapter so the two stay in sync.
const wcAdapterPkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../adapters/walletconnect/package.json'), 'utf-8')
);
const wcTypesRange = wcAdapterPkg.dependencies?.['@walletconnect/types'];

// Fail loudly if the version range can't be found. Without this guard a missing
// range is `undefined`, which `JSON.stringify` silently drops from `dependencies`
// below — so the published manifest would declare NO `@walletconnect/types` even
// though the rolled `index.d.ts` still imports from it, shipping unresolvable
// types. The self-containment check in scripts/build-types.mjs would NOT catch it
// either: it allow-lists `@walletconnect/types` unconditionally. Keep this in
// lock-step with that allow-list — if the WalletConnect adapter ever stops
// declaring `@walletconnect/types` as a dependency, both scripts must change.
if (!wcTypesRange) {
  console.error(
    "✗ Could not read the '@walletconnect/types' version range from " +
      'packages/adapters/walletconnect/package.json (dependencies). The rolled types ' +
      'leave that import external, so the published manifest must declare it. Fix: restore ' +
      "the dependency on the adapter, or update both scripts/prepare-publish.mjs and the " +
      'ALLOWED_EXTERNAL_IMPORTS allow-list in scripts/build-types.mjs.'
  );
  process.exit(1);
}

// Create dist-publish package.json
const distPkg = {
  name: mainPkg.name,
  version: mainPkg.version,
  description: mainPkg.description,
  author: mainPkg.author,
  license: mainPkg.license,
  // Intentionally NO `"type": "module"`: the ESM entry is already `.mjs`, while
  // the `require` entry below is the UMD `.js` which must be parsed as CommonJS.
  // Setting `type: module` would make Node/TypeScript treat the UMD file as ESM
  // and break `require('xrpl-connect')` for CommonJS consumers (TS1479).
  main: './xrpl-connect.umd.js',
  module: './xrpl-connect.mjs',
  // Rolled-up declaration file emitted by api-extractor (see scripts/build-types.mjs).
  // Required so `npm install xrpl-connect` consumers get full TypeScript types
  // for the re-exported core/ui/adapter API (fixes #56).
  types: './index.d.ts',
  exports: {
    '.': {
      // `types` must come first so TypeScript resolves it before import/require.
      types: './index.d.ts',
      import: './xrpl-connect.mjs',
      require: './xrpl-connect.umd.js',
    },
  },
  // `@walletconnect/types` is left external in the rolled types (see above), so
  // it must be installed alongside the package for those declarations to resolve.
  dependencies: {
    '@walletconnect/types': wcTypesRange,
  },
  // Carry the `xrpl` peer dependency into the published manifest. The rolled
  // `index.d.ts` keeps `import { SubmittableTransaction } from 'xrpl'` external,
  // so consumers must install `xrpl` for the types (and the externalized runtime
  // bundle) to resolve. Without this, npm gives no peer hint and a type-only
  // consumer who hasn't installed `xrpl` gets an unresolved import.
  peerDependencies: mainPkg.peerDependencies,
  keywords: mainPkg.keywords,
  repository: mainPkg.repository,
  bugs: mainPkg.bugs,
  homepage: mainPkg.homepage,
};

// Ensure dist-publish directory exists
const distDir = path.dirname(distPkgPath);
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Write the package.json
fs.writeFileSync(distPkgPath, JSON.stringify(distPkg, null, 2) + '\n');
console.log('✓ Updated dist-publish/package.json with version', mainPkg.version);
