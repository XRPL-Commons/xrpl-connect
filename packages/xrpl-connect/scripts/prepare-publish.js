import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPkgPath = path.join(__dirname, '../package.json');
const distPkgPath = path.join(__dirname, '../dist-publish/package.json');

// Read main package.json
const mainPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));

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
