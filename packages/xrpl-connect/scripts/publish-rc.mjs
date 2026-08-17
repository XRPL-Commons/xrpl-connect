import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { run as defaultRun } from './run-command.mjs';

export const CANDIDATE_VERSION = '1.0.0-rc.0';
const NPM_REGISTRY = 'https://registry.npmjs.org/';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectFolder = path.join(__dirname, '..');
const repositoryRoot = path.join(projectFolder, '..', '..');
const publishFolders = [
  path.join(projectFolder, 'dist-publish'),
  path.join(repositoryRoot, 'packages', 'react'),
  path.join(repositoryRoot, 'packages', 'vue'),
];

export function createRcPublisher(run = defaultRun) {
  return function publishRc(args = process.argv.slice(2)) {
    assert.deepEqual(
      args,
      ['--confirm', CANDIDATE_VERSION],
      `Refusing to publish without --confirm ${CANDIDATE_VERSION}`
    );

    run(process.execPath, ['scripts/test-publish.mjs', '--check-access', '--check-prepublish'], {
      cwd: projectFolder,
    });
    run('pnpm', ['test:publish'], { cwd: projectFolder });

    for (const folder of publishFolders) {
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
