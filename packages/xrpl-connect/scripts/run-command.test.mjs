import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CANDIDATE_VERSION,
  REGISTRY_VERIFY_RETRY_DELAYS_MS,
  assertSafePrepublishRegistryState,
  createRcPublisher,
} from './publish-rc.mjs';
import { createCommandRunner } from './run-command.mjs';

test('run preserves command arguments without invoking a shell', () => {
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
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'npm');
  assert.strictEqual(calls[0][1], commandArgs);
  assert.equal(calls[0][2].cwd, 'consumer');
  assert.equal(calls[0][2].env.TEST_ENV, 'set');
  assert.equal('TEST_REMOVED' in calls[0][2].env, false);
  assert.equal(calls[0][2].stdio, 'pipe');
  assert.equal('shell' in calls[0][2], false);
});

test('run propagates spawn errors', () => {
  const error = new Error('spawn failed');
  const run = createCommandRunner(() => ({ error }));

  assert.throws(() => run('npm', ['pack']), error);
});

test('run reports non-zero exits with captured output', () => {
  const run = createCommandRunner(() => ({ status: 2, stdout: 'out', stderr: 'err' }));

  assert.throws(
    () => run('npm', ['pack'], { capture: true }),
    /npm pack failed with exit code 2\nout\nerr/
  );
});

test('source package rejects direct publishing', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
  const prefix = 'node -e "';
  const guard = manifest.scripts.prepublishOnly.slice(prefix.length, -1);
  const result = spawnSync(process.execPath, ['-e', guard], { encoding: 'utf-8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Do not publish xrpl-connect from the source package/);
  assert.match(result.stderr, /publish:rc/);
});

test('publish build uses a cross-platform quoted workspace filter', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

  assert.match(manifest.scripts['publish:build'], /vp run -F "\{\.\}\^\.\.\."/);
  assert.doesNotMatch(manifest.scripts['publish:build'], /vp run -F '\{\.\}\^\.\.\.'/);
});

test('RC publisher requires exact confirmation before running commands', async () => {
  const publishRc = createRcPublisher(() => assert.fail('must not run a command'));

  await assert.rejects(publishRc([]), new RegExp(`--confirm ${CANDIDATE_VERSION}`));
  await assert.rejects(
    publishRc(['--confirm', '1.0.0-rc.1']),
    new RegExp(`--confirm ${CANDIDATE_VERSION}`)
  );
});

test('RC registry preflight accepts only fresh, partial, or complete candidate state', () => {
  const pristine = {
    'xrpl-connect': { latest: '0.8.2' },
    '@xrpl-commons/xrpl-connect-react': null,
    '@xrpl-commons/xrpl-connect-vue': null,
  };
  const partial = {
    'xrpl-connect': { latest: '0.8.2', rc: CANDIDATE_VERSION },
    '@xrpl-commons/xrpl-connect-react': {
      latest: CANDIDATE_VERSION,
      rc: CANDIDATE_VERSION,
    },
    '@xrpl-commons/xrpl-connect-vue': null,
  };
  const complete = {
    ...partial,
    '@xrpl-commons/xrpl-connect-vue': {
      latest: CANDIDATE_VERSION,
      rc: CANDIDATE_VERSION,
    },
  };
  const interrupted = {
    'xrpl-connect': { latest: '0.8.2' },
    '@xrpl-commons/xrpl-connect-react': { latest: CANDIDATE_VERSION },
    '@xrpl-commons/xrpl-connect-vue': null,
  };

  for (const state of [pristine, partial, complete, interrupted]) {
    assert.doesNotThrow(() => assertSafePrepublishRegistryState(state));
  }
  assert.throws(
    () =>
      assertSafePrepublishRegistryState({
        ...pristine,
        'xrpl-connect': { latest: CANDIDATE_VERSION, rc: CANDIDATE_VERSION },
      }),
    /latest changed unexpectedly/
  );
  assert.throws(
    () =>
      assertSafePrepublishRegistryState({
        ...pristine,
        '@xrpl-commons/xrpl-connect-react': { latest: '0.8.2' },
      }),
    /@latest must point/
  );
});

function recordPublisherCalls(publishedPackages = new Set(), registryFailures = 0) {
  const calls = [];
  const waits = [];
  let remainingRegistryFailures = registryFailures;
  const publishRc = createRcPublisher(
    (command, args, options) => {
      calls.push({ command, args, cwd: options.cwd, env: options.env });
      if (command === 'git') return '';
      if (command === process.execPath && args.includes('--check-registry')) {
        if (remainingRegistryFailures > 0) {
          remainingRegistryFailures -= 1;
          throw new Error('npm view failed with code E404 during registry propagation');
        }
        return '';
      }
      if (command === 'npm' && args[0] === 'pack') {
        const name = options.cwd.endsWith('dist-publish')
          ? 'xrpl-connect'
          : options.cwd.endsWith('react')
            ? '@xrpl-commons/xrpl-connect-react'
            : '@xrpl-commons/xrpl-connect-vue';
        return JSON.stringify([
          { name, version: CANDIDATE_VERSION, integrity: `integrity:${name}` },
        ]);
      }
      if (command === 'npm' && args[0] === 'view') {
        const packageName = args[1].slice(0, -`@${CANDIDATE_VERSION}`.length);
        if (publishedPackages.has(packageName)) return JSON.stringify(`integrity:${packageName}`);
        throw new Error(`npm view failed with code E404 for ${packageName}`);
      }
    },
    async (delayMs) => {
      waits.push(delayMs);
    }
  );
  return { calls, publishRc, waits };
}

