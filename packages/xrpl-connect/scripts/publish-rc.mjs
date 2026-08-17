import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { run as defaultRun } from './run-command.mjs';

export const CANDIDATE_VERSION = '1.0.0-rc.0';
export const NPM_REGISTRY = 'https://registry.npmjs.org/';
const LATEST_VERSION = '0.8.2';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectFolder = path.join(__dirname, '..');
const repositoryRoot = path.join(projectFolder, '..', '..');
const registryRunOptions = {
  capture: true,
  env: { npm_config_cache: path.join(os.tmpdir(), 'xrpl-connect-registry-cache') },
};
const candidatePackages = [
  { name: 'xrpl-connect', folder: path.join(projectFolder, 'dist-publish') },
  { name: '@xrpl-connect/react', folder: path.join(repositoryRoot, 'packages', 'react') },
  { name: '@xrpl-connect/vue', folder: path.join(repositoryRoot, 'packages', 'vue') },
];

export function assertSafePrepublishRegistryState(tagsByPackage) {
  const umbrellaTags = tagsByPackage['xrpl-connect'];
  assert(umbrellaTags, 'xrpl-connect must already exist on npm');
  assert.equal(umbrellaTags.latest, LATEST_VERSION, 'xrpl-connect@latest changed unexpectedly');
  assert(
    umbrellaTags.rc === undefined || umbrellaTags.rc === CANDIDATE_VERSION,
    `xrpl-connect@rc must be absent or point to ${CANDIDATE_VERSION}`
  );
  assert.deepEqual(
    Object.keys(umbrellaTags).sort(),
    umbrellaTags.rc === undefined ? ['latest'] : ['latest', 'rc'],
    'xrpl-connect has unexpected dist-tags'
  );

  for (const packageName of ['@xrpl-connect/react', '@xrpl-connect/vue']) {
    const tags = tagsByPackage[packageName];
    if (tags === null) continue;
    assert.deepEqual(
      tags,
      { rc: CANDIDATE_VERSION },
      `${packageName} must be unpublished or expose only the confirmed rc tag`
    );
  }
}

function readLocalCandidateIntegrity(run, { name, folder }) {
  const output = run('npm', ['pack', '--dry-run', '--json'], {
    ...registryRunOptions,
    cwd: folder,
  });
  const [metadata] = JSON.parse(output);
  assert.equal(metadata.name, name, `${folder} packed with an unexpected package name`);
  assert.equal(metadata.version, CANDIDATE_VERSION, `${name} packed with an unexpected version`);
  assert(metadata.integrity, `${name} pack metadata is missing integrity`);
  return metadata.integrity;
}

function readPublishedCandidateIntegrity(run, packageName) {
  try {
    const output = run(
      'npm',
      [
        'view',
        `${packageName}@${CANDIDATE_VERSION}`,
        'dist.integrity',
        '--json',
        '--registry',
        NPM_REGISTRY,
      ],
      registryRunOptions
    );
    return JSON.parse(output);
  } catch (error) {
    if (/\bcode E404\b/.test(error instanceof Error ? error.message : String(error))) return null;
    throw error;
  }
}

export function createRcPublisher(run = defaultRun) {
  return function publishRc(args = process.argv.slice(2)) {
    const confirmationArgs = args[0] === '--' ? args.slice(1) : args;
    assert.deepEqual(
      confirmationArgs,
      ['--confirm', CANDIDATE_VERSION],
      `Refusing to publish without --confirm ${CANDIDATE_VERSION}`
    );

    run(process.execPath, ['scripts/test-publish.mjs', '--check-access', '--check-prepublish'], {
      cwd: projectFolder,
    });
    run('pnpm', ['test:publish'], { cwd: projectFolder });

    for (const candidate of candidatePackages) {
      const { name, folder } = candidate;
      const localIntegrity = readLocalCandidateIntegrity(run, candidate);
      const publishedIntegrity = readPublishedCandidateIntegrity(run, name);
      if (publishedIntegrity !== null) {
        assert.equal(
          publishedIntegrity,
          localIntegrity,
          `${name}@${CANDIDATE_VERSION} is already published with different contents`
        );
        console.log(`↷ ${name}@${CANDIDATE_VERSION} is already published; skipping`);
        continue;
      }
      run('npm', ['publish', '--tag', 'rc', '--access', 'public', '--registry', NPM_REGISTRY], {
        cwd: folder,
      });
    }

    run(process.execPath, ['scripts/test-publish.mjs', '--check-registry'], {
      cwd: projectFolder,
    });
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  createRcPublisher()();
}
