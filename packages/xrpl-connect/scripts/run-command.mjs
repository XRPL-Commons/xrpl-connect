import crossSpawn from 'cross-spawn';

/** Create a command runner with argv preserved across platform command shims. */
export function createCommandRunner(spawnSync) {
  return function run(command, args, options = {}) {
    const env = { ...process.env, ...options.env };
    for (const key of options.unsetEnv ?? []) delete env[key];
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      encoding: 'utf-8',
      env,
      stdio: options.capture ? 'pipe' : 'inherit',
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
      throw new Error(
        `${command} ${args.join(' ')} failed with exit code ${result.status}\n${output}`
      );
    }

    return result.stdout;
  };
}

export const run = createCommandRunner(crossSpawn.sync);
