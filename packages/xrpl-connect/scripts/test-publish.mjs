import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CANDIDATE_VERSION,
  NPM_REGISTRY,
  assertSafePrepublishRegistryState,
} from './publish-rc.mjs';
import { run } from './run-command.mjs';

const FRAMEWORK_PEER_RANGE = '^1.0.0-rc.0';
const NPM_ORGANIZATION = 'xrpl-connect';
const PUBLISH_CONFIG = {
  access: 'public',
  registry: NPM_REGISTRY,
  tag: 'rc',
};
const PUBLISH_GUARD =
  "node -e \"const { npm_config_tag: tag, npm_config_access: access, npm_config_registry: registry } = process.env; let registryUrl = ''; try { registryUrl = new URL(registry).href; } catch {} if (tag !== 'rc' || access !== 'public' || registryUrl !== 'https://registry.npmjs.org/') { console.error('Publish requires --tag rc --access public --registry https://registry.npmjs.org/'); process.exit(1); }\"";
const inheritedPnpmConfig = [
  'npm_config_peer_dependency_rules',
  'npm_config_recursive',
  'npm_config_verify_deps_before_run',
  'npm_config_catalog',
  'npm_config__jsr_registry',
  'npm_config_overrides',
  'npm_config__cypher_laboratory_registry',
];
const registryRunOptions = {
  env: { npm_config_cache: path.join(os.tmpdir(), 'xrpl-connect-registry-cache') },
  unsetEnv: inheritedPnpmConfig,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectFolder = path.join(__dirname, '..');
const repositoryRoot = path.join(projectFolder, '..', '..');
const fixturesFolder = path.join(projectFolder, 'tests', 'publish');
const reactFixturesFolder = path.join(repositoryRoot, 'packages', 'react', 'tests', 'publish');
const vueFixturesFolder = path.join(repositoryRoot, 'packages', 'vue', 'tests', 'publish');
const candidatePackages = [
  {
    name: 'xrpl-connect',
    folder: path.join(projectFolder, 'dist-publish'),
    requiredFiles: [
      'package.json',
      'README.md',
      'LICENSE',
      'index.d.ts',
      'xrpl-connect.mjs',
      'xrpl-connect.umd.js',
    ],
  },
  {
    name: '@xrpl-connect/react',
    folder: path.join(repositoryRoot, 'packages', 'react'),
    requiredFiles: [
      'package.json',
      'README.md',
      'LICENSE',
      'dist/index.d.ts',
      'dist/index.d.mts',
      'dist/index.js',
      'dist/index.mjs',
    ],
  },
  {
    name: '@xrpl-connect/vue',
    folder: path.join(repositoryRoot, 'packages', 'vue'),
    requiredFiles: [
      'package.json',
      'README.md',
      'LICENSE',
      'dist/index.d.ts',
      'dist/index.d.mts',
      'dist/index.js',
      'dist/index.mjs',
    ],
  },
];

function parseJson(command, args, options) {
  return JSON.parse(run(command, args, { ...options, capture: true }));
}

function verifyNpmAccess() {
  const username = run('npm', ['whoami', '--registry', NPM_REGISTRY], {
    ...registryRunOptions,
    capture: true,
  }).trim();
  const members = parseJson(
    'npm',
    ['org', 'ls', NPM_ORGANIZATION, '--json', '--registry', NPM_REGISTRY],
    registryRunOptions
  );
  const isMember = Array.isArray(members)
    ? members.includes(username)
    : Object.prototype.hasOwnProperty.call(members, username);

  assert(isMember, `${username} is not a member of the @${NPM_ORGANIZATION} npm organization`);
  const owners = run('npm', ['owner', 'ls', 'xrpl-connect', '--registry', NPM_REGISTRY], {
    ...registryRunOptions,
    capture: true,
  })
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/, 1)[0])
    .filter(Boolean);
  assert(
    owners.includes(username),
    `${username} is not an owner of the existing unscoped xrpl-connect package`
  );
  console.log(`✓ ${username} can publish first-time packages under @${NPM_ORGANIZATION}`);
  console.log(`✓ ${username} can publish the existing unscoped xrpl-connect package`);
}

function readRegistryTags(packageName) {
  return parseJson(
    'npm',
    ['view', packageName, 'dist-tags', '--json', '--registry', NPM_REGISTRY],
    registryRunOptions
  );
}

function readOptionalRegistryTags(packageName) {
  try {
    return readRegistryTags(packageName);
  } catch (error) {
    if (/\bcode E404\b/.test(error instanceof Error ? error.message : String(error))) return null;
    throw error;
  }
}

function verifyPrepublishRegistryState() {
  const tagsByPackage = Object.fromEntries(
    candidatePackages.map(({ name }) => [name, readOptionalRegistryTags(name)])
  );
  assertSafePrepublishRegistryState(tagsByPackage);
  console.log('✓ Registry preflight is safe for a fresh or resumed candidate publication');
}