test('RC publisher preflights, verifies, and publishes only through the fixed registry', async () => {
  const { calls, publishRc } = recordPublisherCalls();

  await publishRc(['--', '--confirm', CANDIDATE_VERSION]);

  assert.equal(calls.length, 14);
  assert.deepEqual(calls[1].args, [
    'scripts/test-publish.mjs',
    '--check-access',
    '--check-prepublish',
  ]);
  assert.deepEqual(calls[2].args, ['test:publish']);
  const publishCalls = calls.filter(({ args }) => args[0] === 'publish');
  assert.equal(publishCalls.length, 3);
  for (const call of publishCalls) {
    assert.equal(call.command, 'npm');
    assert.deepEqual(call.args, [
      'publish',
      '--tag',
      'rc',
      '--access',
      'public',
      '--registry',
      'https://registry.npmjs.org/',
    ]);
    assert.equal(call.env.npm_config_access, 'public');
    assert.equal(call.env.npm_config_registry, 'https://registry.npmjs.org/');
    assert.equal(call.env.npm_config_tag, 'rc');
  }
  assert.deepEqual(calls.at(-1).args, ['scripts/test-publish.mjs', '--check-registry']);
});

test('RC publisher retries post-publish verification during registry propagation', async () => {
  const { calls, publishRc, waits } = recordPublisherCalls(new Set(), 2);

  await publishRc(['--confirm', CANDIDATE_VERSION]);

  const verificationCalls = calls.filter(
    ({ command, args }) => command === process.execPath && args.includes('--check-registry')
  );
  assert.equal(verificationCalls.length, 3);
  assert.deepEqual(waits, REGISTRY_VERIFY_RETRY_DELAYS_MS.slice(0, 2));
});

test('RC publisher stops retrying registry verification after the bounded delay schedule', async () => {
  const { calls, publishRc, waits } = recordPublisherCalls(new Set(), Number.POSITIVE_INFINITY);

  await assert.rejects(
    publishRc(['--confirm', CANDIDATE_VERSION]),
    /E404 during registry propagation/
  );

  const verificationCalls = calls.filter(
    ({ command, args }) => command === process.execPath && args.includes('--check-registry')
  );
  assert.equal(verificationCalls.length, REGISTRY_VERIFY_RETRY_DELAYS_MS.length + 1);
  assert.deepEqual(waits, REGISTRY_VERIFY_RETRY_DELAYS_MS);
});

test('RC publisher resumes by restoring rc tags for exact candidates already on npm', async () => {
  const { calls, publishRc } = recordPublisherCalls(
    new Set(['xrpl-connect', '@xrpl-commons/xrpl-connect-react'])
  );

  await publishRc(['--confirm', CANDIDATE_VERSION]);

  const publishCalls = calls.filter(({ args }) => args[0] === 'publish');
  assert.equal(publishCalls.length, 1);
  assert.match(publishCalls[0].cwd, /packages[/\\]vue$/);
  const tagCalls = calls.filter(({ args }) => args[0] === 'dist-tag');
  assert.deepEqual(
    tagCalls.map(({ args }) => args),
    [
      [
        'dist-tag',
        'add',
        `xrpl-connect@${CANDIDATE_VERSION}`,
        'rc',
        '--registry',
        'https://registry.npmjs.org/',
      ],
      [
        'dist-tag',
        'add',
        `@xrpl-commons/xrpl-connect-react@${CANDIDATE_VERSION}`,
        'rc',
        '--registry',
        'https://registry.npmjs.org/',
      ],
    ]
  );
  assert.deepEqual(calls.at(-1).args, ['scripts/test-publish.mjs', '--check-registry']);
});

test('RC publisher rejects a published candidate with different contents', async () => {
  const calls = [];
  const publishRc = createRcPublisher((command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
    if (command === 'git') return '';
    if (command === 'npm' && args[0] === 'pack') {
      return JSON.stringify([
        { name: 'xrpl-connect', version: CANDIDATE_VERSION, integrity: 'local-integrity' },
      ]);
    }
    if (command === 'npm' && args[0] === 'view') return JSON.stringify('registry-integrity');
  });

  await assert.rejects(
    publishRc(['--confirm', CANDIDATE_VERSION]),
    /already published with different contents/
  );
  assert.equal(
    calls.some(({ args }) => args[0] === 'publish'),
    false
  );
});

test('RC publisher propagates registry failures other than a missing candidate', async () => {
  const registryError = new Error('npm view failed with code E500');
  const publishRc = createRcPublisher((command, args) => {
    if (command === 'git') return '';
    if (command === 'npm' && args[0] === 'pack') {
      return JSON.stringify([
        {
          name: 'xrpl-connect',
          version: CANDIDATE_VERSION,
          integrity: 'local-integrity',
        },
      ]);
    }
    if (command === 'npm' && args[0] === 'view') throw registryError;
  });

  await assert.rejects(
    publishRc(['--confirm', CANDIDATE_VERSION]),
    (error) => error === registryError
  );
});

test('RC publisher rejects a dirty release worktree before running release checks', async () => {
  const calls = [];
  const publishRc = createRcPublisher((command, args) => {
    calls.push({ command, args });
    if (command === 'git') return ' M packages/xrpl-connect/package.json';
  });

  await assert.rejects(
    publishRc(['--confirm', CANDIDATE_VERSION]),
    /Release worktree must be clean.*package\.json/s
  );
  assert.deepEqual(
    calls.map(({ command }) => command),
    ['git']
  );
});
