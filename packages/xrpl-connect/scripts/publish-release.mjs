import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  NPM_REGISTRY,
  REGISTRY_VERIFY_RETRY_DELAYS_MS,
  RELEASE_PACKAGE_NAMES,
  STABLE_STAGING_TAG,
  assertCompleteRegistryState,
  assertSafePrepublishRegistryState,
  assertStagedRegistryState,
  createReleaseConfig,
  parseReleaseVersion,
} from './release-policy.mjs';
import { run as defaultRun } from './run-command.mjs';

export { REGISTRY_VERIFY_RETRY_DELAYS_MS } from './release-policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectFolder = path.join(__dirname, '..');
const repositoryRoot = path.join(projectFolder, '..', '..');
const inheritedPnpmConfig = [
  'npm_config_dir',
  'npm_config_peer_dependency_rules',
  'npm_config_recursive',
  'npm_config_verify_deps_before_run',
  'npm_config_catalog',
  'npm_config__jsr_registry',
  'npm_config_overrides',
  'npm_config__cypher_laboratory_registry',
];
const releaseSecretEnv = ['NODE_AUTH_TOKEN', 'NPM_TOKEN', 'NPM_READ_TOKEN', 'NPM_DIST_TAG_TOKEN'];
const registryRunOptions = {
  capture: true,
  env: { npm_config_cache: path.join(os.tmpdir(), 'xrpl-connect-registry-cache') },
  unsetEnv: [...inheritedPnpmConfig, ...releaseSecretEnv],
};
const candidatePackages = [
  { name: 'xrpl-connect', folder: path.join(projectFolder, 'dist-publish') },
  {
    name: '@xrpl-commons/xrpl-connect-react',
    folder: path.join(repositoryRoot, 'packages', 'react'),
  },
  { name: '@xrpl-commons/xrpl-connect-vue', folder: path.join(repositoryRoot, 'packages', 'vue') },
];

assert.deepEqual(
  candidatePackages.map(({ name }) => name),
  RELEASE_PACKAGE_NAMES,
  'Publisher package order must match the coordinated release policy'
);

function assertCleanReleaseWorktree(run) {
  const status = run('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: repositoryRoot,
    capture: true,
    unsetEnv: releaseSecretEnv,
  }).trim();
  assert.equal(status, '', `Release worktree must be clean:\n${status}`);
}

function readLocalCandidateIntegrity(run, candidate, config) {
  const output = run('npm', ['pack', '--dry-run', '--json'], {
    ...registryRunOptions,
    cwd: candidate.folder,
  });
  const [metadata] = JSON.parse(output);
  assert.equal(metadata.name, candidate.name, `${candidate.folder} packed unexpectedly`);
  assert.equal(metadata.version, config.version, `${candidate.name} packed with the wrong version`);
  assert(metadata.integrity, `${candidate.name} pack metadata is missing integrity`);
  return metadata.integrity;
}

