import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPkgPath = path.join(__dirname, '../package.json');
const distPkgPath = path.join(__dirname, '../dist-publish/package.json');
const licensePath = path.join(__dirname, '../../../LICENSE');

// Read main package.json
const mainPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));

// These packages remain external in the rolled declarations. The wallet SDKs
// are intentional namespace exports; the other packages provide public types.
// Source every range from its owning adapter so the published facade cannot drift.
const externalDependencySources = [
  ['@walletconnect/types', 'walletconnect'],
  ['@xyrawallet/sdk', 'xyra'],
  ['xumm', 'xaman'],
  ['xumm-oauth2-pkce', 'xaman'],
  ['@gemwallet/api', 'gemwallet'],
  ['@crossmarkio/typings', 'crossmark'],
  ['@types/chrome', 'crossmark'],
  ['@types/node-forge', 'crossmark'],
];

const externalDependencies = {};
for (const [packageName, adapterName] of externalDependencySources) {
  const manifestPath = path.join(__dirname, `../../adapters/${adapterName}/package.json`);
  const adapterPkg = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const range = adapterPkg.dependencies?.[packageName];

  if (!range) {
    console.error(
      `✗ Could not read the '${packageName}' version range from ` +
        `packages/adapters/${adapterName}/package.json (dependencies). The rolled types ` +
        'leave that import external, so the published manifest must declare it. Update the ' +
        'adapter dependency or both publish scripts together.'
    );
    process.exit(1);
  }

  externalDependencies[packageName] = range;
}

// Several public SDK declaration graphs reference Node built-ins. Their own
// manifests treat `@types/node` as a development-only package, so carry our
// pinned range into the published facade to keep strict consumers self-contained.
const nodeTypesRange = mainPkg.devDependencies?.['@types/node'];
if (!nodeTypesRange) {
  console.error(
    "✗ Could not read the '@types/node' version range from packages/xrpl-connect/package.json."
  );
  process.exit(1);
}
externalDependencies['@types/node'] = nodeTypesRange;

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
  // External declaration imports must be installed alongside the package.
  dependencies: externalDependencies,
  // Carry the `xrpl` peer dependency into the published manifest. The rolled
  // `index.d.ts` keeps `import { SubmittableTransaction } from 'xrpl'` external,
  // so consumers must install `xrpl` for the types (and the externalized runtime
  // bundle) to resolve. Without this, npm gives no peer hint and a type-only
  // consumer who hasn't installed `xrpl` gets an unresolved import.
  peerDependencies: mainPkg.peerDependencies,
  publishConfig: mainPkg.publishConfig,
  scripts: { prepublishOnly: mainPkg.scripts.prepublishOnly },
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
fs.copyFileSync(licensePath, path.join(distDir, 'LICENSE'));
console.log('✓ Updated dist-publish/package.json with version', mainPkg.version);
