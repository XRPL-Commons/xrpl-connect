import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './run-command.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectFolder = path.join(__dirname, '..');
const repositoryRoot = path.join(projectFolder, '..', '..');
const publishFolder = path.join(projectFolder, 'dist-publish');
const fixturesFolder = path.join(projectFolder, 'tests', 'publish');
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'xrpl-connect-publish-'));

const runOptions = { env: { npm_config_cache: path.join(temporaryRoot, '.npm-cache') } };

try {
  const packOutput = run('npm', ['pack', '--json', '--pack-destination', temporaryRoot], {
    ...runOptions,
    cwd: publishFolder,
    capture: true,
  });
  const [packMetadata] = JSON.parse(packOutput);
  const packedFiles = new Set(packMetadata.files.map((file) => file.path));

  for (const requiredFile of [
    'package.json',
    'README.md',
    'index.d.ts',
    'xrpl-connect.mjs',
    'xrpl-connect.umd.js',
  ]) {
    assert(packedFiles.has(requiredFile), `Packed package is missing ${requiredFile}`);
  }

  const tarballPath = path.join(temporaryRoot, packMetadata.filename);
  const consumerFolder = path.join(temporaryRoot, 'consumer');
  mkdirSync(consumerFolder);
  writeFileSync(
    path.join(consumerFolder, 'package.json'),
    JSON.stringify(
      { name: 'xrpl-connect-publish-consumer', private: true, type: 'module' },
      null,
      2
    )
  );

  run(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      tarballPath,
      'xrpl@^4.0.0',
      'jsdom@^22.1.0',
    ],
    { ...runOptions, cwd: consumerFolder }
  );

  const installedManifest = JSON.parse(
    readFileSync(path.join(consumerFolder, 'node_modules', 'xrpl-connect', 'package.json'), 'utf-8')
  );
  for (const dependency of [
    '@walletconnect/types',
    '@xyrawallet/sdk',
    '@types/node',
    'xumm',
    'xumm-oauth2-pkce',
    '@gemwallet/api',
    '@crossmarkio/typings',
    '@types/chrome',
    '@types/node-forge',
  ]) {
    assert(
      installedManifest.dependencies?.[dependency],
      `Published manifest is missing ${dependency}`
    );
  }

  const fixtures = [
    'runtime-env.cjs',
    'runtime-esm.mjs',
    'runtime-cjs.cjs',
    'types-esm.mts',
    'types-cjs.cts',
    'tsconfig.esm.json',
    'tsconfig.cjs.json',
  ];
  for (const fixture of fixtures) {
    copyFileSync(path.join(fixturesFolder, fixture), path.join(consumerFolder, fixture));
  }

  const tscPath = path.join(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  console.log('→ Type-checking packed ESM consumer');
  run(process.execPath, [tscPath, '--project', 'tsconfig.esm.json'], {
    ...runOptions,
    cwd: consumerFolder,
  });
  console.log('→ Type-checking packed CommonJS consumer');
  run(process.execPath, [tscPath, '--project', 'tsconfig.cjs.json'], {
    ...runOptions,
    cwd: consumerFolder,
  });
  console.log('→ Loading packed ESM runtime');
  run(process.execPath, ['runtime-esm.mjs'], { ...runOptions, cwd: consumerFolder });
  console.log('→ Loading packed CommonJS runtime');
  run(process.execPath, ['runtime-cjs.cjs'], { ...runOptions, cwd: consumerFolder });

  console.log('✓ Packed xrpl-connect package passed ESM, CommonJS, and TypeScript consumer tests');
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