function verifyRegistryTags() {
  const tagsByPackage = Object.fromEntries(
    candidatePackages.map(({ name }) => [name, readRegistryTags(name)])
  );

  assert.deepEqual(tagsByPackage['xrpl-connect'], {
    latest: '0.8.2',
    rc: CANDIDATE_VERSION,
  });
  assert.deepEqual(tagsByPackage['@xrpl-connect/react'], { rc: CANDIDATE_VERSION });
  assert.deepEqual(tagsByPackage['@xrpl-connect/vue'], { rc: CANDIDATE_VERSION });
  console.log('✓ Registry tags expose only the intended release candidate and preserve latest');
}

const modes = new Set(process.argv.slice(2));
const knownModes = new Set(['--check-access', '--check-prepublish', '--check-registry']);
for (const mode of modes) {
  assert(knownModes.has(mode), `Unknown argument: ${mode}`);
}

if (modes.has('--check-access')) verifyNpmAccess();
if (modes.has('--check-prepublish')) verifyPrepublishRegistryState();
if (modes.has('--check-registry')) verifyRegistryTags();
if (modes.size > 0) process.exit(0);

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'xrpl-connect-publish-'));
const runOptions = {
  env: { npm_config_cache: path.join(temporaryRoot, '.npm-cache') },
  unsetEnv: inheritedPnpmConfig,
};
const publishRunOptions = (tag, registry) => ({
  ...runOptions,
  env: {
    ...runOptions.env,
    npm_config_access: 'public',
    npm_config_registry: registry,
    npm_config_tag: tag,
  },
});

