import assert from 'node:assert/strict';
import { run } from './run-command.mjs';

export function verifyConsumerDependencies(
  consumerFolder,
  packageNames,
  options,
  runCommand = run
) {
  let tree;
  try {
    tree = JSON.parse(
      runCommand('npm', ['ls', '--all', '--json'], {
        ...options,
        cwd: consumerFolder,
        capture: true,
      })
    );
  } catch (error) {
    if (error.exitCode !== 1) throw error;
    try {
      tree = JSON.parse(error.stdout);
    } catch {
      throw error;
    }
    // npm still returns the dependency tree when unrelated fixture tools are broken.
    if (tree?.error?.code !== 'ELSPROBLEMS') throw error;
  }
  const forbidden = new Set([
    '@crossmarkio/sdk',
    '@crossmarkio/typings',
    '@transia/xrpl',
    'node-forge',
    '@types/node-forge',
    'elliptic',
  ]);
  const visit = (node, parents) => {
    assert(
      !node.invalid && !node.missing && !node.extraneous && !node.problems?.length,
      `Invalid published dependency: ${parents.join(' > ')}: ${JSON.stringify(node.problems ?? node)}`
    );
    for (const [name, dependency] of Object.entries(node.dependencies ?? {})) {
      const chain = [...parents, `${name}@${dependency.version}`];
      assert(!forbidden.has(name), `Unwanted consumer dependency: ${chain.join(' > ')}`);
      if (name === 'xrpl') {
        assert(
          Number(dependency.version.split('.')[0]) >= 3,
          `Legacy XRPL dependency: ${chain.join(' > ')}`
        );
      }
      visit(dependency, chain);
    }
  };
  // The fixture also installs build tools (Nuxt brings its own Forge copy).
  // Check the actual dependency trees rooted at our published packages.
  for (const name of packageNames) {
    const installed = tree.dependencies?.[name];
    assert(installed, `Missing published package: ${name}`);
    visit(installed, [name]);
  }
  console.log('✓ Published dependency trees exclude Crossmark typing-only runtime dependencies');
}
