import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyConsumerDependencies } from './consumer-dependencies.mjs';
import { createCommandRunner } from './run-command.mjs';

function consumer(t, dependencies = {}) {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'xrpl-dependency-test-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const manifest = (relative, name, deps) => {
    const directory = path.join(folder, relative);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ name, version: '1.0.0', dependencies: deps })
    );
  };
  manifest('.', 'consumer', { 'xrpl-connect': '1.0.0', 'fixture-tool': '1.0.0' });
  manifest('node_modules/xrpl-connect', 'xrpl-connect', dependencies);
  // This unrelated tool makes npm ls exit 1 while still returning the full tree.
  manifest('node_modules/fixture-tool', 'fixture-tool', { 'missing-tool-dependency': '1.0.0' });
  return { folder, manifest, options: { env: { npm_config_cache: path.join(folder, '.cache') } } };
}

test('dependency inspection tolerates problems outside published package roots', (t) => {
  const { folder, options } = consumer(t);
  assert.doesNotThrow(() => verifyConsumerDependencies(folder, ['xrpl-connect'], options));
});

test('dependency inspection still rejects removed dependencies under published roots', (t) => {
  const { folder, manifest, options } = consumer(t, { intermediary: '1.0.0' });
  manifest('node_modules/intermediary', 'intermediary', { 'node-forge': '1.0.0' });
  manifest('node_modules/node-forge', 'node-forge', {});
  assert.throws(
    () => verifyConsumerDependencies(folder, ['xrpl-connect'], options),
    /Unwanted consumer dependency: xrpl-connect > intermediary@1.0.0 > node-forge@1.0.0/
  );
});

test('dependency inspection still rejects legacy XRPL', (t) => {
  const { folder, manifest, options } = consumer(t, { xrpl: '1.0.0' });
  manifest('node_modules/xrpl', 'xrpl', {});
  assert.throws(
    () => verifyConsumerDependencies(folder, ['xrpl-connect'], options),
    /Legacy XRPL dependency/
  );
});

test('dependency inspection rejects broken or absent published roots', (t) => {
  const { folder, options } = consumer(t, { 'missing-runtime': '1.0.0' });
  assert.throws(
    () => verifyConsumerDependencies(folder, ['xrpl-connect'], options),
    /Invalid published dependency/
  );
  assert.throws(
    () => verifyConsumerDependencies(folder, ['absent-package'], options),
    /Missing published package: absent-package/
  );
});

test('dependency inspection does not swallow command or malformed-output failures', () => {
  for (const result of [
    { status: 1, stdout: 'not JSON' },
    { status: 1, stdout: JSON.stringify({ error: { code: 'EACCES' } }) },
    { status: 2, stdout: JSON.stringify({ error: { code: 'ELSPROBLEMS' } }) },
    { error: new Error('spawn failed') },
  ]) {
    const run = createCommandRunner(() => result);
    assert.throws(
      () => verifyConsumerDependencies('consumer', ['xrpl-connect'], {}, run),
      /failed/
    );
  }
});
