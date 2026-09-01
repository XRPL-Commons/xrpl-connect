import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createReleasePublisher } from './publish-release.mjs';
import {
  NPM_REGISTRY,
  PUBLISH_GUARD,
  REGISTRY_VERIFY_RETRY_DELAYS_MS,
  RELEASE_PACKAGE_NAMES,
  STABLE_STAGING_TAG,
  assertCompleteRegistryState,
  assertSafePrepublishRegistryState,
  assertStagedRegistryState,
  createReleaseConfig,
} from './release-policy.mjs';
import { createCommandRunner } from './run-command.mjs';

const RC1 = createReleaseConfig('1.0.0-rc.1', 'rc');
const RC2 = createReleaseConfig('1.0.0-rc.2', 'rc');
const STABLE = createReleaseConfig('1.0.0', 'stable');
const currentTags = {
  'xrpl-connect': { latest: '0.8.2', rc: '1.0.0-rc.0' },
  '@xrpl-commons/xrpl-connect-react': {
    latest: '1.0.0-rc.0',
    rc: '1.0.0-rc.0',
  },
  '@xrpl-commons/xrpl-connect-vue': {
    latest: '1.0.0-rc.0',
    rc: '1.0.0-rc.0',
  },
};
const clone = (value) => structuredClone(value);

test('command runner preserves arguments and reports process failures', () => {
  const calls = [];
  const run = createCommandRunner((...args) => {
    calls.push(args);
    return { status: 0, stdout: 'packed' };
  });
  const commandArgs = ['install', 'C:\\Temp Folder\\package.tgz'];
  assert.equal(
    run('npm', commandArgs, {
      capture: true,
      cwd: 'consumer',
      env: { TEST_ENV: 'set', TEST_REMOVED: 'remove-me' },
      unsetEnv: ['TEST_REMOVED'],
    }),
    'packed'
  );
  assert.strictEqual(calls[0][1], commandArgs);
  assert.equal(calls[0][2].env.TEST_ENV, 'set');
  assert.equal('TEST_REMOVED' in calls[0][2].env, false);
  assert.equal('shell' in calls[0][2], false);

  const spawnError = new Error('spawn failed');
  assert.throws(
    () => createCommandRunner(() => ({ error: spawnError }))('npm', ['pack']),
    spawnError
  );
  assert.throws(
    () =>
      createCommandRunner(() => ({ status: 2, stdout: 'out', stderr: 'err' }))('npm', ['pack'], {
        capture: true,
      }),
    /npm pack failed with exit code 2\nout\nerr/
  );
});

test('source package rejects direct publishing and exposes RC and stable commands', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
  const guard = manifest.scripts.prepublishOnly.slice('node -e "'.length, -1);
  const result = spawnSync(process.execPath, ['-e', guard], { encoding: 'utf-8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Do not publish xrpl-connect from the source package/);
  assert.match(result.stderr, /publish:rc/);
  assert.match(result.stderr, /publish:stable/);
  assert.match(manifest.scripts['publish:build'], /vp run -F "\{\.\}\^\.\.\."/);
});

test('artifact guard accepts only the version-matched tag and fixed registry', () => {
  const guard = PUBLISH_GUARD.slice('node -e "'.length, -1);
  const execute = (version, tag, registry = NPM_REGISTRY) =>
    spawnSync(process.execPath, ['-e', guard], {
      encoding: 'utf-8',
      env: {
        ...process.env,
        npm_package_version: version,
        npm_config_tag: tag,
        npm_config_access: 'public',
        npm_config_registry: registry,
      },
    });
  assert.equal(execute(RC1.version, 'rc').status, 0);
  assert.equal(execute(STABLE.version, STABLE_STAGING_TAG).status, 0);
  assert.equal(execute(RC1.version, STABLE_STAGING_TAG).status, 1);
  assert.equal(execute(STABLE.version, 'latest').status, 1);
  assert.equal(execute(RC1.version, 'rc', 'https://registry.example/').status, 1);
});

test('release configuration enforces version/channel combinations', () => {
  assert.throws(() => createReleaseConfig('1.0.0-rc.1', 'stable'), /not a stable/);
  assert.throws(() => createReleaseConfig('1.0.0', 'rc'), /not a rc/);
  assert.throws(() => createReleaseConfig('1.0.0-beta.1', 'rc'), /Unsupported/);
  assert.throws(() => createReleaseConfig('1.0.0-rc.1', 'next'), /Unsupported release channel/);
});

test('trusted release workflow publishes before tagging and deploys docs from releases', () => {
  const workflow = readFileSync(
    new URL('../../../.github/workflows/release.yaml', import.meta.url),
    'utf-8'
  );
  const docsWorkflow = readFileSync(
    new URL('../../../.github/workflows/deploy_vitepressDoc.yaml', import.meta.url),
    'utf-8'
  );
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /environment: npm/);
  assert.match(workflow, /NPM_CONFIG_PROVENANCE: true/);
  assert.match(workflow, /npm@11\.6\.2/);
  assert.match(workflow, /secrets\.NPM_READ_TOKEN/);
  assert.match(workflow, /secrets\.NPM_DIST_TAG_TOKEN/);
  assert.doesNotMatch(workflow, /env:\n\s+NODE_AUTH_TOKEN:/);
  assert(
    workflow.indexOf('Publish and verify coordinated artifacts') <
      workflow.indexOf('Create immutable source tag'),
    'source tag is created before registry verification'
  );
  assert(
    workflow.indexOf('Create immutable source tag') < workflow.indexOf('Create GitHub Release'),
    'GitHub Release is created before its source tag'
  );
  assert.match(docsWorkflow, /release:\n\s+types: \[published\]/);
  assert.doesNotMatch(docsWorkflow, /branches: \[develop\]/);
  assert.doesNotMatch(docsWorkflow, /workflow_dispatch/);
});

