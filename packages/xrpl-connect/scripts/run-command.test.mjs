import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  CANDIDATE_VERSION,
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

test('publish guard accepts normalized npmjs registry URLs only', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
  const prefix = 'node -e "';
  const guard = manifest.scripts.prepublishOnly.slice(prefix.length, -1);
  const runGuard = (registry) =>
    spawnSync(process.execPath, ['-e', guard], {
      env: {
        ...process.env,
        npm_config_access: 'public',
        npm_config_registry: registry,
        npm_config_tag: 'rc',
      },
    });

  assert.equal(runGuard('https://registry.npmjs.org').status, 0);
  assert.equal(runGuard('https://registry.npmjs.org/').status, 0);
  assert.equal(runGuard('https://registry.example/').status, 1);
});

test('publish build uses a cross-platform quoted workspace filter', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

  assert.match(manifest.scripts['publish:build'], /vp run -F "\{\.\}\^\.\.\."/);
  assert.doesNotMatch(manifest.scripts['publish:build'], /vp run -F '\{\.\}\^\.\.\.'/);
});

test('RC publisher requires exact confirmation before running commands', () => {
  const publishRc = createRcPublisher(() => assert.fail('must not run a command'));

  assert.throws(() => publishRc([]), new RegExp(`--confirm ${CANDIDATE_VERSION}`));
  assert.throws(
    () => publishRc(['--confirm', '1.0.0-rc.1']),
    new RegExp(`--confirm ${CANDIDATE_VERSION}`)
  );
});

test('RC registry preflight accepts only fresh, partial, or complete candidate state', () => {
  const pristine = {
    'xrpl-connect': { latest: '0.8.2' },
    '@xrpl-connect/react': null,
    '@xrpl-connect/vue': null,
  };
  const partial = {
    'xrpl-connect': { latest: '0.8.2', rc: CANDIDATE_VERSION },
    '@xrpl-connect/react': { rc: CANDIDATE_VERSION },
    '@xrpl-connect/vue': null,
  };
  const complete = {
    ...partial,
    '@xrpl-connect/vue': { rc: CANDIDATE_VERSION },
  };
  const interrupted = {
    'xrpl-connect': { latest: '0.8.2' },
    '@xrpl-connect/react': {},
    '@xrpl-connect/vue': null,
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
        '@xrpl-connect/react': { latest: CANDIDATE_VERSION },
      }),
    /unexpected dist-tags/
  );
});

function recordPublisherCalls(publishedPackages = new Set()) {
  const calls = [];
  const publishRc = createRcPublisher((command, args, options) => {
    calls.push({ command, args, cwd: options.cwd, env: options.env });
    if (command === 'git') return '';
    if (command === 'npm' && args[0] === 'pack') {
      const name = options.cwd.endsWith('dist-publish')
        ? 'xrpl-connect'
        : options.cwd.endsWith('react')
          ? '@xrpl-connect/react'
          : '@xrpl-connect/vue';
      return JSON.stringify([{ name, version: CANDIDATE_VERSION, integrity: `integrity:${name}` }]);
    }
    if (command === 'npm' && args[0] === 'view') {
      const packageName = args[1].slice(0, -`@${CANDIDATE_VERSION}`.length);
      if (publishedPackages.has(packageName)) return JSON.stringify(`integrity:${packageName}`);
      throw new Error(`npm view failed with code E404 for ${packageName}`);
    }
  });
  return { calls, publishRc };
}

test('RC publisher preflights, verifies, and publishes only through the fixed registry', () => {
  const { calls, publishRc } = recordPublisherCalls();

  publishRc(['--', '--confirm', CANDIDATE_VERSION]);

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

test('RC publisher resumes by restoring rc tags for exact candidates already on npm', () => {
  const { calls, publishRc } = recordPublisherCalls(
    new Set(['xrpl-connect', '@xrpl-connect/react'])
  );

  publishRc(['--confirm', CANDIDATE_VERSION]);

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
        `@xrpl-connect/react@${CANDIDATE_VERSION}`,
        'rc',
        '--registry',
        'https://registry.npmjs.org/',
      ],
    ]
  );
  assert.deepEqual(calls.at(-1).args, ['scripts/test-publish.mjs', '--check-registry']);
});

test('RC publisher rejects a published candidate with different contents', () => {
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

  assert.throws(
    () => publishRc(['--confirm', CANDIDATE_VERSION]),
    /already published with different contents/
  );
  assert.equal(
    calls.some(({ args }) => args[0] === 'publish'),
    false
  );
});

test('RC publisher propagates registry failures other than a missing candidate', () => {
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

  assert.throws(
    () => publishRc(['--confirm', CANDIDATE_VERSION]),
    (error) => error === registryError
  );
});

test('RC publisher rejects a dirty release worktree before running release checks', () => {
  const calls = [];
  const publishRc = createRcPublisher((command, args) => {
    calls.push({ command, args });
    if (command === 'git') return ' M packages/xrpl-connect/package.json';
  });

  assert.throws(
    () => publishRc(['--confirm', CANDIDATE_VERSION]),
    /Release worktree must be clean.*package\.json/s
  );
  assert.deepEqual(
    calls.map(({ command }) => command),
    ['git']
  );
});
