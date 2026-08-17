import assert from 'node:assert/strict';
import test from 'node:test';
import { CANDIDATE_VERSION, createRcPublisher } from './publish-rc.mjs';
import { createCommandRunner } from './run-command.mjs';

test('run preserves command arguments without invoking a shell', () => {
  const calls = [];
  const run = createCommandRunner((...args) => {
    calls.push(args);
    return { status: 0, stdout: 'packed' };
  });
  const commandArgs = ['install', 'C:\\Temp Folder\\package.tgz'];

  assert.equal(
    run('npm', commandArgs, { capture: true, cwd: 'consumer', env: { TEST_ENV: 'set' } }),
    'packed'
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'npm');
  assert.strictEqual(calls[0][1], commandArgs);
  assert.equal(calls[0][2].cwd, 'consumer');
  assert.equal(calls[0][2].env.TEST_ENV, 'set');
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

test('run returns captured stdout and stderr when requested', () => {
  const run = createCommandRunner(() => ({ status: 0, stdout: 'out', stderr: 'warning' }));

  assert.deepEqual(run('npm', ['install'], { captureResult: true }), {
    stdout: 'out',
    stderr: 'warning',
  });
});

test('RC publisher requires exact confirmation before running commands', () => {
  const publishRc = createRcPublisher(() => assert.fail('must not run a command'));

  assert.throws(() => publishRc([]), new RegExp(`--confirm ${CANDIDATE_VERSION}`));
  assert.throws(
    () => publishRc(['--confirm', '1.0.0-rc.1']),
    new RegExp(`--confirm ${CANDIDATE_VERSION}`)
  );
});

test('RC publisher preflights, verifies, and publishes only through the fixed registry', () => {
  const calls = [];
  const publishRc = createRcPublisher((command, args, options) => {
    calls.push({ command, args, cwd: options.cwd });
  });

  publishRc(['--confirm', CANDIDATE_VERSION]);

  assert.equal(calls.length, 6);
  assert.deepEqual(calls[0].args, [
    'scripts/test-publish.mjs',
    '--check-access',
    '--check-prepublish',
  ]);
  assert.deepEqual(calls[1].args, ['test:publish']);
  for (const call of calls.slice(2, 5)) {
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
  }
  assert.deepEqual(calls[5].args, ['scripts/test-publish.mjs', '--check-registry']);
});