test('RC policy accepts fresh and subsequent candidates while preserving latest', () => {
  const snapshot = assertSafePrepublishRegistryState(clone(currentTags), RC1);
  const complete = clone(currentTags);
  for (const tags of Object.values(complete)) tags.rc = RC1.version;
  assert.doesNotThrow(() => assertCompleteRegistryState(complete, RC1, snapshot));

  const subsequent = clone(complete);
  assert.doesNotThrow(() => assertSafePrepublishRegistryState(subsequent, RC2));
});

test('RC policy rejects latest movement, future RCs, and unknown tags', () => {
  const movedLatest = clone(currentTags);
  movedLatest['xrpl-connect'].latest = RC1.version;
  assert.throws(() => assertSafePrepublishRegistryState(movedLatest, RC1), /latest must precede/);
  const future = clone(currentTags);
  future['xrpl-connect'].rc = RC2.version;
  assert.throws(() => assertSafePrepublishRegistryState(future, RC1), /cannot be newer/);
  const unknown = clone(currentTags);
  unknown['xrpl-connect'].next = '1.0.0-beta.1';
  assert.throws(() => assertSafePrepublishRegistryState(unknown, RC1), /unexpected dist-tags/);
});

test('stable policy accepts staged and partially promoted resumable states', () => {
  const snapshot = assertSafePrepublishRegistryState(clone(currentTags), STABLE);
  const staged = clone(currentTags);
  for (const tags of Object.values(staged)) tags[STABLE_STAGING_TAG] = STABLE.version;
  staged['xrpl-connect'].latest = STABLE.version;
  assert.doesNotThrow(() => assertSafePrepublishRegistryState(staged, STABLE));
  assert.doesNotThrow(() => assertStagedRegistryState(staged, STABLE, snapshot));

  const complete = clone(staged);
  for (const tags of Object.values(complete)) {
    tags.latest = STABLE.version;
    delete tags[STABLE_STAGING_TAG];
  }
  assert.doesNotThrow(() => assertCompleteRegistryState(complete, STABLE, snapshot));
});

test('stable policy rejects wrong staging and incomplete promotion', () => {
  const snapshot = assertSafePrepublishRegistryState(clone(currentTags), STABLE);
  const wrong = clone(currentTags);
  wrong['xrpl-connect'][STABLE_STAGING_TAG] = '1.0.1';
  assert.throws(() => assertSafePrepublishRegistryState(wrong, STABLE), /must be absent or point/);
  const incomplete = clone(currentTags);
  for (const tags of Object.values(incomplete)) tags[STABLE_STAGING_TAG] = STABLE.version;
  assert.throws(
    () => assertCompleteRegistryState(incomplete, STABLE, snapshot),
    /@latest must point/
  );
});

function packageNameForTarget(target, config) {
  return RELEASE_PACKAGE_NAMES.find(
    (name) => target === name || target === `${name}@${config.version}`
  );
}

function packageNameForFolder(folder) {
  if (folder.endsWith('dist-publish')) return 'xrpl-connect';
  if (folder.endsWith('react')) return '@xrpl-commons/xrpl-connect-react';
  return '@xrpl-commons/xrpl-connect-vue';
}