function readPublishedCandidateIntegrity(run, packageName, config) {
  try {
    const output = run(
      'npm',
      [
        'view',
        `${packageName}@${config.version}`,
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

function readOptionalRegistryTags(run, packageName) {
  try {
    const output = run(
      'npm',
      ['view', packageName, 'dist-tags', '--json', '--registry', NPM_REGISTRY],
      registryRunOptions
    );
    return JSON.parse(output);
  } catch (error) {
    if (/\bcode E404\b/.test(error instanceof Error ? error.message : String(error))) return null;
    throw error;
  }
}

function readRegistryState(run) {
  return Object.fromEntries(
    candidatePackages.map(({ name }) => [name, readOptionalRegistryTags(run, name)])
  );
}

const defaultWait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

async function retryRegistryAssertion(assertion, wait) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      const delayMs = REGISTRY_VERIFY_RETRY_DELAYS_MS[attempt];
      if (delayMs === undefined) throw error;
      console.warn(`Registry verification attempt ${attempt + 1} failed; retrying in ${delayMs}ms`);
      await wait(delayMs);
    }
  }
}

async function verifyPublishedIntegrities(run, candidates, config, wait) {
  await retryRegistryAssertion(() => {
    for (const candidate of candidates) {
      const publishedIntegrity = readPublishedCandidateIntegrity(run, candidate.name, config);
      assert(publishedIntegrity, `${candidate.name}@${config.version} is not visible on npm`);
      assert.equal(
        publishedIntegrity,
        candidate.localIntegrity,
        `${candidate.name}@${config.version} has different contents after publication`
      );
    }
  }, wait);
}

async function verifyRegistryState(run, assertion, wait) {
  await retryRegistryAssertion(() => assertion(readRegistryState(run)), wait);
}

function distTag(run, action, packageName, tag, config) {
  const target = action === 'rm' ? packageName : `${packageName}@${config.version}`;
  const args = ['dist-tag', action, target, tag, '--registry', NPM_REGISTRY];
  run('npm', args, {
    ...registryRunOptions,
    capture: false,
    env: {
      ...registryRunOptions.env,
      ...(process.env.NPM_DIST_TAG_TOKEN
        ? { NODE_AUTH_TOKEN: process.env.NPM_DIST_TAG_TOKEN }
        : {}),
    },
    unsetEnv: [...inheritedPnpmConfig, 'NPM_TOKEN', 'NPM_READ_TOKEN', 'NPM_DIST_TAG_TOKEN'],
  });
}

function publishCandidate(run, candidate, config) {
  const publishRunOptions = {
    ...registryRunOptions,
    capture: false,
    cwd: candidate.folder,
    env: {
      ...registryRunOptions.env,
      npm_config_access: 'public',
      npm_config_registry: NPM_REGISTRY,
      npm_config_tag: config.publishTag,
    },
  };
  run(
    'npm',
    ['publish', '--tag', config.publishTag, '--access', 'public', '--registry', NPM_REGISTRY],
    publishRunOptions
  );
}

export function createReleasePublisher(config, run = defaultRun, wait = defaultWait) {
  return async function publishRelease(args = process.argv.slice(2)) {
    const confirmationArgs = args.filter((arg) => arg !== '--');
    assert.deepEqual(
      confirmationArgs,
      ['--confirm', config.version],
      `Refusing to publish without --confirm ${config.version}`
    );

    assertCleanReleaseWorktree(run);
    run(
      process.execPath,
      ['scripts/test-publish.mjs', '--channel', config.channel, '--check-access'],
      {
        cwd: projectFolder,
        env: process.env.NPM_READ_TOKEN
          ? { NODE_AUTH_TOKEN: process.env.NPM_READ_TOKEN }
          : undefined,
        unsetEnv: ['NPM_TOKEN', 'NPM_READ_TOKEN', 'NPM_DIST_TAG_TOKEN'],
      }
    );

    const prepublishTags = readRegistryState(run);
    const prepublishSnapshot = assertSafePrepublishRegistryState(prepublishTags, config);
    run('pnpm', ['test:publish'], {
      cwd: projectFolder,
      env: { XRPL_RELEASE_CHANNEL: config.channel },
      unsetEnv: releaseSecretEnv,
    });
    assertCleanReleaseWorktree(run);

    const candidates = candidatePackages.map((candidate) => {
      const localIntegrity = readLocalCandidateIntegrity(run, candidate, config);
      const publishedIntegrity = readPublishedCandidateIntegrity(run, candidate.name, config);
      if (publishedIntegrity !== null) {
        assert.equal(
          publishedIntegrity,
          localIntegrity,
          `${candidate.name}@${config.version} is already published with different contents`
        );
      }
      return { ...candidate, localIntegrity, publishedIntegrity };
    });

    const tagsBeforeMutation = readRegistryState(run);
    assertSafePrepublishRegistryState(tagsBeforeMutation, config);
    assert.deepEqual(
      tagsBeforeMutation,
      prepublishTags,
      'Registry tags changed while release artifacts were being verified; rerun the release'
    );

    for (const candidate of candidates) {
      if (candidate.publishedIntegrity === null) {
        publishCandidate(run, candidate, config);
      } else {
        distTag(run, 'add', candidate.name, config.publishTag, config);
        console.log(
          `↷ ${candidate.name}@${config.version} already exists; ensured the ${config.publishTag} tag`
        );
      }
    }

    await verifyPublishedIntegrities(run, candidates, config, wait);

    if (config.channel === 'stable') {
      await verifyRegistryState(
        run,
        (tags) => assertStagedRegistryState(tags, config, prepublishSnapshot),
        wait
      );
      for (const { name } of candidates) distTag(run, 'add', name, 'latest', config);
      for (const { name } of candidates) distTag(run, 'rm', name, STABLE_STAGING_TAG, config);
    } else {
      for (const { name } of candidates) {
        if (prepublishSnapshot[name].latest !== null) continue;
        const tags = readOptionalRegistryTags(run, name);
        if (tags?.latest === config.version) distTag(run, 'rm', name, 'latest', config);
      }
    }

    await verifyRegistryState(
      run,
      (tags) => assertCompleteRegistryState(tags, config, prepublishSnapshot),
      wait
    );
  };
}

export function readLocalReleaseConfig(channel) {
  const manifest = JSON.parse(readFileSync(path.join(projectFolder, 'package.json'), 'utf-8'));
  const parsedVersion = parseReleaseVersion(manifest.version);
  return createReleaseConfig(
    manifest.version,
    channel ?? (parsedVersion.rc === null ? 'stable' : 'rc')
  );
}

function parseCliArgs(args) {
  const normalized = args.filter((arg) => arg !== '--');
  assert.equal(normalized[0], '--channel', 'Release channel must be provided with --channel');
  const config = readLocalReleaseConfig(normalized[1]);
  return { config, confirmationArgs: normalized.slice(2) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { config, confirmationArgs } = parseCliArgs(process.argv.slice(2));
  await createReleasePublisher(config)(confirmationArgs);
}