try {
  const tarballs = [];
  for (const candidate of candidatePackages) {
    const [packMetadata] = parseJson(
      'npm',
      ['pack', '--json', '--pack-destination', temporaryRoot],
      { ...runOptions, cwd: candidate.folder }
    );
    assert.equal(packMetadata.name, candidate.name);
    assert.equal(packMetadata.version, CANDIDATE_VERSION);

    const packedFiles = new Set(packMetadata.files.map((file) => file.path));
    for (const requiredFile of candidate.requiredFiles) {
      assert(packedFiles.has(requiredFile), `${candidate.name} is missing ${requiredFile}`);
    }

    tarballs.push(path.join(temporaryRoot, packMetadata.filename));
    console.log(`→ Dry-running ${candidate.name}@${CANDIDATE_VERSION}`);
    run(
      'npm',
      [
        'publish',
        '--dry-run',
        '--json',
        '--tag',
        'rc',
        '--access',
        'public',
        '--registry',
        NPM_REGISTRY,
      ],
      {
        ...publishRunOptions('rc', NPM_REGISTRY),
        cwd: candidate.folder,
      }
    );
  }

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
      '--strict-peer-deps',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      ...tarballs,
      '@types/react@^18.3.0',
      '@types/react-dom@^18.3.0',
      'xrpl@^4.0.0',
      'jsdom@^22.1.0',
      'react@^18.3.1',
      'react-dom@^18.3.1',
      'vue@^3.5.22',
      '@vue/server-renderer@^3.5.22',
    ],
    { ...runOptions, cwd: consumerFolder }
  );
  console.log('✓ Candidate install completed with strict peer dependency checks');

  const installedManifests = Object.fromEntries(
    candidatePackages.map(({ name }) => [
      name,
      JSON.parse(
        readFileSync(path.join(consumerFolder, 'node_modules', name, 'package.json'), 'utf-8')
      ),
    ])
  );

  for (const [name, manifest] of Object.entries(installedManifests)) {
    assert.equal(manifest.version, CANDIDATE_VERSION, `${name} has the wrong packed version`);
    assert.deepEqual(manifest.publishConfig, PUBLISH_CONFIG, `${name} has unsafe publish defaults`);
    assert.equal(manifest.scripts?.prepublishOnly, PUBLISH_GUARD, `${name} has no publish guard`);
  }

  assert.throws(
    () =>
      run(
        'npm',
        [
          'publish',
          '--dry-run',
          '--tag',
          'latest',
          '--access',
          'public',
          '--registry',
          NPM_REGISTRY,
        ],
        {
          ...publishRunOptions('latest', NPM_REGISTRY),
          capture: true,
          cwd: candidatePackages[0].folder,
        }
      ),
    /Publish requires --tag rc --access public/
  );
  assert.throws(
    () =>
      run(
        'npm',
        [
          'publish',
          '--dry-run',
          '--tag',
          'rc',
          '--access',
          'public',
          '--registry',
          'https://registry.example/',
        ],
        {
          ...publishRunOptions('rc', 'https://registry.example/'),
          capture: true,
          cwd: candidatePackages[0].folder,
        }
      ),
    /Publish requires .*--registry https:\/\/registry\.npmjs\.org\//
  );
  assert.equal(
    installedManifests['@xrpl-connect/react'].peerDependencies?.['xrpl-connect'],
    FRAMEWORK_PEER_RANGE
  );
  assert.equal(
    installedManifests['@xrpl-connect/vue'].peerDependencies?.['xrpl-connect'],
    FRAMEWORK_PEER_RANGE
  );
  assert.deepEqual(installedManifests['xrpl-connect'].peerDependencies, {
    xrpl: '^3.0.0 || ^4.0.0',
  });
  assert.deepEqual(installedManifests['@xrpl-connect/react'].peerDependencies, {
    react: '^18.0.0 || ^19.0.0',
    'react-dom': '^18.0.0 || ^19.0.0',
    xrpl: '^3.0.0 || ^4.0.0',
    'xrpl-connect': FRAMEWORK_PEER_RANGE,
  });
  assert.deepEqual(installedManifests['@xrpl-connect/vue'].peerDependencies, {
    vue: '^3.5.0',
    xrpl: '^3.0.0 || ^4.0.0',
    'xrpl-connect': FRAMEWORK_PEER_RANGE,
  });

  const umbrellaManifest = installedManifests['xrpl-connect'];
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
      umbrellaManifest.dependencies?.[dependency],
      `Published xrpl-connect manifest is missing ${dependency}`
    );
  }

  for (const framework of ['react', 'vue']) {
    const installedFrameworkFolder = path.join(
      consumerFolder,
      'node_modules',
      '@xrpl-connect',
      framework
    );
    for (const declaration of ['dist/index.d.ts', 'dist/index.d.mts']) {
      const contents = readFileSync(path.join(installedFrameworkFolder, declaration), 'utf-8');
      assert(
        !contents.includes('@xrpl-connect/core'),
        `${framework}/${declaration} leaks the development-only @xrpl-connect/core package`
      );
    }
  }

  const fixtures = [
    'runtime-env.cjs',
    'runtime-esm.mjs',
    'runtime-cjs.cjs',
    'runtime-ssr-esm.mjs',
    'runtime-ssr-cjs.cjs',
    'types-esm.mts',
    'types-cjs.cts',
    'tsconfig.esm.json',
    'tsconfig.cjs.json',
  ];
  for (const fixture of fixtures) {
    copyFileSync(path.join(fixturesFolder, fixture), path.join(consumerFolder, fixture));
  }
  for (const fixture of [
    'runtime-ssr.mjs',
    'types-react-esm.mts',
    'types-react-cjs.cts',
    'tsconfig.react.json',
  ]) {
    copyFileSync(path.join(reactFixturesFolder, fixture), path.join(consumerFolder, fixture));
  }
  for (const fixture of ['types-vue-esm.mts', 'types-vue-cjs.cts', 'tsconfig.vue.json']) {
    copyFileSync(path.join(vueFixturesFolder, fixture), path.join(consumerFolder, fixture));
  }
  copyFileSync(
    path.join(vueFixturesFolder, 'runtime-ssr.mjs'),
    path.join(consumerFolder, 'vue-runtime-ssr.mjs')
  );

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
  console.log('→ Type-checking packed React ESM and CommonJS consumers');
  run(process.execPath, [tscPath, '--project', 'tsconfig.react.json'], {
    ...runOptions,
    cwd: consumerFolder,
  });
  console.log('→ Type-checking packed Vue ESM and CommonJS consumers');
  run(process.execPath, [tscPath, '--project', 'tsconfig.vue.json'], {
    ...runOptions,
    cwd: consumerFolder,
  });
  console.log('→ Loading packed umbrella ESM without browser globals');
  run(process.execPath, ['runtime-ssr-esm.mjs'], { ...runOptions, cwd: consumerFolder });
  console.log('→ Loading packed umbrella CommonJS without browser globals');
  run(process.execPath, ['runtime-ssr-cjs.cjs'], { ...runOptions, cwd: consumerFolder });
  console.log('→ Loading packed ESM runtime');
  run(process.execPath, ['runtime-esm.mjs'], { ...runOptions, cwd: consumerFolder });
  console.log('→ Loading packed CommonJS runtime');
  run(process.execPath, ['runtime-cjs.cjs'], { ...runOptions, cwd: consumerFolder });
  console.log('→ Loading packed React ESM and CommonJS entries in SSR');
  run(process.execPath, ['runtime-ssr.mjs'], { ...runOptions, cwd: consumerFolder });
  console.log('→ Loading packed Vue ESM and CommonJS entries in SSR');
  run(process.execPath, ['vue-runtime-ssr.mjs'], { ...runOptions, cwd: consumerFolder });

  console.log('✓ Packed candidates passed manifest, publish, peer, runtime, and type checks');
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