function createRegistryHarness(
  config,
  {
    tags = currentTags,
    publishedPackages = new Map(),
    visibilityFailures = 0,
    dirty = '',
    mutateAfterCandidateScan = null,
  } = {}
) {
  const calls = [];
  const waits = [];
  const registryTags = clone(tags);
  const published = new Map(publishedPackages);
  let remainingVisibilityFailures = visibilityFailures;
  let publicationStarted = false;
  let candidateIntegrityReads = 0;

  const run = (command, args, options = {}) => {
    calls.push({
      command,
      args: [...args],
      cwd: options.cwd,
      env: options.env,
      unsetEnv: options.unsetEnv,
    });
    if (command === 'git') return dirty;
    if (command === process.execPath || command === 'pnpm') return '';
    assert.equal(command, 'npm');

    if (args[0] === 'pack') {
      const name = packageNameForFolder(options.cwd);
      return JSON.stringify([{ name, version: config.version, integrity: `integrity:${name}` }]);
    }
    if (args[0] === 'view' && args[2] === 'dist.integrity') {
      const name = packageNameForTarget(args[1], config);
      if (!publicationStarted) {
        candidateIntegrityReads += 1;
        if (candidateIntegrityReads === RELEASE_PACKAGE_NAMES.length) {
          mutateAfterCandidateScan?.(registryTags);
        }
      }
      if (publicationStarted && remainingVisibilityFailures > 0) {
        remainingVisibilityFailures -= 1;
        throw new Error(`npm view failed with code E404 for ${name}`);
      }
      if (!published.has(name)) throw new Error(`npm view failed with code E404 for ${name}`);
      return JSON.stringify(published.get(name));
    }
    if (args[0] === 'view' && args[2] === 'dist-tags') {
      const value = registryTags[args[1]];
      if (value === null || value === undefined) {
        throw new Error(`npm view failed with code E404 for ${args[1]}`);
      }
      return JSON.stringify(value);
    }
    if (args[0] === 'publish') {
      publicationStarted = true;
      const name = packageNameForFolder(options.cwd);
      published.set(name, `integrity:${name}`);
      registryTags[name] ??= {};
      registryTags[name][config.publishTag] = config.version;
      return '';
    }
    if (args[0] === 'dist-tag') {
      publicationStarted = true;
      const name = packageNameForTarget(args[2], config);
      assert(name, `Unknown dist-tag target: ${args[2]}`);
      registryTags[name] ??= {};
      if (args[1] === 'add') registryTags[name][args[3]] = config.version;
      else delete registryTags[name][args[3]];
      return '';
    }
    assert.fail(`Unexpected npm command: ${args.join(' ')}`);
  };

  return {
    calls,
    waits,
    registryTags,
    publish: createReleasePublisher(config, run, async (delayMs) => waits.push(delayMs)),
  };
}

test('publisher requires exact confirmation before any command', async () => {
  const publish = createReleasePublisher(RC1, () => assert.fail('must not run'));
  await assert.rejects(publish([]), new RegExp(`--confirm ${RC1.version}`));
  await assert.rejects(publish(['--confirm', RC2.version]), new RegExp(`--confirm ${RC1.version}`));
});

test('fresh RC publishes through fixed rc policy and preserves every latest tag', async () => {
  const harness = createRegistryHarness(RC1);
  await harness.publish(['--', '--confirm', RC1.version]);
  const publishCalls = harness.calls.filter(({ args }) => args[0] === 'publish');
  assert.equal(publishCalls.length, 3);
  for (const call of publishCalls) {
    assert.deepEqual(call.args, [
      'publish',
      '--tag',
      'rc',
      '--access',
      'public',
      '--registry',
      NPM_REGISTRY,
    ]);
    assert.equal(call.env.npm_config_tag, 'rc');
  }
  for (const name of RELEASE_PACKAGE_NAMES) {
    assert.equal(harness.registryTags[name].rc, RC1.version);
    assert.equal(harness.registryTags[name].latest, currentTags[name].latest);
  }
});

test('subsequent RC advances only rc', async () => {
  const tags = clone(currentTags);
  for (const value of Object.values(tags)) value.rc = RC1.version;
  const harness = createRegistryHarness(RC2, { tags });
  await harness.publish(['--confirm', RC2.version]);
  for (const name of RELEASE_PACKAGE_NAMES) {
    assert.equal(harness.registryTags[name].rc, RC2.version);
    assert.equal(harness.registryTags[name].latest, currentTags[name].latest);
  }
});

