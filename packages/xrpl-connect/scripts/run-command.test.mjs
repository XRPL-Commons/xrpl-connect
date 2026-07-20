import assert from 'node:assert/strict';
import test from 'node:test';
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