test('RC publisher resumes identical partial publication', async () => {
  const tags = clone(currentTags);
  tags['xrpl-connect'].rc = RC1.version;
  const publishedPackages = new Map([
    ['xrpl-connect', 'integrity:xrpl-connect'],
    ['@xrpl-commons/xrpl-connect-react', 'integrity:@xrpl-commons/xrpl-connect-react'],
  ]);
  const harness = createRegistryHarness(RC1, { tags, publishedPackages });
  await harness.publish(['--confirm', RC1.version]);
  assert.equal(harness.calls.filter(({ args }) => args[0] === 'publish').length, 1);
  for (const name of RELEASE_PACKAGE_NAMES)
    assert.equal(harness.registryTags[name].rc, RC1.version);
});

test('publisher detects every immutable conflict before any registry mutation', async () => {
  const publishedPackages = new Map([
    ['xrpl-connect', 'integrity:xrpl-connect'],
    ['@xrpl-commons/xrpl-connect-react', 'integrity:@xrpl-commons/xrpl-connect-react'],
    ['@xrpl-commons/xrpl-connect-vue', 'different-integrity'],
  ]);
  const harness = createRegistryHarness(RC1, { publishedPackages });
  await assert.rejects(harness.publish(['--confirm', RC1.version]), /different contents/);
  assert.equal(
    harness.calls.some(({ args }) => ['publish', 'dist-tag'].includes(args[0])),
    false
  );
});

test('publisher refuses to overwrite tags changed during artifact verification', async () => {
  const harness = createRegistryHarness(RC1, {
    mutateAfterCandidateScan: (tags) => {
      tags['xrpl-connect'].rc = RC2.version;
    },
  });
  await assert.rejects(harness.publish(['--confirm', RC1.version]), /cannot be newer/);
  assert.equal(
    harness.calls.some(({ args }) => ['publish', 'dist-tag'].includes(args[0])),
    false
  );
});

test('stable publication verifies all staged artifacts before moving latest', async () => {
  const harness = createRegistryHarness(STABLE);
  await harness.publish(['--confirm', STABLE.version]);
  const firstLatest = harness.calls.findIndex(
    ({ args }) => args[0] === 'dist-tag' && args[1] === 'add' && args[3] === 'latest'
  );
  const lastIntegrityRead = harness.calls.findLastIndex(
    ({ args }) => args[0] === 'view' && args[2] === 'dist.integrity'
  );
  assert(firstLatest > lastIntegrityRead, 'latest moved before all artifact integrities verified');
  for (const name of RELEASE_PACKAGE_NAMES) {
    assert.equal(harness.registryTags[name].latest, STABLE.version);
    assert.equal(harness.registryTags[name].rc, currentTags[name].rc);
    assert.equal(harness.registryTags[name][STABLE_STAGING_TAG], undefined);
  }
});

test('stable publication resumes partial upload and partial latest promotion', async () => {
  const tags = clone(currentTags);
  tags['xrpl-connect'][STABLE_STAGING_TAG] = STABLE.version;
  tags['xrpl-connect'].latest = STABLE.version;
  tags['@xrpl-commons/xrpl-connect-react'][STABLE_STAGING_TAG] = STABLE.version;
  const publishedPackages = new Map([
    ['xrpl-connect', 'integrity:xrpl-connect'],
    ['@xrpl-commons/xrpl-connect-react', 'integrity:@xrpl-commons/xrpl-connect-react'],
  ]);
  const harness = createRegistryHarness(STABLE, { tags, publishedPackages });
  await harness.publish(['--confirm', STABLE.version]);
  assert.equal(harness.calls.filter(({ args }) => args[0] === 'publish').length, 1);
  for (const name of RELEASE_PACKAGE_NAMES) {
    assert.equal(harness.registryTags[name].latest, STABLE.version);
    assert.equal(harness.registryTags[name][STABLE_STAGING_TAG], undefined);
  }
});

test('publisher retries registry propagation and rejects a dirty worktree', async () => {
  const retryHarness = createRegistryHarness(RC1, { visibilityFailures: 2 });
  await retryHarness.publish(['--confirm', RC1.version]);
  assert.deepEqual(retryHarness.waits, REGISTRY_VERIFY_RETRY_DELAYS_MS.slice(0, 2));

  const dirtyHarness = createRegistryHarness(RC1, {
    dirty: ' M packages/xrpl-connect/package.json',
  });
  await assert.rejects(
    dirtyHarness.publish(['--confirm', RC1.version]),
    /Release worktree must be clean.*package\.json/s
  );
  assert.deepEqual(
    dirtyHarness.calls.map(({ command }) => command),
    ['git']
  );
});
